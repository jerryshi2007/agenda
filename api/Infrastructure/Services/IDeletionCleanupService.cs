namespace Agenda.Api.Infrastructure.Services;

public interface IDeletionCleanupService
{
    Task<int> CleanupExpiredUsersAsync(DateTimeOffset now, CancellationToken ct = default);
}
