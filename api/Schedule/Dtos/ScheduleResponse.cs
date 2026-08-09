namespace Agenda.Api.Schedule.Dtos;

public record ScheduleResponse
{
    public Guid ScheduleId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string ScheduleType { get; init; } = string.Empty;
    public DateOnly Date { get; init; }
    public List<TimeSlotDto> TimeSlots { get; init; } = new();
    public DateOnly? RepeatEndDate { get; init; }
    public string? RepeatRule { get; init; }
    public string? Location { get; init; }
    public Guid AssignedChildId { get; init; }
    public string? AssignedChildName { get; init; }
    public string? Notes { get; init; }
    public string InstanceStatus { get; init; } = string.Empty;
    public bool IsCancelled { get; init; }
    public bool IsExcluded { get; init; }
    public List<object> CheckinRecords { get; init; } = new();
    public bool CanEdit { get; init; }
    public bool CanCancel { get; init; }
    public bool CanDelete { get; init; }
    public bool CanCheckin { get; init; }
    public bool CanUndo { get; init; }
    public string? RowVersion { get; init; }
    public DateOnly? DueDate { get; init; }
    public TimeOnly? SuggestedStartTime { get; init; }
    public TimeOnly? SuggestedEndTime { get; init; }
}
