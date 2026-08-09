namespace Agenda.Api.Schedule.Dtos;

public record UpdateScheduleRequest
{
    public string? Scope { get; init; }
    public DateOnly? Date { get; init; }
    public string? Name { get; init; }
    public List<TimeSlotDto>? TimeSlots { get; init; }
    public DateOnly? RepeatEndDate { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }
    public DateOnly? DueDate { get; init; }
    public TimeOnly? SuggestedStartTime { get; init; }
    public TimeOnly? SuggestedEndTime { get; init; }
    public byte[]? RowVersion { get; init; }
}

public record UpdateScheduleResponse
{
    public Guid ScheduleId { get; init; }
    public string Scope { get; init; } = string.Empty;
    public bool Updated { get; init; }
}
