using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Domain.Interfaces;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Schedule.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Schedule.Services;

/// <summary>
/// 孩子端日程查询服务实现。复用 AppDbContext 只读，
/// 自动按 AssignedChildId == userId 过滤，并应用取消/排除规则。
/// </summary>
public class ChildScheduleQueryService : IChildScheduleQueryService
{
    private readonly AppDbContext _db;

    public ChildScheduleQueryService(AppDbContext db)
    {
        _db = db;
    }

    public Task<ChildScheduleListResponse> GetDailyListAsync(
        Guid userId, Guid familyId, DateOnly date, CancellationToken ct = default)
    {
        return GetListAsync(userId, familyId, date, date, ct);
    }

    public Task<ChildScheduleListResponse> GetWeeklyListAsync(
        Guid userId, Guid familyId, DateOnly weekStart, CancellationToken ct = default)
    {
        var weekEnd = weekStart.AddDays(6);
        return GetListAsync(userId, familyId, weekStart, weekEnd, ct);
    }

    public async Task<ChildScheduleListResponse> GetMonthlyListAsync(
        Guid userId, Guid familyId, DateOnly monthStart, CancellationToken ct = default)
    {
        // 月底 = 下月 1 号减一天
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        return await GetListAsync(userId, familyId, monthStart, monthEnd, ct);
    }

    public async Task<ScheduleInfo?> GetByIdAsync(
        Guid scheduleId, Guid userId, Guid familyId, CancellationToken ct = default)
    {
        var schedule = await _db.Schedules
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == scheduleId && s.FamilyId == familyId && !s.IsDeleted, ct);

        if (schedule == null) return null;

        // 孩子端只能看自己的数据
        if (schedule.AssignedChildId != userId)
            throw new UnauthorizedAccessException("CHILD_ACCESS_DENIED");

        return new ScheduleInfo
        {
            ScheduleId = schedule.Id,
            Name = schedule.Name,
            ScheduleType = schedule.ScheduleType,
            FamilyId = schedule.FamilyId,
            AssignedChildId = schedule.AssignedChildId,
            IsDeleted = schedule.IsDeleted
        };
    }

    // ---------- 内部：通用列表查询 ----------

    private async Task<ChildScheduleListResponse> GetListAsync(
        Guid userId, Guid familyId, DateOnly startDate, DateOnly endDate, CancellationToken ct)
    {
        // 1. 拉取该孩子所有未删除日程(用 FamilyId + AssignedChildId 过滤)
        var schedules = await _db.Schedules
            .AsNoTracking()
            .Include(s => s.TimeSlots)
            .Include(s => s.Cancellations)
            .Include(s => s.DateExclusions)
            .Where(s => s.FamilyId == familyId
                        && s.AssignedChildId == userId
                        && !s.IsDeleted)
            .ToListAsync(ct);

        // 2. 拉取该孩子这些日程的 Checkin(按日期范围过滤,减少数据量)
        var scheduleIds = schedules.Select(s => s.Id).ToList();
        var checkins = await _db.Checkins
            .AsNoTracking()
            .Where(c => scheduleIds.Contains(c.ScheduleId)
                        && c.Date >= startDate && c.Date <= endDate)
            .ToListAsync(ct);
        var checkinSet = checkins
            .GroupBy(c => c.ScheduleId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Date).ToHashSet());

        // 3. 展开虚拟实例(按 schedule × date),应用取消/排除
        var totalCount = 0;
        var completedCount = 0;
        var presentSchedules = new List<Domain.Entities.Schedule>();

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            var dayOfWeek = date.DayOfWeek;
            foreach (var schedule in schedules)
            {
                if (!IsScheduleActiveOnDate(schedule, date, dayOfWeek)) continue;

                totalCount++;
                if (checkinSet.TryGetValue(schedule.Id, out var dates) && dates.Contains(date))
                    completedCount++;

                if (!presentSchedules.Contains(schedule))
                    presentSchedules.Add(schedule);
            }
        }

        var percentage = totalCount == 0
            ? 0.0
            : Math.Round(completedCount * 100.0 / totalCount, 2);

        return new ChildScheduleListResponse
        {
            Items = presentSchedules.Select(ToScheduleInfo).ToList(),
            CompletedCount = completedCount,
            TotalCount = totalCount,
            CompletionPercentage = percentage
        };
    }

    /// <summary>判断日程是否在指定日期上有效(应用取消/排除/到期日/单次实例规则)。</summary>
    private static bool IsScheduleActiveOnDate(
        Domain.Entities.Schedule schedule, DateOnly date, DayOfWeek dayOfWeek)
    {
        // 排除: 排除该日不显示
        if (schedule.DateExclusions.Any(d => d.ExcludedDate == date))
            return false;

        // 取消: 当日已取消不显示
        if (schedule.Cancellations.Any(c => c.CancelDate == date))
            return false;

        // 作业任务: 仅在 DueDate 当日显示
        if (schedule.ScheduleType == ScheduleType.HomeworkTask)
            return schedule.DueDate == date;

        // 衍生单次实例(ThisOnly 编辑产物): 仅在 OverrideDate 当日显示
        if (schedule.SourceScheduleId.HasValue)
            return schedule.OverrideDate == date;

        // 常规重复日程: 必须有匹配的 TimeSlot + RepeatEndDate 检查
        if (!schedule.TimeSlots.Any(t => t.DayOfWeek == dayOfWeek))
            return false;

        if (schedule.RepeatEndDate.HasValue && date > schedule.RepeatEndDate.Value)
            return false;

        return true;
    }

    private static ScheduleInfo ToScheduleInfo(Domain.Entities.Schedule s) => new()
    {
        ScheduleId = s.Id,
        Name = s.Name,
        ScheduleType = s.ScheduleType,
        FamilyId = s.FamilyId,
        AssignedChildId = s.AssignedChildId,
        IsDeleted = s.IsDeleted
    };
}
