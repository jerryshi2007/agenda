namespace Agenda.Api.Auth.Dtos;

public record RecoverResponse
{
    public string Jwt { get; init; } = string.Empty;
    public Guid UserId { get; init; }
}
