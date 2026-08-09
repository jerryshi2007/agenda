namespace Agenda.Api.Schedule.Dtos;

public record ScheduleConflictCheckRequest
{
    public Guid ChildId { get; init; }
    public DateOnly Date { get; init; }
    public TimeOnly StartTime { get; init; }
    public TimeOnly EndTime { get; init; }
}

public record ScheduleConflictResponse
{
    public bool HasConflict { get; init; }
    public List<ConflictItem> Conflicts { get; init; } = new();
}

public record ConflictItem
{
    public Guid ScheduleId { get; init; }
    public string Name { get; init; } = string.Empty;
    public TimeOnly StartTime { get; init; }
    public TimeOnly EndTime { get; init; }
}
