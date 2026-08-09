using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Entities;

public class FamilyMember
{
    public Guid Id { get; set; }
    public Guid FamilyId { get; set; }
    public Guid UserId { get; set; }
    public UserRole Role { get; set; }
    public DateTimeOffset JoinedAt { get; set; }

    public Family Family { get; set; } = null!;
    public User User { get; set; } = null!;
}
