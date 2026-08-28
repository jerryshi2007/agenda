using Agenda.Api.Domain;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Infrastructure.Services;

/// <summary>
/// 注销缓冲期到期的用户物理删除。每日凌晨 3 点执行一次。
/// </summary>
public class DeletionCleanupService : BackgroundService, IDeletionCleanupService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DeletionCleanupService> _logger;

    public DeletionCleanupService(IServiceScopeFactory scopeFactory, ILogger<DeletionCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeUntilNextRun(), stoppingToken);
            try
            {
                var count = await CleanupExpiredUsersAsync(DateTimeOffset.UtcNow, stoppingToken);
                _logger.LogInformation("Deletion cleanup removed {Count} expired users", count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Deletion cleanup failed");
            }
        }
    }

    public async Task<int> CleanupExpiredUsersAsync(DateTimeOffset now, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var anonymization = scope.ServiceProvider.GetRequiredService<IAnonymizationService>();
        var avatarStorage = scope.ServiceProvider.GetRequiredService<IAvatarStorageService>();

        var cutoff = now.Add(-DeletionPolicy.GracePeriod);
        var expired = await db.Users
            .Where(u => u.Status == UserStatus.Deleted && u.DeletedAt != null && u.DeletedAt < cutoff)
            .ToListAsync(ct);

        foreach (var user in expired)
        {
            await anonymization.AnonymizeCheckinRecordsAsync(user.Id, ct);
            await avatarStorage.DeleteAsync(user.Id, ct);
            db.Users.Remove(user);
        }

        await db.SaveChangesAsync(ct);
        return expired.Count;
    }

    private static TimeSpan TimeUntilNextRun()
    {
        var now = DateTimeOffset.UtcNow;
        var next = now.Date.AddHours(3);
        if (next <= now)
            next = next.AddDays(1);
        return next - now;
    }
}
