namespace Agenda.Api.Auth.Dtos;

public record RefreshRequest
{
    public string Code { get; init; } = string.Empty;
}
