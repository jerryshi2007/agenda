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
    public Guid AssignedMemberId { get; init; }

    /// <summary>deprecated 兼容字段（V+1 移除），值与 AssignedMemberId 相同。</summary>
    public Guid AssignedChildId { get; init; }

    /// <summary>关联成员角色（Parent/Child），用于前端双文案 label 渲染。</summary>
    public string AssignedMemberRole { get; init; } = string.Empty;

    /// <summary>关联成员昵称，便于详情直接渲染成员名。</summary>
    public string? AssignedMemberName { get; init; }
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
