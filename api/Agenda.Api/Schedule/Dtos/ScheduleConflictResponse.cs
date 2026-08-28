namespace Agenda.Api.Schedule.Dtos;

public record ScheduleConflictCheckRequest
{
    public Guid? MemberId { get; init; }

    /// <summary>deprecated 兼容字段（V+1 移除），语义同 MemberId。</summary>
    public Guid? ChildId { get; init; }

    public DateOnly Date { get; init; }
    public TimeOnly StartTime { get; init; }
    public TimeOnly EndTime { get; init; }

    /// <summary>归一化：两者都传以 MemberId 为准；仅传 ChildId 归一化为 MemberId；都空返回 null。</summary>
    public Guid? GetEffectiveMemberId() => MemberId ?? ChildId;
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
