using Agenda.Api.Domain.Entities;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Schedule.Services;

public class ConflictDetectionService : IConflictDetectionService
{
    private readonly AppDbContext _db;

    public ConflictDetectionService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ScheduleConflictResponse> CheckConflictAsync(ScheduleConflictCheckRequest request, CancellationToken ct = default)
    {
        var dayOfWeek = request.Date.DayOfWeek;

        // Find events for the same child on the same day of week with overlapping times
        var conflictingEvents = await _db.Schedules
            .Include(e => e.TimeSlots)
            .Where(e => e.AssignedChildId == request.ChildId
                        && !e.IsDeleted
                        && e.TimeSlots.Any(t => t.DayOfWeek == dayOfWeek
                            && t.StartTime < request.EndTime
                            && t.EndTime > request.StartTime))
            .AsNoTracking()
            .ToListAsync(ct);

        if (conflictingEvents.Count == 0)
            return new ScheduleConflictResponse { HasConflict = false };

        var conflicts = conflictingEvents.Select(e =>
        {
            var overlappingSlot = e.TimeSlots.First(t =>
                t.DayOfWeek == dayOfWeek &&
                t.StartTime < request.EndTime &&
                t.EndTime > request.StartTime);
            return new ConflictItem
            {
                ScheduleId = e.Id,
                Name = e.Name,
                StartTime = overlappingSlot.StartTime,
                EndTime = overlappingSlot.EndTime
            };
        }).ToList();

        return new ScheduleConflictResponse { HasConflict = true, Conflicts = conflicts };
    }
}
