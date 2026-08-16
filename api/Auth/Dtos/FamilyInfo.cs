namespace Agenda.Api.Auth.Dtos;

public record FamilyInfo
{
    public Guid FamilyId { get; init; }
    public string FamilyName { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public int MemberCount { get; init; }
}
