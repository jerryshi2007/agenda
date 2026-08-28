using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Schedule.Services;

/// <summary>
/// Shared helper for deriving schedule instance status.
/// Used by both ScheduleService and CalendarQueryService to avoid duplication (I1).
/// </summary>
public static class ScheduleStatusHelper
{
    public static string DeriveInstanceStatus(Domain.Entities.Schedule schedule, DateOnly date, bool isCancelled, bool isExcluded)
    {
        if (isExcluded) return "excluded";
        if (isCancelled) return "cancelled";
        if (schedule.DueDate.HasValue && date > schedule.DueDate.Value) return "overdue";
        if (schedule.RepeatEndDate.HasValue && date > schedule.RepeatEndDate.Value) return "ended";
        return "incomplete";
    }
}
