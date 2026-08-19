namespace Agenda.Api.Template.Dtos;

/// <summary>
/// 从模板生成日程请求。所有覆盖字段均为 nullable，未传则使用模板默认值。
/// </summary>
public record ApplyTemplateRequest
{
    public Guid ChildId { get; init; }
    public DateOnly StartDate { get; init; }
    public string? Name { get; init; }
    public List<TemplateTimeSlotDto>? TimeSlots { get; init; }
    public DateOnly? RepeatEndDate { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }
}
