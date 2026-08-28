using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 结算记录——结算任务写库的终态锚点。记录存在即实例已终态。
/// Status 复用 ScheduleStatus，只写 Ended（课后活动）/ Overdue（作业任务）/ Incomplete（日常作息）三种终态。
/// </summary>
public class CheckinSettlement
{
    public long Id { get; set; }
    public Guid ScheduleId { get; set; }
    public DateOnly Date { get; set; }
    public ScheduleStatus Status { get; set; }
    public DateTimeOffset SettledAt { get; set; }
}
