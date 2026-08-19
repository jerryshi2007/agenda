namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 模板时间槽——Template 的一对多子记录。
/// 每条记录 = (TemplateId, DayOfWeek, StartTime, EndTime)。
/// HomeworkTask 模板无 TimeSlot。DayOfWeek 同 TimeSlot 使用 int 转换。
/// </summary>
public class TemplateTimeSlot
{
    public long Id { get; set; }
    public Guid TemplateId { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }

    public Template Template { get; set; } = null!;
}
