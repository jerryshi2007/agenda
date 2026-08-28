namespace Agenda.Api.Schedule.Dtos;

public record CancelScheduleInstanceRequest
{
    public DateOnly Date { get; init; }
}

public record CancelScheduleInstanceResponse
{
    public Guid ScheduleId { get; init; }
    public DateOnly Date { get; init; }
    public bool Cancelled { get; init; }
    public DateTimeOffset CancelledAt { get; init; }
}

public record RestoreScheduleInstanceRequest
{
    public DateOnly Date { get; init; }
}

public record RestoreScheduleInstanceResponse
{
    public Guid ScheduleId { get; init; }
    public DateOnly Date { get; init; }
    public bool Restored { get; init; }
    public string RestoredFrom { get; init; } = string.Empty;
}

public record DeleteScheduleResponse
{
    public bool Deleted { get; init; }
    public string Scope { get; init; } = string.Empty;
    public DateOnly Date { get; init; }
    public string Method { get; init; } = string.Empty;
    public DateOnly? TruncatedRepeatEndDate { get; init; }
}
