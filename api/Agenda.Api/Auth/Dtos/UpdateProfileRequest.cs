namespace Agenda.Api.Auth.Dtos;

public record UpdateProfileRequest
{
    public string Nickname { get; init; } = string.Empty;
    public string? AvatarUrl { get; init; }
}
