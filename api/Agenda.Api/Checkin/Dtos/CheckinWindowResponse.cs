namespace Agenda.Api.Checkin.Dtos;

/// <summary>
/// 打卡窗口查询响应。字段与 openspec/contracts/checkin/dto.json CheckinWindowResponse 对齐。
/// </summary>
public class CheckinWindowResponse
{
    public Guid ScheduleId { get; set; }
    public DateOnly Date { get; set; }
    public bool CanCheckin { get; set; }
    public bool CanUndo { get; set; }
    public string? Reason { get; set; }
    public int? RemainingSeconds { get; set; }
    public string Status { get; set; } = string.Empty;
    public string StatusLabel { get; set; } = string.Empty;
    public DateTimeOffset ServerTime { get; set; }
}
