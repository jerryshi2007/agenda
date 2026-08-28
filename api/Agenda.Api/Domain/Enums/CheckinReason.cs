namespace Agenda.Api.Domain.Enums;

/// <summary>
/// 打卡窗口「不可打卡原因」取值（CheckinWindowResponse.reason 字段）。
/// 取值约定见 openspec/contracts/checkin/dto.json，禁止在业务代码中硬编码。
/// </summary>
public static class CheckinReason
{
    public const string Early = "EARLY";
    public const string TerminalState = "TERMINAL_STATE";
    public const string CheckinWindowClosed = "CHECKIN_WINDOW_CLOSED";
}
