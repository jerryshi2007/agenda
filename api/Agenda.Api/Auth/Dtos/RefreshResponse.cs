namespace Agenda.Api.Auth.Dtos;

public record RefreshResponse
{
    public string Jwt { get; init; } = string.Empty;
    public Guid UserId { get; init; }
}
