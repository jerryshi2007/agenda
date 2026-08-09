using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Schedule.Services;

public class CalendarQueryService : ICalendarQueryService
{
    private readonly AppDbContext _db;

    private static readonly Dictionary<string, string> ScheduleTypeColors = new()
    {
        { "AfterSchoolActivity", "blue" },
        { "DailyRoutine", "green" },
        { "HomeworkTask", "orange" }
    };

    public CalendarQueryService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<CalendarResponse> QueryAsync(
        CalendarQueryRequest request, Guid familyId, CancellationToken ct = default)
    {
        var view = request.View.ToLowerInvariant();
        var dateRangeDays = (request.EndDate.DayNumber - request.StartDate.DayNumber);
        if (dateRangeDays > 90)
            throw new InvalidOperationException("DATE_RANGE_TOO_LARGE");

        // Build base query with date range pre-filtering (IM-2)
        var query = _db.Schedules
            .Include(s => s.TimeSlots)
            .Include(s => s.Cancellations)
            .Include(s => s.DateExclusions)
            .Where(s => s.FamilyId == familyId && !s.IsDeleted);

        // Apply filters
        if (request.ChildId.HasValue)
            query = query.Where(s => s.AssignedChildId == request.ChildId.Value);

        if (request.ScheduleTypes?.Count > 0)
        {
            var types = request.ScheduleTypes
                .Select(t => Enum.Parse<ScheduleType>(t))
                .ToList();
            query = query.Where(s => types.Contains(s.ScheduleType));
        }

        // Date range pre-filter: only load schedules that could appear in the date range
        // - Regular schedules: RepeatEndDate is null (indefinite) or >= startDate
        // - Derivative schedules: always load (they have OverrideDate checked in memory)
        // - Homework tasks: DueDate within or after range
        query = query.Where(s =>
            s.SourceScheduleId.HasValue // derivative single-instance — check OverrideDate in memory
            || s.ScheduleType == ScheduleType.HomeworkTask && s.DueDate >= request.StartDate
            || (s.RepeatEndDate == null || s.RepeatEndDate >= request.StartDate)
        );

        var schedules = await query.AsNoTracking().ToListAsync(ct);

        // Resolve child names and avatars in a single batch (IM-5)
        var childIds = schedules.Select(s => s.AssignedChildId).Distinct().ToList();
        var users = await _db.Users
            .AsNoTracking()
            .Where(u => childIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u, ct);

        // Virtual instance expansion (ADR-015)
        var dates = new List<CalendarDate>();
        var totalScheduleCount = 0;

        for (var date = request.StartDate; date <= request.EndDate; date = date.AddDays(1))
        {
            var dayOfWeek = date.DayOfWeek;
            var matchedSchedules = ExpandVirtualInstances(schedules, date, dayOfWeek);
            totalScheduleCount += matchedSchedules.Count;

            var calendarDate = new CalendarDate
            {
                Date = date,
                ScheduleCount = matchedSchedules.Count,
                Dots = new List<CalendarDot>(),
                Schedules = new List<CalendarSchedule>()
            };

            // Dots: unique schedule types on this day
            var uniqueTypes = matchedSchedules
                .Select(s => s.ScheduleType.ToString())
                .Distinct()
                .ToList();

            foreach (var type in uniqueTypes)
            {
                calendarDate.Dots.Add(new CalendarDot
                {
                    ScheduleType = type,
                    Color = ScheduleTypeColors.GetValueOrDefault(type, "gray")
                });
            }

            // Schedule details by view
            if (view == "week" || view == "day")
            {
                calendarDate.Schedules = matchedSchedules.Select(s =>
                {
                    var isCancelled = s.Cancellations.Any(c => c.CancelDate == date);
                    var isExcluded = s.DateExclusions.Any(d => d.ExcludedDate == date);
                    var status = ScheduleStatusHelper.DeriveInstanceStatus(s, date, isCancelled, isExcluded);

                    var slot = s.TimeSlots.FirstOrDefault(t => t.DayOfWeek == dayOfWeek);
                    users.TryGetValue(s.AssignedChildId, out var childUser);

                    var calSchedule = new CalendarSchedule
                    {
                        ScheduleId = s.Id,
                        Name = s.Name,
                        ScheduleType = s.ScheduleType.ToString(),
                        StartTime = slot?.StartTime,
                        EndTime = slot?.EndTime,
                        Status = status,
                        ChildName = childUser?.Nickname,
                        ChildAvatarUrl = childUser?.AvatarUrl
                    };

                    if (view == "day")
                    {
                        calSchedule.Location = s.Location ?? "";
                        calSchedule.Notes = s.Notes ?? "";
                        calSchedule.DueDate = s.DueDate;
                        calSchedule.SuggestedStartTime = s.SuggestedStartTime;
                        calSchedule.SuggestedEndTime = s.SuggestedEndTime;
                    }

                    return calSchedule;
                }).ToList();
            }

            dates.Add(calendarDate);
        }

        return new CalendarResponse
        {
            View = view,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            TotalScheduleCount = totalScheduleCount,
            Dates = dates
        };
    }

    private static List<Domain.Entities.Schedule> ExpandVirtualInstances(
        List<Domain.Entities.Schedule> schedules, DateOnly date, DayOfWeek dayOfWeek)
    {
        return schedules.Where(s =>
        {
            // Homework task: show on due date
            if (s.ScheduleType == ScheduleType.HomeworkTask)
                return s.DueDate == date;

            // Derivative schedule (single instance from ThisOnly edit) — check OverrideDate (IM-7)
            if (s.SourceScheduleId.HasValue)
                return s.OverrideDate == date;

            // Regular repeated schedule
            // Check if this day matches a time slot
            var hasSlot = s.TimeSlots.Any(t => t.DayOfWeek == dayOfWeek);
            if (!hasSlot) return false;

            // Check date range
            if (s.RepeatEndDate.HasValue && date > s.RepeatEndDate.Value)
                return false;

            // Check exclusion
            var isExcluded = s.DateExclusions.Any(d => d.ExcludedDate == date);
            if (isExcluded) return false;

            return true;
        }).ToList();
    }
}
