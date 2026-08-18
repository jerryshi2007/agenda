using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Family.Services;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Agenda.Api.Family.Tests;

/// <summary>
/// 家庭清理服务测试。覆盖 GWT 场景：
/// - TC-FL-09：已注销成员超过 30 天物理删除
/// - TC-FM-06：已注销创建者 30 天后自动转让给最早家长 / 无家长则自动解散
/// - 已解散家庭超过 30 天物理删除
/// </summary>
public class FamilyCleanupServiceTests
{
    private static int _dbCounter;

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"FamilyCleanup_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static async Task<User> SeedUserAsync(
        AppDbContext db, UserRole role = UserRole.Parent, UserStatus status = UserStatus.Active,
        DateTimeOffset? deletedAt = null, string nickname = "用户")
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = nickname,
            Status = status,
            Role = role,
            DeletedAt = deletedAt,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static async Task<(DomainFamily family, User creator)> SeedFamilyAsync(
        AppDbContext db, string name = "我们家", DateTimeOffset? dissolvedAt = null,
        FamilyStatus status = FamilyStatus.Normal, User creator = null!)
    {
        if (creator == null) creator = await SeedUserAsync(db, UserRole.Parent, UserStatus.Active, null, "创建者");
        var family = new DomainFamily
        {
            Id = Guid.NewGuid(),
            Name = name,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatorId = creator.Id,
            Status = status,
            DissolvedAt = dissolvedAt
        };
        db.Families.Add(family);
        await db.SaveChangesAsync();
        return (family, creator);
    }

    private static async Task<DomainFamilyMember> AddMemberAsync(
        AppDbContext db, DomainFamily family, User user, UserRole role,
        DateTimeOffset joinedAt, bool isDeleted = false, DateTimeOffset? deletedAt = null)
    {
        var member = new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            UserId = user.Id,
            Role = role,
            DisplayMode = DisplayMode.Primary,
            IsDeleted = isDeleted,
            DeletedAt = deletedAt,
            JoinedAt = joinedAt
        };
        db.FamilyMembers.Add(member);
        await db.SaveChangesAsync();
        return member;
    }

    private static FamilyCleanupService CreateService(AppDbContext db)
        => new(new StubScopeFactory(db), NullLogger<FamilyCleanupService>.Instance);

    private static DateTimeOffset Now() => DateTimeOffset.UtcNow;

    // ---------- TC-FL-09: 已注销成员 30 天后物理删除 ----------

    [Fact]
    public async Task CleanupAsync_RemovesFamilyMembersDeletedMoreThan30DaysAgo()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var user = await SeedUserAsync(db, UserRole.Child, UserStatus.Deleted, Now().AddDays(-31));
        await AddMemberAsync(db, family, user, UserRole.Child, Now().AddDays(-100),
            isDeleted: true, deletedAt: Now().AddDays(-31));

        var service = CreateService(db);
        var report = await service.CleanupExpiredAsync(Now());

        Assert.Equal(1, report.RemovedMembers);
        Assert.DoesNotContain(await db.FamilyMembers.ToListAsync(), m => m.UserId == user.Id);
    }

    [Fact]
    public async Task CleanupAsync_KeepsFamilyMembersDeletedWithin30Days()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var user = await SeedUserAsync(db, UserRole.Child, UserStatus.Deleted, Now().AddDays(-10));
        await AddMemberAsync(db, family, user, UserRole.Child, Now().AddDays(-50),
            isDeleted: true, deletedAt: Now().AddDays(-10));

        var service = CreateService(db);
        var report = await service.CleanupExpiredAsync(Now());

        Assert.Equal(0, report.RemovedMembers);
        Assert.Contains(await db.FamilyMembers.ToListAsync(), m => m.UserId == user.Id);
    }

    // ---------- TC-FM-06: 已注销创建者自动转让 / 自动解散 ----------

    [Fact]
    public async Task CleanupAsync_TransferCreatorToEarliestActiveParent_WhenCreatorDeletedOver30Days()
    {
        var db = CreateDbContext();
        // 创建者 A 30 天前注销
        var creator = await SeedUserAsync(db, UserRole.Parent, UserStatus.Deleted, Now().AddDays(-31), "创建者A");
        var (family, _) = await SeedFamilyAsync(db, creator: creator);
        // 创建者作为成员行已 IsDeleted
        await AddMemberAsync(db, family, creator, UserRole.Parent, Now().AddDays(-200),
            isDeleted: true, deletedAt: Now().AddDays(-31));
        // 家长 B 先加入；家长 C 后加入 —— 期望转给 B（最早加入）
        var parentB = await SeedUserAsync(db, UserRole.Parent, nickname: "B");
        var parentC = await SeedUserAsync(db, UserRole.Parent, nickname: "C");
        await AddMemberAsync(db, family, parentB, UserRole.Parent, Now().AddDays(-100));
        await AddMemberAsync(db, family, parentC, UserRole.Parent, Now().AddDays(-50));

        var service = CreateService(db);
        var report = await service.CleanupExpiredAsync(Now());

        Assert.Equal(1, report.TransferredCreators);
        var f = await db.Families.SingleAsync();
        Assert.Equal(parentB.Id, f.CreatorId);
        Assert.Equal(FamilyStatus.Normal, f.Status);
    }

    [Fact]
    public async Task CleanupAsync_DissolvesFamily_WhenCreatorDeletedOver30DaysAndNoOtherParent()
    {
        var db = CreateDbContext();
        // 创建者 A 30 天前注销
        var creator = await SeedUserAsync(db, UserRole.Parent, UserStatus.Deleted, Now().AddDays(-31), "创建者A");
        var (family, _) = await SeedFamilyAsync(db, creator: creator);
        await AddMemberAsync(db, family, creator, UserRole.Parent, Now().AddDays(-200),
            isDeleted: true, deletedAt: Now().AddDays(-31));
        // 只剩一个孩子成员，无其他家长
        var child = await SeedUserAsync(db, UserRole.Child, nickname: "孩子");
        await AddMemberAsync(db, family, child, UserRole.Child, Now().AddDays(-80));

        var service = CreateService(db);
        var report = await service.CleanupExpiredAsync(Now());

        Assert.Equal(1, report.DissolvedFamilies);
        var f = await db.Families.SingleAsync();
        Assert.Equal(FamilyStatus.Dissolved, f.Status);
        Assert.NotNull(f.DissolvedAt);
    }

    [Fact]
    public async Task CleanupAsync_DoesNotTouchFamilies_WhoseCreatorIsActive()
    {
        var db = CreateDbContext();
        // 创建一个普通家庭，创建者活跃
        var (family, creator) = await SeedFamilyAsync(db);
        // 仅一名非创建者成员已注销 31 天（不应影响创建者所属家庭状态）
        var other = await SeedUserAsync(db, UserRole.Child, UserStatus.Deleted, Now().AddDays(-31), "孩子");
        await AddMemberAsync(db, family, other, UserRole.Child, Now().AddDays(-90),
            isDeleted: true, deletedAt: Now().AddDays(-31));

        var service = CreateService(db);
        var report = await service.CleanupExpiredAsync(Now());

        Assert.Equal(0, report.TransferredCreators);
        Assert.Equal(0, report.DissolvedFamilies);
        var f = await db.Families.SingleAsync();
        Assert.Equal(creator.Id, f.CreatorId);
        Assert.Equal(FamilyStatus.Normal, f.Status);
    }

    // ---------- 已解散家庭 30 天后物理删除 ----------

    [Fact]
    public async Task CleanupAsync_RemovesFamiliesDissolvedMoreThan30DaysAgo()
    {
        var db = CreateDbContext();
        var (family, _) = await SeedFamilyAsync(db, dissolvedAt: Now().AddDays(-31), status: FamilyStatus.Dissolved);

        var service = CreateService(db);
        var report = await service.CleanupExpiredAsync(Now());

        Assert.Equal(1, report.RemovedFamilies);
        Assert.DoesNotContain(await db.Families.ToListAsync(), f => f.Id == family.Id);
    }

    [Fact]
    public async Task CleanupAsync_KeepsFamiliesDissolvedWithin30Days()
    {
        var db = CreateDbContext();
        var (family, _) = await SeedFamilyAsync(db, dissolvedAt: Now().AddDays(-10), status: FamilyStatus.Dissolved);

        var service = CreateService(db);
        var report = await service.CleanupExpiredAsync(Now());

        Assert.Equal(0, report.RemovedFamilies);
        Assert.Contains(await db.Families.ToListAsync(), f => f.Id == family.Id);
    }

    // ---------- 测试基础设施 ----------

    private sealed class StubScopeFactory : IServiceScopeFactory
    {
        private readonly AppDbContext _db;
        public StubScopeFactory(AppDbContext db) { _db = db; }
        public IServiceScope CreateScope() => new StubScope(_db);
    }

    private sealed class StubScope : IServiceScope
    {
        public StubScope(AppDbContext db) { ServiceProvider = new StubServiceProvider(db); }
        public IServiceProvider ServiceProvider { get; }
        public void Dispose() { }
    }

    private sealed class StubServiceProvider : IServiceProvider
    {
        private readonly Dictionary<Type, object> _services;
        public StubServiceProvider(AppDbContext db)
        {
            _services = new Dictionary<Type, object>
            {
                [typeof(AppDbContext)] = db
            };
        }
        public object? GetService(Type serviceType)
            => _services.TryGetValue(serviceType, out var service) ? service : null;
    }
}
