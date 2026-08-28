namespace Agenda.Api.Auth.Dtos;

public record LoginResponse
{
    public string Jwt { get; init; } = string.Empty;
    public Guid UserId { get; init; }
    public bool IsNewUser { get; init; }
    public bool NeedsProfileCollection { get; init; }
    public bool? IsDeleted { get; init; }
    public int? RemainingDays { get; init; }
}
