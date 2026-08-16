using System.Text.Json.Serialization;

namespace Agenda.Api.Checkin.Dtos;

/// <summary>
/// 打卡响应。字段与 openspec/contracts/checkin/dto.json CheckinResponse 对齐。
/// alreadyCheckedIn 仅在幂等命中时为 true（正常成功响应缺省该字段，见 dto.json「可缺省」）。
/// </summary>
public class CheckinResponse
{
    public long CheckinId { get; set; }
    public Guid ScheduleId { get; set; }
    public DateOnly Date { get; set; }
    public DateTimeOffset CheckinAt { get; set; }
    public string Source { get; set; } = string.Empty;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? AlreadyCheckedIn { get; set; }
}
