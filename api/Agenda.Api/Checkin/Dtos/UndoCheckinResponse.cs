namespace Agenda.Api.Checkin.Dtos;

/// <summary>
/// 撤销打卡响应。字段与 openspec/contracts/checkin/dto.json UndoCheckinResponse 对齐。
/// </summary>
public class UndoCheckinResponse
{
    public Guid ScheduleId { get; set; }
    public DateOnly Date { get; set; }
    public bool Undone { get; set; }
    public string Status { get; set; } = string.Empty;
}
