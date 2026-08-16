namespace Agenda.Api.Auth.Dtos;

public record UserFamiliesResponse
{
    public List<FamilyInfo> Families { get; init; } = new();
}
