namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 时间槽——Schedule 的一对多子记录。ADDR-016：每条记录 = (ScheduleId, DayOfWeek, StartTime, EndTime)。
/// 仅存储有安排的天，无记录的天 = 无安排。作业任务无 TimeSlot。
/// </summary>
public class TimeSlot
{
    public long Id { get; set; }
    public Guid ScheduleId { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }

    public Schedule Schedule { get; set; } = null!;
}
