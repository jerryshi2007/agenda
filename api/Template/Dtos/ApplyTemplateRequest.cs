namespace Agenda.Api.Template.Dtos;

/// <summary>
/// 从模板生成日程请求。所有覆盖字段均为 nullable，未传则使用模板默认值。
/// </summary>
public record ApplyTemplateRequest
{
    public List<Guid> MemberIds { get; init; } = new();

    /// <summary>deprecated 兼容字段（V+1 移除），语义同 MemberIds 单选。</summary>
    public Guid? ChildId { get; init; }

    public DateOnly StartDate { get; init; }
    public string? Name { get; init; }
    public List<TemplateTimeSlotDto>? TimeSlots { get; init; }
    public DateOnly? RepeatEndDate { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }

    /// <summary>归一化：两者都传以 MemberIds 为准；仅传 ChildId 归一化为单元素 MemberIds；都空返回空列表。</summary>
    public List<Guid> GetEffectiveMemberIds() =>
        MemberIds.Count > 0
            ? MemberIds
            : ChildId.HasValue ? new List<Guid> { ChildId.Value } : new List<Guid>();
}
