namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 日期排除标记——ADDR-020："仅本次"删除操作产生的排除记录。UNIQUE(ScheduleId, ExcludedDate)。
/// 恢复（撤销删除）= 物理删除此记录。
/// </summary>
public class ScheduleDateExclusion
{
    public long Id { get; set; }
    public Guid ScheduleId { get; set; }
    public DateOnly ExcludedDate { get; set; }
    public Guid ExcludedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Schedule Schedule { get; set; } = null!;
}
