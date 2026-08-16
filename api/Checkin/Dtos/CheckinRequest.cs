namespace Agenda.Api.Checkin.Dtos;

/// <summary>
/// 打卡请求。字段与 openspec/contracts/checkin/dto.json CheckinRequest 对齐。
/// </summary>
public class CheckinRequest
{
    public Guid ScheduleId { get; set; }
    public DateOnly Date { get; set; }
}
