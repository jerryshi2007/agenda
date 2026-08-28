namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 临时取消记录——UNIQUE(ScheduleId, CancelDate)。恢复取消 = 物理删除此记录。
/// </summary>
public class Cancellation
{
    public long Id { get; set; }
    public Guid ScheduleId { get; set; }
    public DateOnly CancelDate { get; set; }
    public Guid CancelledBy { get; set; }
    public DateTimeOffset CancelledAt { get; set; }

    public Schedule Schedule { get; set; } = null!;
}
