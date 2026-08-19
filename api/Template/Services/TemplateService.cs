using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Template.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Template.Services;

/// <summary>
/// 模板服务实现。所有查询走 AsNoTracking，写操作走事务。
/// 跨家庭隔离：IsPreset=true 全局可见，否则仅同家庭。
/// ApplyAsync 复用 IScheduleService.CreateAsync 保持创建逻辑单源。
/// </summary>
public class TemplateService : ITemplateService
{
    private readonly AppDbContext _db;
    private readonly IScheduleService _scheduleService;
    private readonly ILogger<TemplateService> _logger;

    public TemplateService(
        AppDbContext db,
        IScheduleService scheduleService,
        ILogger<TemplateService> logger)
    {
        _db = db;
        _scheduleService = scheduleService;
        _logger = logger;
    }

    public async Task<ListTemplatesResponse> ListAsync(
        Guid familyId,
        string? keyword,
        string? scheduleType,
        bool? isPreset,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.Templates
            .AsNoTracking()
            .Where(t => !t.IsDeleted && (t.IsPreset || t.FamilyId == familyId));

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var kw = keyword.Trim();
            query = query.Where(t => t.Name.Contains(kw));
        }

        if (!string.IsNullOrWhiteSpace(scheduleType) &&
            Enum.TryParse<ScheduleType>(scheduleType, out var type))
        {
            query = query.Where(t => t.ScheduleType == type);
        }

        if (isPreset.HasValue)
        {
            query = query.Where(t => t.IsPreset == isPreset.Value);
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderBy(t => t.IsPreset ? 0 : 1)
            .ThenByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new TemplateSummary
            {
                TemplateId = t.Id,
                Name = t.Name,
                ScheduleType = t.ScheduleType.ToString(),
                IsPreset = t.IsPreset,
                CreatedBy = t.CreatedBy,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync(ct);

        return new ListTemplatesResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<TemplateDetail?> GetByIdAsync(
        Guid templateId,
        Guid familyId,
        CancellationToken ct = default)
    {
        var template = await _db.Templates
            .AsNoTracking()
            .Include(t => t.TimeSlots)
            .FirstOrDefaultAsync(
                t => t.Id == templateId && !t.IsDeleted && (t.IsPreset || t.FamilyId == familyId),
                ct);

        if (template == null) return null;

        var usageCount = await _db.Schedules
            .AsNoTracking()
            .CountAsync(s => s.SourceTemplateId == templateId && !s.IsDeleted, ct);

        return ToDetail(template, usageCount);
    }

    public async Task<TemplateDetail> CreateAsync(
        Guid familyId,
        Guid userId,
        CreateTemplateRequest request,
        CancellationToken ct = default)
    {
        if (!Enum.TryParse<ScheduleType>(request.ScheduleType, out var scheduleType))
            throw new DomainException(ErrorCodes.TemplateTypeInvalid);

        // 唯一性：同家庭内 (FamilyId, Name) 唯一
        var duplicate = await _db.Templates
            .AsNoTracking()
            .AnyAsync(t => t.FamilyId == familyId && t.Name == request.Name && !t.IsDeleted, ct);
        if (duplicate)
            throw new DomainException(ErrorCodes.TemplateDuplicateName);

        var now = DateTimeOffset.UtcNow;
        var template = new DomainTemplate
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            ScheduleType = scheduleType,
            IsPreset = false,
            FamilyId = familyId,
            CreatedBy = userId,
            RepeatEndDate = scheduleType == ScheduleType.HomeworkTask ? null : request.RepeatEndDate,
            Location = request.Location,
            Notes = request.Notes,
            IsDeleted = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        // HomeworkTask 模板无 timeSlots
        if (scheduleType != ScheduleType.HomeworkTask)
        {
            foreach (var ts in request.TimeSlots)
            {
                template.TimeSlots.Add(new DomainTemplateTimeSlot
                {
                    TemplateId = template.Id,
                    DayOfWeek = ts.DayOfWeek,
                    StartTime = ts.StartTime,
                    EndTime = ts.EndTime
                });
            }
        }

        _db.Templates.Add(template);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new DomainException(ErrorCodes.TemplateDuplicateName);
        }

        return ToDetail(template, usageCount: 0);
    }

    public async Task<TemplateDetail> UpdateAsync(
        Guid templateId,
        Guid userId,
        UpdateTemplateRequest request,
        CancellationToken ct = default)
    {
        var template = await _db.Templates
            .Include(t => t.TimeSlots)
            .FirstOrDefaultAsync(t => t.Id == templateId && !t.IsDeleted, ct)
            ?? throw new DomainException(ErrorCodes.TemplateNotFound);

        if (template.IsPreset)
            throw new DomainException(ErrorCodes.TemplatePresetReadonly);

        if (template.CreatedBy != userId)
            throw new DomainException(ErrorCodes.TemplateNotOwner);

        // HomeworkTask 模板 name 必填，长度 ≤50 已由 Validator 校验
        template.Name = request.Name.Trim();
        template.RepeatEndDate = template.ScheduleType == ScheduleType.HomeworkTask
            ? null
            : request.RepeatEndDate;
        template.Location = request.Location;
        template.Notes = request.Notes;
        template.UpdatedAt = DateTimeOffset.UtcNow;

        // 完整替换 timeSlots
        var oldSlots = await _db.TemplateTimeSlots
            .Where(ts => ts.TemplateId == template.Id)
            .ToListAsync(ct);
        _db.TemplateTimeSlots.RemoveRange(oldSlots);

        if (template.ScheduleType != ScheduleType.HomeworkTask)
        {
            foreach (var ts in request.TimeSlots)
            {
                template.TimeSlots.Add(new DomainTemplateTimeSlot
                {
                    TemplateId = template.Id,
                    DayOfWeek = ts.DayOfWeek,
                    StartTime = ts.StartTime,
                    EndTime = ts.EndTime
                });
            }
        }

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new DomainException(ErrorCodes.TemplateDuplicateName);
        }

        var usageCount = await _db.Schedules
            .AsNoTracking()
            .CountAsync(s => s.SourceTemplateId == templateId && !s.IsDeleted, ct);

        return ToDetail(template, usageCount);
    }

    public async Task<DeleteTemplateResponse> DeleteAsync(
        Guid templateId,
        Guid userId,
        CancellationToken ct = default)
    {
        var template = await _db.Templates
            .FirstOrDefaultAsync(t => t.Id == templateId && !t.IsDeleted, ct)
            ?? throw new DomainException(ErrorCodes.TemplateNotFound);

        if (template.IsPreset)
            throw new DomainException(ErrorCodes.TemplatePresetReadonly);

        if (template.CreatedBy != userId)
            throw new DomainException(ErrorCodes.TemplateNotOwner);

        template.IsDeleted = true;
        template.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return new DeleteTemplateResponse
        {
            TemplateId = templateId,
            Deleted = true
        };
    }

    public async Task<CreateScheduleResponse> ApplyAsync(
        Guid templateId,
        Guid familyId,
        Guid userId,
        ApplyTemplateRequest request,
        CancellationToken ct = default)
    {
        var template = await _db.Templates
            .AsNoTracking()
            .Include(t => t.TimeSlots)
            .FirstOrDefaultAsync(
                t => t.Id == templateId && !t.IsDeleted && (t.IsPreset || t.FamilyId == familyId),
                ct)
            ?? throw new DomainException(ErrorCodes.TemplateNotFound);

        // 验证 childId 是当前家庭成员（且是孩子角色）
        var isFamilyChild = await _db.FamilyMembers
            .AsNoTracking()
            .AnyAsync(fm => fm.UserId == request.ChildId
                          && fm.FamilyId == familyId
                          && fm.Role == UserRole.Child,
                ct);
        if (!isFamilyChild)
            throw new DomainException(ErrorCodes.TemplateChildNotInFamily);

        // 合并覆盖字段 → 构造 CreateScheduleRequest（TimeSlotDto 与 TemplateTimeSlotDto 字段同构，需映射）
        List<TimeSlotDto> effectiveTimeSlots;
        if (request.TimeSlots != null && request.TimeSlots.Count > 0)
        {
            effectiveTimeSlots = request.TimeSlots
                .Select(ts => new TimeSlotDto
                {
                    DayOfWeek = ts.DayOfWeek,
                    StartTime = ts.StartTime,
                    EndTime = ts.EndTime
                })
                .ToList();
        }
        else
        {
            effectiveTimeSlots = template.TimeSlots
                .Select(ts => new TimeSlotDto
                {
                    DayOfWeek = ts.DayOfWeek,
                    StartTime = ts.StartTime,
                    EndTime = ts.EndTime
                })
                .ToList();
        }

        var merged = new CreateScheduleRequest
        {
            Name = request.Name ?? template.Name,
            ScheduleType = template.ScheduleType.ToString(),
            ChildIds = new List<Guid> { request.ChildId },
            TimeSlots = effectiveTimeSlots,
            RepeatEndDate = request.RepeatEndDate ?? template.RepeatEndDate,
            Location = request.Location ?? template.Location,
            Notes = request.Notes ?? template.Notes,
            SourceTemplateId = templateId
        };

        return await _scheduleService.CreateAsync(familyId, userId, merged, ct);
    }

    // ---- private helpers ----

    private static TemplateDetail ToDetail(DomainTemplate template, int usageCount) => new()
    {
        TemplateId = template.Id,
        Name = template.Name,
        ScheduleType = template.ScheduleType.ToString(),
        IsPreset = template.IsPreset,
        CreatedBy = template.CreatedBy,
        CreatedAt = template.CreatedAt,
        TimeSlots = template.TimeSlots
            .OrderBy(ts => ts.DayOfWeek)
            .ThenBy(ts => ts.StartTime)
            .Select(ts => new TemplateTimeSlotDto
            {
                DayOfWeek = ts.DayOfWeek,
                StartTime = ts.StartTime,
                EndTime = ts.EndTime
            })
            .ToList(),
        RepeatEndDate = template.RepeatEndDate,
        Location = template.Location,
        Notes = template.Notes,
        UsageCount = usageCount
    };

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        // PostgreSQL SQLSTATE 23505 = unique_violation
        return ex.InnerException is Npgsql.PostgresException pg && pg.SqlState == "23505";
    }
}
