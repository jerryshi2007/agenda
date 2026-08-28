using Agenda.Api.Domain.Entities;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Infrastructure;
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

    public async Task<ScheduleConflictResponse> CheckConflictAsync(Guid familyId, ScheduleConflictCheckRequest request, CancellationToken ct = default)
    {
        var memberId = request.GetEffectiveMemberId();
        if (!memberId.HasValue)
            throw new InvalidOperationException(ErrorCodes.MemberNotSelected);

        var dayOfWeek = request.Date.DayOfWeek;

        // Find events for the same member on the same day of week with overlapping times,
        // scoped to the caller's family (prevents cross-family IDOR).
        var conflictingEvents = await _db.Schedules
            .Include(e => e.TimeSlots)
            .Where(e => e.FamilyId == familyId
                        && e.AssignedMemberId == memberId.Value
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
