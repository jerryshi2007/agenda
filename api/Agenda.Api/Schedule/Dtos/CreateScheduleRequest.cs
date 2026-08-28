namespace Agenda.Api.Schedule.Dtos;

public record CreateScheduleRequest
{
    public string Name { get; init; } = string.Empty;
    public string ScheduleType { get; init; } = string.Empty;
    public List<Guid> MemberIds { get; init; } = new();

    /// <summary>deprecated 兼容字段（V+1 移除），语义同 MemberIds。</summary>
    public List<Guid> ChildIds { get; init; } = new();

    public List<TimeSlotDto> TimeSlots { get; init; } = new();
    public DateOnly? RepeatEndDate { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }
    public DateOnly? DueDate { get; init; }
    public TimeOnly? SuggestedStartTime { get; init; }
    public TimeOnly? SuggestedEndTime { get; init; }
    public bool IgnoreConflict { get; init; }

    /// <summary>衍生来源模板 ID（从模板生成时设置；为 null 时不设置）</summary>
    public Guid? SourceTemplateId { get; init; }

    /// <summary>归一化：两者都传以 MemberIds 为准；仅传 ChildIds 归一化为 MemberIds；都空返回空列表。</summary>
    public List<Guid> GetEffectiveMemberIds() => MemberIds.Count > 0 ? MemberIds : ChildIds;
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
    public Guid AssignedMemberId { get; init; }

    /// <summary>deprecated 兼容字段（V+1 移除），值与 AssignedMemberId 相同。</summary>
    public Guid AssignedChildId { get; init; }

    /// <summary>关联成员角色（Parent/Child），用于前端双文案 label 渲染。</summary>
    public string AssignedMemberRole { get; init; } = string.Empty;

    /// <summary>关联成员昵称，便于列表/创建响应直接渲染成员名。</summary>
    public string? AssignedMemberName { get; init; }

    public string Name { get; init; } = string.Empty;
    public string ScheduleType { get; init; } = string.Empty;
    public List<TimeSlotDto> TimeSlots { get; init; } = new();
    public DateOnly? RepeatEndDate { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
