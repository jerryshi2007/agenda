using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 家庭实体。扩展点（add-family-module）：
/// - CreatorId：创建者 UserId
/// - Status：Normal / Dissolved（解散后数据保留 30 天可恢复）
/// - DissolvedAt：解散时间戳
/// </summary>
public class Family
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public Guid CreatorId { get; set; }
    public FamilyStatus Status { get; set; } = FamilyStatus.Normal;
    public DateTimeOffset? DissolvedAt { get; set; }

    public ICollection<DomainFamilyMember> Members { get; set; } = new List<DomainFamilyMember>();
    public ICollection<DomainInvitationCode> InvitationCodes { get; set; } = new List<DomainInvitationCode>();
}
