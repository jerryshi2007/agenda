using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Schedule.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Agenda.Test.Schedule.Services;

/// <summary>
/// FamilyContextService 测试。覆盖 D2 解析语义（5 类）+ User.Status == Active 过滤：
/// - header 有且是成员 → 返回 (familyId, role)
/// - header 指向非成员 → 抛 FamilyNotFound
/// - 无 header 且 0 条成员 → 抛 NotFamilyMember
/// - 无 header 且 1 条成员 → 回退该家庭
/// - 无 header 且 ≥2 条成员 → 抛 FamilyContextRequired
/// - 成员记录存在但用户已注销 → 视为无成员，抛 NotFamilyMember
/// </summary>
public class FamilyContextServiceTests
{
    private static int _dbCounter;

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"FamilyCtx_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static async Task<(User user, DomainFamily family, DomainFamilyMember member)> SeedMemberAsync(
        AppDbContext db, UserRole role = UserRole.Parent, UserStatus userStatus = UserStatus.Active)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "用户",
            Status = userStatus,
            Role = role,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        };
        var family = new DomainFamily
        {
            Id = Guid.NewGuid(),
            Name = "我们家",
            CreatedAt = DateTimeOffset.UtcNow,
            CreatorId = user.Id,
            Status = FamilyStatus.Normal
        };
        var member = new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            UserId = user.Id,
            Role = role,
            DisplayMode = DisplayMode.Primary,
            JoinedAt = DateTimeOffset.UtcNow,
            Family = family,
            User = user
        };
        db.Users.Add(user);
        db.Families.Add(family);
        db.FamilyMembers.Add(member);
        await db.SaveChangesAsync();
        return (user, family, member);
    }

    private static async Task<User> SeedUserOnlyAsync(AppDbContext db)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "无家庭用户",
            Status = UserStatus.Active,
            Role = UserRole.Parent,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task HeaderIsMember_ReturnsFamilyIdAndRole()
    {
        var db = CreateDbContext();
        var (user, family, _) = await SeedMemberAsync(db, UserRole.Child);
        var svc = new FamilyContextService(db);

        var (familyId, role) = await svc.GetFamilyContextAsync(user.Id, family.Id);

        Assert.Equal(family.Id, familyId);
        Assert.Equal(UserRole.Child, role);
    }

    [Fact]
    public async Task HeaderPointsToNonMemberFamily_ThrowsFamilyNotFound()
    {
        var db = CreateDbContext();
        var (user, _, _) = await SeedMemberAsync(db);
        var svc = new FamilyContextService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.GetFamilyContextAsync(user.Id, Guid.NewGuid()));
        Assert.Equal(ErrorCodes.FamilyNotFound, ex.ErrorCode);
    }

    [Fact]
    public async Task NoHeader_NoMembership_ThrowsNotFamilyMember()
    {
        var db = CreateDbContext();
        var user = await SeedUserOnlyAsync(db);
        var svc = new FamilyContextService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.GetFamilyContextAsync(user.Id, null));
        Assert.Equal(ErrorCodes.NotFamilyMember, ex.ErrorCode);
    }

    [Fact]
    public async Task NoHeader_SingleMembership_FallsBackToThatFamily()
    {
        var db = CreateDbContext();
        var (user, family, _) = await SeedMemberAsync(db, UserRole.Parent);
        var svc = new FamilyContextService(db);

        var (familyId, role) = await svc.GetFamilyContextAsync(user.Id, null);

        Assert.Equal(family.Id, familyId);
        Assert.Equal(UserRole.Parent, role);
    }

    [Fact]
    public async Task NoHeader_MultipleMemberships_ThrowsFamilyContextRequired()
    {
        var db = CreateDbContext();
        var (user, _, _) = await SeedMemberAsync(db);
        var family2 = new DomainFamily
        {
            Id = Guid.NewGuid(),
            Name = "第二个家",
            CreatedAt = DateTimeOffset.UtcNow,
            CreatorId = user.Id,
            Status = FamilyStatus.Normal
        };
        db.Families.Add(family2);
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = family2.Id,
            UserId = user.Id,
            Role = UserRole.Parent,
            DisplayMode = DisplayMode.Primary,
            JoinedAt = DateTimeOffset.UtcNow,
            Family = family2,
            User = user
        });
        await db.SaveChangesAsync();
        var svc = new FamilyContextService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.GetFamilyContextAsync(user.Id, null));
        Assert.Equal(ErrorCodes.FamilyContextRequired, ex.ErrorCode);
    }

    [Fact]
    public async Task NoHeader_MembershipWithInactiveUser_ThrowsNotFamilyMember()
    {
        var db = CreateDbContext();
        var (user, _, _) = await SeedMemberAsync(db, UserRole.Parent, UserStatus.Deleted);
        var svc = new FamilyContextService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.GetFamilyContextAsync(user.Id, null));
        Assert.Equal(ErrorCodes.NotFamilyMember, ex.ErrorCode);
    }
}
