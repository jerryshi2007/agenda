namespace Agenda.Api.Template.Dtos;

/// <summary>
/// 模板时间槽 DTO——与 TimeSlotDto 同构，独立类型避免跨模块耦合。
/// DayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday。
/// </summary>
public record TemplateTimeSlotDto
{
    public DayOfWeek DayOfWeek { get; init; }
    public TimeOnly StartTime { get; init; }
    public TimeOnly EndTime { get; init; }
}
