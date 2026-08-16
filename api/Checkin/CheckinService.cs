using Agenda.Api.Checkin.Dtos;
using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Domain.Interfaces;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Checkin;

/// <summary>
/// 打卡模块服务。窗口判定复用 IScheduleQueryService（ADR-017），
/// 打卡/撤销数据走 AppDbContext（与 Schedule 模块一致的仓储方式）。
/// 时间判定以 serverTime（服务器北京时间）为准，由 Controller 注入。
/// </summary>
public class CheckinService : ICheckinService
{
    private readonly AppDbContext _db;
    private readonly IScheduleQueryService _scheduleQuery;

    public CheckinService(AppDbContext db, IScheduleQueryService scheduleQuery)
    {
        _db = db;
        _scheduleQuery = scheduleQuery;
    }

    public async Task<CheckinWindowResponse> GetCheckinWindowAsync(
        Guid scheduleId, DateOnly date, Guid userId, DateTimeOffset serverTime, CancellationToken ct = default)
    {
        var (schedule, _) = await GetAccessibleScheduleAsync(scheduleId, userId, ct);
        return await BuildWindowAsync(schedule, date, serverTime, ct);
    }

    public async Task<CheckinResponse> CheckinAsync(
        Guid scheduleId, DateOnly date, Guid userId, DateTimeOffset serverTime, CancellationToken ct = default)
    {
        var (schedule, role) = await GetAccessibleScheduleAsync(scheduleId, userId, ct);

        // 幂等：已存在打卡记录则直接返回 alreadyCheckedIn（200，非 409）。
        var existing = await _db.Checkins
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ScheduleId == scheduleId && c.Date == date, ct);
        if (existing != null)
            return ToResponse(existing, scheduleId, date, alreadyCheckedIn: true);

        // 时间窗口二次校验（服务端判定）。
        var window = await BuildWindowAsync(schedule, date, serverTime, ct);
        if (!window.CanCheckin)
        {
            if (window.Status == CheckinStatus.Cancelled)
                throw new DomainException(ErrorCodes.ScheduleCancelled);
            if (window.Reason == CheckinReason.Early)
                throw new DomainException(ErrorCodes.CheckinWindowClosed);
            throw new DomainException(ErrorCodes.TerminalState);
        }

        var source = role == UserRole.Parent ? CheckinSource.Parent : CheckinSource.Child;
        var checkin = new Domain.Entities.Checkin
        {
            ScheduleId = scheduleId,
            Date = date,
            UserId = userId,
            CheckinAt = serverTime.ToUniversalTime(),
            Source = source,
            CreatedAt = serverTime.ToUniversalTime()
        };

        _db.Checkins.Add(checkin);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // DB UNIQUE(ScheduleId, Date) 兜底：并发重复插入时回查并幂等返回。
            var concurrent = await _db.Checkins
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.ScheduleId == scheduleId && c.Date == date, ct);
            if (concurrent != null)
                return ToResponse(concurrent, scheduleId, date, alreadyCheckedIn: true);
            throw;
        }

        return new CheckinResponse
        {
            CheckinId = checkin.Id,
            ScheduleId = scheduleId,
            Date = date,
            CheckinAt = checkin.CheckinAt.ToOffset(TimeSpan.FromHours(8)),
            Source = checkin.Source.ToString(),
            AlreadyCheckedIn = null
        };
    }

    public async Task<UndoCheckinResponse> UndoAsync(
        Guid scheduleId, DateOnly date, Guid userId, DateTimeOffset serverTime, CancellationToken ct = default)
    {
        var (schedule, _) = await GetAccessibleScheduleAsync(scheduleId, userId, ct);

        var checkin = await _db.Checkins
            .FirstOrDefaultAsync(c => c.ScheduleId == scheduleId && c.Date == date, ct);
        if (checkin == null)
            throw new DomainException(ErrorCodes.NotCheckedIn);

        // ② 终态：结算记录存在或日期已过。
        if (await _db.CheckinSettlements.AsNoTracking()
                .AnyAsync(s => s.ScheduleId == scheduleId && s.Date == date, ct))
            throw new DomainException(ErrorCodes.TerminalState);

        if (date < DateOnly.FromDateTime(serverTime.Date))
            throw new DomainException(ErrorCodes.TerminalState);

        // ③ 课后活动 endTime+2h 之后窗口关闭。
        if (schedule.ScheduleType == ScheduleType.AfterSchoolActivity)
        {
            var (_, endTime) = await _scheduleQuery.GetTimeSlotAsync(scheduleId, date, ct);
            if (endTime.HasValue && serverTime.DateTime > serverTime.Date.Add(endTime.Value.ToTimeSpan()).AddHours(2))
                throw new DomainException(ErrorCodes.WindowClosed);
        }

        _db.Checkins.Remove(checkin);
        await _db.SaveChangesAsync(ct);

        return new UndoCheckinResponse
        {
            ScheduleId = scheduleId,
            Date = date,
            Undone = true,
            Status = CheckinStatus.Incomplete
        };
    }

    private async Task<CheckinWindowResponse> BuildWindowAsync(
        ScheduleInfo schedule, DateOnly date, DateTimeOffset serverTime, CancellationToken ct)
    {
        // step 1：查 Checkin → 已完成。
        var checkinExists = await _db.Checkins.AsNoTracking()
            .AnyAsync(c => c.ScheduleId == schedule.ScheduleId && c.Date == date, ct);
        if (checkinExists)
        {
            return new CheckinWindowResponse
            {
                ScheduleId = schedule.ScheduleId,
                Date = date,
                CanCheckin = false,
                CanUndo = await CanUndoAsync(schedule, date, serverTime, ct),
                Reason = null,
                RemainingSeconds = null,
                Status = CheckinStatus.Completed,
                StatusLabel = CheckinStatus.Label(CheckinStatus.Completed),
                ServerTime = serverTime
            };
        }

        // step 2：查 Cancellation + Exclusion → cancelled（excluded 合并）。
        if (await _scheduleQuery.GetCancellationStatusAsync(schedule.ScheduleId, date, ct)
            || await _scheduleQuery.IsDateExcludedAsync(schedule.ScheduleId, date, ct))
        {
            return TerminalWindow(schedule.ScheduleId, date, CheckinStatus.Cancelled, serverTime);
        }

        // step 3：查 CheckinSettlement → 终态（结算记录物化的状态）。
        var settlement = await _db.CheckinSettlements.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ScheduleId == schedule.ScheduleId && s.Date == date, ct);
        if (settlement != null)
            return TerminalWindow(schedule.ScheduleId, date, MapSettlementStatus(settlement.Status), serverTime);

        // step 4/5：按类型推导（课后活动即时逾期 + 日期过期终态 + 默认进行中）。
        var today = DateOnly.FromDateTime(serverTime.Date);
        var (startTime, endTime) = await _scheduleQuery.GetTimeSlotAsync(schedule.ScheduleId, date, ct);

        switch (schedule.ScheduleType)
        {
            case ScheduleType.AfterSchoolActivity:
                if (date < today)
                    return TerminalWindow(schedule.ScheduleId, date, CheckinStatus.Ended, serverTime);
                // 即时逾期仅当天生效（design §3 step 4「date = 今天」），未来日期实例不因今天的 endTime 误判 ended。
                if (date == today && endTime.HasValue && serverTime.DateTime > date.ToDateTime(TimeOnly.MinValue).Add(endTime.Value.ToTimeSpan()).AddHours(2))
                    return TerminalWindow(schedule.ScheduleId, date, CheckinStatus.Ended, serverTime);
                break;

            case ScheduleType.DailyRoutine:
                if (date < today)
                    return TerminalWindow(schedule.ScheduleId, date, CheckinStatus.Incomplete, serverTime);
                break;

            case ScheduleType.HomeworkTask:
                var dueDate = await _scheduleQuery.GetDueDateAsync(schedule.ScheduleId, ct);
                if (dueDate.HasValue && dueDate.Value < today)
                    return TerminalWindow(schedule.ScheduleId, date, CheckinStatus.Overdue, serverTime);
                break;
        }

        // 进行中：提前窗口判定。
        var canCheckin = true;
        int? remainingSeconds = null;
        string? reason = null;

        if (startTime.HasValue)
        {
            // 提前窗口以查询日期 date 为锚（未来日期实例按未来日期的 startTime-30min 计算倒计时）。
            var windowOpen = date.ToDateTime(TimeOnly.MinValue).Add(startTime.Value.ToTimeSpan()).AddMinutes(-30);
            if (serverTime.DateTime < windowOpen)
            {
                canCheckin = false;
                reason = CheckinReason.Early;
                remainingSeconds = (int)Math.Ceiling((windowOpen - serverTime.DateTime).TotalSeconds);
            }
        }

        return new CheckinWindowResponse
        {
            ScheduleId = schedule.ScheduleId,
            Date = date,
            CanCheckin = canCheckin,
            CanUndo = false,
            Reason = reason,
            RemainingSeconds = remainingSeconds,
            Status = CheckinStatus.Incomplete,
            StatusLabel = CheckinStatus.Label(CheckinStatus.Incomplete),
            ServerTime = serverTime
        };
    }

    private async Task<bool> CanUndoAsync(
        ScheduleInfo schedule, DateOnly date, DateTimeOffset serverTime, CancellationToken ct)
    {
        if (await _db.CheckinSettlements.AsNoTracking()
                .AnyAsync(s => s.ScheduleId == schedule.ScheduleId && s.Date == date, ct))
            return false;

        if (date < DateOnly.FromDateTime(serverTime.Date))
            return false;

        if (schedule.ScheduleType == ScheduleType.AfterSchoolActivity)
        {
            var (_, endTime) = await _scheduleQuery.GetTimeSlotAsync(schedule.ScheduleId, date, ct);
            if (endTime.HasValue && serverTime.DateTime > serverTime.Date.Add(endTime.Value.ToTimeSpan()).AddHours(2))
                return false;
        }

        return true;
    }

    private async Task<(ScheduleInfo Schedule, UserRole Role)> GetAccessibleScheduleAsync(
        Guid scheduleId, Guid userId, CancellationToken ct)
    {
        var schedule = await _scheduleQuery.GetScheduleAsync(scheduleId, ct);
        if (schedule == null || schedule.IsDeleted)
            throw new DomainException(ErrorCodes.ScheduleNotFound);

        var role = await _db.FamilyMembers
            .AsNoTracking()
            .Where(fm => fm.UserId == userId && fm.FamilyId == schedule.FamilyId)
            .Select(fm => (UserRole?)fm.Role)
            .FirstOrDefaultAsync(ct);

        if (role == null)
            throw new DomainException(ErrorCodes.NotFamilyMember);

        return (schedule, role.Value);
    }

    private static CheckinWindowResponse TerminalWindow(
        Guid scheduleId, DateOnly date, string status, DateTimeOffset serverTime) => new()
        {
            ScheduleId = scheduleId,
            Date = date,
            CanCheckin = false,
            CanUndo = false,
            Reason = CheckinReason.TerminalState,
            RemainingSeconds = null,
            Status = status,
            StatusLabel = CheckinStatus.Label(status),
            ServerTime = serverTime
        };

    private static string MapSettlementStatus(ScheduleStatus status) => status switch
    {
        ScheduleStatus.Ended => CheckinStatus.Ended,
        ScheduleStatus.Overdue => CheckinStatus.Overdue,
        _ => CheckinStatus.Incomplete
    };

    private static CheckinResponse ToResponse(Domain.Entities.Checkin checkin, Guid scheduleId, DateOnly date, bool alreadyCheckedIn)
        => new()
        {
            CheckinId = checkin.Id,
            ScheduleId = scheduleId,
            Date = date,
            CheckinAt = checkin.CheckinAt.ToOffset(TimeSpan.FromHours(8)),
            Source = checkin.Source.ToString(),
            AlreadyCheckedIn = alreadyCheckedIn ? true : null
        };
}
