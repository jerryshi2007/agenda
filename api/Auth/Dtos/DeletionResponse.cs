namespace Agenda.Api.Auth.Dtos;

public record DeletionResponse
{
    public DateTimeOffset ExpiresAt { get; init; }
    public int RemainingDays { get; init; }
}
