namespace Agenda.Api.Auth.Dtos;

public record ProfileResponse
{
    public Guid UserId { get; init; }
    public string Nickname { get; init; } = string.Empty;
    public string? AvatarUrl { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
