using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 邀请码实体。6 位数字（仅 2-9），24h 有效，一次性，可撤销。
/// - TargetRole：邀请目标角色（家长/孩子）
/// - TargetChildName / TargetDisplayMode：仅当邀请孩子时使用
/// - CreatorId：邀请人 UserId（仅本人可撤销）
/// - Status：Pending / Used / Redeemed；Expired 在查询时动态判定
/// </summary>
public class InvitationCode
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public Guid FamilyId { get; set; }
    public UserRole TargetRole { get; set; }
    public string? TargetChildName { get; set; }
    public DisplayMode? TargetDisplayMode { get; set; }
    public Guid CreatorId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public InvitationCodeStatus Status { get; set; } = InvitationCodeStatus.Pending;

    public Family Family { get; set; } = null!;
    public User Creator { get; set; } = null!;
}
