namespace Agenda.Api.Template.Dtos;

/// <summary>
/// 创建模板请求。scheduleType 决定 timeSlots 校验规则。
/// </summary>
public record CreateTemplateRequest
{
    public string Name { get; init; } = string.Empty;
    public string ScheduleType { get; init; } = string.Empty;
    public List<TemplateTimeSlotDto> TimeSlots { get; init; } = new();
    public DateOnly? RepeatEndDate { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }
}
