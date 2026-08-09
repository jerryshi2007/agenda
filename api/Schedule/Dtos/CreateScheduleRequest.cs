namespace Agenda.Api.Schedule.Dtos;

public record CreateScheduleRequest
{
    public string Name { get; init; } = string.Empty;
    public string ScheduleType { get; init; } = string.Empty;
    public List<Guid> ChildIds { get; init; } = new();
    public List<TimeSlotDto> TimeSlots { get; init; } = new();
    public DateOnly? RepeatEndDate { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }
    public DateOnly? DueDate { get; init; }
    public TimeOnly? SuggestedStartTime { get; init; }
    public TimeOnly? SuggestedEndTime { get; init; }
    public bool IgnoreConflict { get; init; }
}

public record TimeSlotDto
{
    public DayOfWeek DayOfWeek { get; init; }
    public TimeOnly StartTime { get; init; }
    public TimeOnly EndTime { get; init; }
}

public record CreateScheduleResponse
{
    public Guid GroupKey { get; init; }
    public List<ScheduleSummary> Schedules { get; init; } = new();
}

public record ScheduleSummary
{
    public Guid ScheduleId { get; init; }
    public Guid AssignedChildId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string ScheduleType { get; init; } = string.Empty;
    public List<TimeSlotDto> TimeSlots { get; init; } = new();
    public DateOnly? RepeatEndDate { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
