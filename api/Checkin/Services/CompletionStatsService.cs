using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Checkin.Services;

/// <summary>
/// 孩子端完成率统计服务实现。只读（AsNoTracking），
/// 自动按 AssignedChildId == userId 过滤，应用取消/排除规则。
/// </summary>
public class CompletionStatsService : ICompletionStatsService
{
    private readonly AppDbContext _db;

    public CompletionStatsService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(double Percentage, int Completed, int Total)> GetChildWeeklyCompletionRateAsync(
        Guid userId, Guid familyId, DateOnly weekStart, CancellationToken ct = default)
    {
        var weekEnd = weekStart.AddDays(6);

        // 1. 拉取孩子所有未删除日程
        var schedules = await _db.Schedules
            .AsNoTracking()
            .Include(s => s.TimeSlots)
            .Include(s => s.Cancellations)
            .Include(s => s.DateExclusions)
            .Where(s => s.FamilyId == familyId
                        && s.AssignedChildId == userId
                        && !s.IsDeleted)
            .ToListAsync(ct);

        // 2. 拉取本周内这些日程的 Checkin
        var scheduleIds = schedules.Select(s => s.Id).ToList();
        var checkins = await _db.Checkins
            .AsNoTracking()
            .Where(c => scheduleIds.Contains(c.ScheduleId)
                        && c.Date >= weekStart && c.Date <= weekEnd)
            .ToListAsync(ct);
        var checkinSet = checkins
            .GroupBy(c => c.ScheduleId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Date).ToHashSet());

        // 3. 展开周内虚拟实例
        var totalCount = 0;
        var completedCount = 0;

        for (var date = weekStart; date <= weekEnd; date = date.AddDays(1))
        {
            var dayOfWeek = date.DayOfWeek;
            foreach (var schedule in schedules)
            {
                if (!IsScheduleActiveOnDate(schedule, date, dayOfWeek)) continue;

                totalCount++;
                if (checkinSet.TryGetValue(schedule.Id, out var dates) && dates.Contains(date))
                    completedCount++;
            }
        }

        var percentage = totalCount == 0
            ? 0.0
            : Math.Round(completedCount * 100.0 / totalCount, 2);

        return (percentage, completedCount, totalCount);
    }

    /// <summary>判断日程是否在指定日期上有效(应用取消/排除/到期日/单次实例规则)。</summary>
    private static bool IsScheduleActiveOnDate(
        Domain.Entities.Schedule schedule, DateOnly date, DayOfWeek dayOfWeek)
    {
        if (schedule.DateExclusions.Any(d => d.ExcludedDate == date))
            return false;

        if (schedule.Cancellations.Any(c => c.CancelDate == date))
            return false;

        if (schedule.ScheduleType == ScheduleType.HomeworkTask)
            return schedule.DueDate == date;

        if (schedule.SourceScheduleId.HasValue)
            return schedule.OverrideDate == date;

        if (!schedule.TimeSlots.Any(t => t.DayOfWeek == dayOfWeek))
            return false;

        if (schedule.RepeatEndDate.HasValue && date > schedule.RepeatEndDate.Value)
            return false;

        return true;
    }
}
