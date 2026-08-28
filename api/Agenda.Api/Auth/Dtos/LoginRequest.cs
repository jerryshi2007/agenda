namespace Agenda.Api.Auth.Dtos;

public record LoginRequest
{
    public string Code { get; init; } = string.Empty;
}
