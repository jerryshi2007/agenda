using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Entities;

public class User
{
    public const string DefaultNickname = "微信用户";

    public Guid Id { get; set; }
    public string OpenId { get; set; } = string.Empty;
    public string Nickname { get; set; } = DefaultNickname;
    public string? AvatarUrl { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;
    public UserRole Role { get; set; } = UserRole.Parent;
    public DateTimeOffset? DeletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset LastLoginAt { get; set; }
}
