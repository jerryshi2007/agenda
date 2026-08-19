namespace Agenda.Api.Template.Dtos;

/// <summary>
/// 模板详情——包含完整字段 + usageCount（被使用生成的日程数）。
/// </summary>
public record TemplateDetail
{
    public Guid TemplateId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string ScheduleType { get; init; } = string.Empty;
    public bool IsPreset { get; init; }
    public Guid CreatedBy { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public List<TemplateTimeSlotDto> TimeSlots { get; init; } = new();
    public DateOnly? RepeatEndDate { get; init; }
    public string? Location { get; init; }
    public string? Notes { get; init; }
    public int UsageCount { get; init; }
}
