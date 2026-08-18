using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 家庭成员实体。扩展点（add-family-module）：
/// - ChildName：家庭内孩子姓名覆盖（可空）
/// - DisplayMode：孩子展示模式（家长为 null/Primary 默认）
/// - IsDeleted / DeletedAt：账户注销后 30 天缓冲软删除
/// </summary>
public class FamilyMember
{
    public Guid Id { get; set; }
    public Guid FamilyId { get; set; }
    public Guid UserId { get; set; }
    public UserRole Role { get; set; }
    public DateTimeOffset JoinedAt { get; set; }
    public string? ChildName { get; set; }
    public DisplayMode DisplayMode { get; set; } = DisplayMode.Primary;
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }

    public Family Family { get; set; } = null!;
    public User User { get; set; } = null!;
}
