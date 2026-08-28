namespace Agenda.Api.Auth.Dtos;

public record DeletionStatusResponse
{
    public bool IsDeleted { get; init; }
    public bool CanDelete { get; init; }
    public string? BlockReason { get; init; }
    public DateTimeOffset? ExpiresAt { get; init; }
    public int? RemainingDays { get; init; }
}
