using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 打卡记录。虚拟实例模式：以 (ScheduleId, Date) 复合键直接关联日程，无预生成实例表。
/// 无 Status/IsDeleted 字段——打卡 = 创建记录，撤销 = 物理删除记录。
/// 表名映射为 CheckinRecords（对齐 AnonymizationService.AnonymizeCheckinRecordsAsync 的原始 SQL）。
/// </summary>
public class Checkin
{
    public long Id { get; set; }
    public Guid ScheduleId { get; set; }
    public DateOnly Date { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset CheckinAt { get; set; }
    public CheckinSource Source { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
