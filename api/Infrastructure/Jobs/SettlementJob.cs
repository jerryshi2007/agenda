using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Domain.Interfaces;
using Agenda.Api.Infrastructure.Data;
using Hangfire;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Infrastructure.Jobs;

/// <summary>
/// 每日结算任务（Hangfire 定时调度，每天 00:05 北京时间）。
/// 处理昨日未打卡实例，写库终态（CheckinSettlement）+ 更新日常作息 streak。
/// 幂等（插入前查重 + UNIQUE 兜底 + LastSettledDate 锚点）、per-child 事务、单 worker 防并发。
/// </summary>
public class SettlementJob
{
    private readonly AppDbContext _db;
    private readonly IScheduleQueryService _scheduleQuery;
    private readonly ILogger<SettlementJob> _logger;

    public SettlementJob(AppDbContext db, IScheduleQueryService scheduleQuery, ILogger<SettlementJob> logger)
    {
        _db = db;
        _scheduleQuery = scheduleQuery;
        _logger = logger;
    }

    [AutomaticRetry(Attempts = 3, OnAttemptsExceeded = AttemptsExceededAction.Fail)]
    public async Task ExecuteAsync(CancellationToken ct)
    {
        // 北京时间昨天（并发安全：只处理昨天，不触碰今天实例）。
        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8).AddDays(-1));

        _logger.LogInformation("Settlement started for {Date}", yesterday);

        // 昨日适用的未删除日程：HomeworkTask 按 DueDate==昨天；其余按昨天 DayOfWeek 匹配 TimeSlot
        // 且重复期未结束（RepeatEndDate==null 或 >= 昨天）。
        // Include(TimeSlots)：生产走 SQL JOIN，同时让 InMemory 单元测试能求值 TimeSlots.Any(...)。
        var schedules = await _db.Schedules
            .Include(e => e.TimeSlots)
            .Where(e => !e.IsDeleted)
            .Where(e =>
                (e.ScheduleType == ScheduleType.HomeworkTask && e.DueDate == yesterday) ||
                (e.ScheduleType != ScheduleType.HomeworkTask &&
                 e.TimeSlots.Any(t => t.DayOfWeek == yesterday.DayOfWeek) &&
                 (e.RepeatEndDate == null || e.RepeatEndDate >= yesterday)))
            .ToListAsync(ct);

        foreach (var childGroup in schedules.GroupBy(e => e.AssignedChildId))
        {
            await using var tx = await _db.Database.BeginTransactionAsync(ct);
            try
            {
                await ProcessChildSettlementAsync(childGroup.Key, childGroup.ToList(), yesterday, ct);
                await tx.CommitAsync(ct);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(ex, "Settlement failed for child {ChildId}", childGroup.Key);
                throw; // Hangfire 自动重试（spec Settlement Error Recovery）
            }
        }

        _logger.LogInformation("Settlement completed for {Date}", yesterday);
    }

    private async Task ProcessChildSettlementAsync(
        Guid childId, List<Domain.Entities.Schedule> schedules, DateOnly date, CancellationToken ct)
    {
        foreach (var schedule in schedules)
        {
            // ① 已打卡 → 已完成，不结算。
            if (await _db.Checkins.AsNoTracking()
                    .AnyAsync(c => c.ScheduleId == schedule.Id && c.Date == date, ct))
                continue;

            // ② 已取消/排除 → 已取消，不结算。
            if (await _scheduleQuery.GetCancellationStatusAsync(schedule.Id, date, ct)
                || await _scheduleQuery.IsDateExcludedAsync(schedule.Id, date, ct))
                continue;

            // ③ 幂等：已结算实例跳过（终态不变）。
            if (await _db.CheckinSettlements.AsNoTracking()
                    .AnyAsync(s => s.ScheduleId == schedule.Id && s.Date == date, ct))
                continue;

            // ④ 计算终态并写库。
            var status = schedule.ScheduleType switch
            {
                ScheduleType.AfterSchoolActivity => ScheduleStatus.Ended,
                ScheduleType.HomeworkTask => ScheduleStatus.Overdue,
                _ => ScheduleStatus.Incomplete
            };

            _db.CheckinSettlements.Add(new CheckinSettlement
            {
                ScheduleId = schedule.Id,
                Date = date,
                Status = status,
                SettledAt = ServerNow()
            });
        }

        await _db.SaveChangesAsync(ct);

        // ⑤ streak 更新（仅日常作息）。
        await UpdateStreaksAsync(childId, schedules, date, ct);
    }

    private async Task UpdateStreaksAsync(
        Guid childId, List<Domain.Entities.Schedule> schedules, DateOnly date, CancellationToken ct)
    {
        var routines = schedules.Where(s => s.ScheduleType == ScheduleType.DailyRoutine).ToList();
        if (routines.Count == 0)
            return;

        var validRoutineCount = 0;
        var completedValidCount = 0;

        foreach (var routine in routines)
        {
            // 已取消/排除实例：单日程与整体 streak 均不变。
            if (await _scheduleQuery.GetCancellationStatusAsync(routine.Id, date, ct)
                || await _scheduleQuery.IsDateExcludedAsync(routine.Id, date, ct))
                continue;

            validRoutineCount++;

            var checkedIn = await _db.Checkins.AsNoTracking()
                .AnyAsync(c => c.ScheduleId == routine.Id && c.Date == date, ct);

            // 单日程 streak：已打卡 +1，未打卡重置 0。
            await UpsertStreakAsync(StreakScope.Schedule, routine.Id, checkedIn, date, ct);

            if (checkedIn)
                completedValidCount++;
        }

        // 孩子整体 streak：全部取消（无有效实例）→ 不变；否则完成 ≥1 → +1，完成 0 → 重置 0。
        if (validRoutineCount == 0)
            return;

        await UpsertStreakAsync(StreakScope.Child, childId, completedValidCount >= 1, date, ct);
        await _db.SaveChangesAsync(ct);
    }

    private async Task UpsertStreakAsync(
        StreakScope scope, Guid subjectId, bool increment, DateOnly date, CancellationToken ct)
    {
        var streak = await _db.Streaks
            .FirstOrDefaultAsync(s => s.Scope == scope && s.SubjectId == subjectId, ct);

        if (streak == null)
        {
            _db.Streaks.Add(new Streak
            {
                Scope = scope,
                SubjectId = subjectId,
                CurrentStreak = increment ? 1 : 0,
                LastSettledDate = date,
                UpdatedAt = ServerNow()
            });
            return;
        }

        // 幂等锚点：同日重复结算跳过（避免连续天数重复累加）。
        if (streak.LastSettledDate == date)
            return;

        streak.CurrentStreak = increment ? streak.CurrentStreak + 1 : 0;
        streak.LastSettledDate = date;
        streak.UpdatedAt = ServerNow();
    }

    /// <summary>服务器北京时间（与 CheckinService 时间基准一致，US-CHK-06）。</summary>
    private static DateTimeOffset ServerNow() =>
        DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(8));
}
