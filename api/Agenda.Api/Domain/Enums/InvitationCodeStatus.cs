namespace Agenda.Api.Domain.Enums;

/// <summary>
/// 邀请码状态机。值与 openspec/contracts/family/enums.json InvitationCodeStatus 对齐。
/// 状态机：Pending → Used（被使用）/ Revoked（被撤销）/ Expired（查询时动态判定）。
/// </summary>
public enum InvitationCodeStatus
{
    Pending = 1,
    Used = 2,
    Revoked = 3,
    Expired = 4
}
