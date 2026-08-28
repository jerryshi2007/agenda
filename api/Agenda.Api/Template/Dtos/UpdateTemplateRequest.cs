namespace Agenda.Api.Template.Dtos;

/// <summary>
/// 更新模板请求。scheduleType 在创建后不可变，故不包含此字段。
/// TimeSlots 为必填（可能为空数组表示 HomeworkTask）。
/// </summary>
public record UpdateTemplateRequest
{
    public string Name { get; init; } = string.Empty;
    public List<TemplateTimeSlotDto> TimeSlots { get; init; } = new();
    public DateOnly? RepeatEndDate { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }
}
