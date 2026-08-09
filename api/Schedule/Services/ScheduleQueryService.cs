using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Interfaces;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Schedule.Services;

/// <summary>
/// IScheduleQueryService 实现——供 checkin-module 调用，提供 Schedule 基础信息。
/// ADR-017：依赖反转——checkin 模块定义接口，Schedule 模块实现。
/// </summary>
public class ScheduleQueryService : IScheduleQueryService
{
    private readonly AppDbContext _db;

    public ScheduleQueryService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ScheduleInfo?> GetScheduleAsync(Guid scheduleId, CancellationToken ct = default)
    {
        var schedule = await _db.Schedules
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == scheduleId, ct);

        if (schedule == null) return null;

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

    public async Task<(TimeOnly? StartTime, TimeOnly? EndTime)> GetTimeSlotAsync(
        Guid scheduleId, DateOnly date, CancellationToken ct = default)
    {
        var schedule = await _db.Schedules
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == scheduleId, ct);

        if (schedule == null) return (null, null);

        if (schedule.ScheduleType == Domain.Enums.ScheduleType.HomeworkTask)
            return (schedule.SuggestedStartTime, schedule.SuggestedEndTime);

        var dayOfWeek = date.DayOfWeek;
        var slot = await _db.TimeSlots
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.ScheduleId == scheduleId && t.DayOfWeek == dayOfWeek, ct);

        return slot != null ? (slot.StartTime, slot.EndTime) : (null, null);
    }

    public async Task<bool> GetCancellationStatusAsync(Guid scheduleId, DateOnly date, CancellationToken ct = default)
    {
        return await _db.Cancellations
            .AsNoTracking()
            .AnyAsync(c => c.ScheduleId == scheduleId && c.CancelDate == date, ct);
    }

    public async Task<bool> IsDateExcludedAsync(Guid scheduleId, DateOnly date, CancellationToken ct = default)
    {
        return await _db.ScheduleDateExclusions
            .AsNoTracking()
            .AnyAsync(d => d.ScheduleId == scheduleId && d.ExcludedDate == date, ct);
    }

    public async Task<DateOnly?> GetDueDateAsync(Guid scheduleId, CancellationToken ct = default)
    {
        var schedule = await _db.Schedules
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == scheduleId, ct);

        return schedule?.DueDate;
    }
}
