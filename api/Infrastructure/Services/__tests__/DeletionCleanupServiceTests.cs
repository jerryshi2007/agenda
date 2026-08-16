using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Infrastructure.Services;
using Agenda.Api.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Agenda.Api.Infrastructure.Services.Tests;

public class DeletionCleanupServiceTests
{
    private static int _dbCounter;

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"CleanupTest_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static User NewUser(string openId, UserStatus status, DateTimeOffset? deletedAt, DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(),
        OpenId = openId,
        Status = status,
        DeletedAt = deletedAt,
        CreatedAt = now,
        LastLoginAt = now
    };

    private static DeletionCleanupService CreateService(
        AppDbContext db,
        Mock<IAnonymizationService> anonymization,
        Mock<IAvatarStorageService> avatarStorage)
        => new(new StubScopeFactory(db, anonymization.Object, avatarStorage.Object), NullLogger<DeletionCleanupService>.Instance);

    [Fact]
    public async Task CleanupExpiredUsersAsync_RemovesOnlyExpiredDeletedUsers()
    {
        var db = CreateDbContext();
        var anonymization = new Mock<IAnonymizationService>();
        var avatarStorage = new Mock<IAvatarStorageService>();
        var now = DateTimeOffset.UtcNow;
        var expired = NewUser("e", UserStatus.Deleted, now.AddDays(-31), now);
        var notExpired = NewUser("n", UserStatus.Deleted, now.AddDays(-10), now);
        var active = NewUser("a", UserStatus.Active, null, now);
        db.Users.AddRange(expired, notExpired, active);
        await db.SaveChangesAsync();

        var service = CreateService(db, anonymization, avatarStorage);
        var count = await service.CleanupExpiredUsersAsync(now);

        Assert.Equal(1, count);
        var remaining = await db.Users.ToListAsync();
        Assert.Equal(2, remaining.Count);
        Assert.DoesNotContain(remaining, u => u.Id == expired.Id);
        Assert.Contains(remaining, u => u.Id == active.Id);
        Assert.Contains(remaining, u => u.Id == notExpired.Id);
    }

    [Fact]
    public async Task CleanupExpiredUsersAsync_CallsAnonymizationBeforeDelete()
    {
        var db = CreateDbContext();
        var anonymization = new Mock<IAnonymizationService>();
        var avatarStorage = new Mock<IAvatarStorageService>();
        var now = DateTimeOffset.UtcNow;
        var expired = NewUser("e", UserStatus.Deleted, now.AddDays(-31), now);
        db.Users.Add(expired);
        await db.SaveChangesAsync();

        var service = CreateService(db, anonymization, avatarStorage);
        await service.CleanupExpiredUsersAsync(now);

        anonymization.Verify(
            a => a.AnonymizeCheckinRecordsAsync(expired.Id, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task CleanupExpiredUsersAsync_DeletesAvatarFile()
    {
        var db = CreateDbContext();
        var anonymization = new Mock<IAnonymizationService>();
        var avatarStorage = new Mock<IAvatarStorageService>();
        var now = DateTimeOffset.UtcNow;
        var expired = NewUser("e", UserStatus.Deleted, now.AddDays(-31), now);
        db.Users.Add(expired);
        await db.SaveChangesAsync();

        var service = CreateService(db, anonymization, avatarStorage);
        await service.CleanupExpiredUsersAsync(now);

        avatarStorage.Verify(
            a => a.DeleteAsync(expired.Id, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private sealed class StubScopeFactory : IServiceScopeFactory
    {
        private readonly AppDbContext _db;
        private readonly IAnonymizationService _anonymization;
        private readonly IAvatarStorageService _avatarStorage;

        public StubScopeFactory(AppDbContext db, IAnonymizationService anonymization, IAvatarStorageService avatarStorage)
        {
            _db = db;
            _anonymization = anonymization;
            _avatarStorage = avatarStorage;
        }

        public IServiceScope CreateScope() => new StubScope(_db, _anonymization, _avatarStorage);
    }

    private sealed class StubScope : IServiceScope
    {
        public StubScope(AppDbContext db, IAnonymizationService anonymization, IAvatarStorageService avatarStorage)
        {
            ServiceProvider = new StubServiceProvider(db, anonymization, avatarStorage);
        }

        public IServiceProvider ServiceProvider { get; }

        public void Dispose() { }
    }

    private sealed class StubServiceProvider : IServiceProvider
    {
        private readonly Dictionary<Type, object> _services;

        public StubServiceProvider(AppDbContext db, IAnonymizationService anonymization, IAvatarStorageService avatarStorage)
        {
            _services = new Dictionary<Type, object>
            {
                [typeof(AppDbContext)] = db,
                [typeof(IAnonymizationService)] = anonymization,
                [typeof(IAvatarStorageService)] = avatarStorage
            };
        }

        public object? GetService(Type serviceType)
            => _services.TryGetValue(serviceType, out var service) ? service : null;
    }
}
