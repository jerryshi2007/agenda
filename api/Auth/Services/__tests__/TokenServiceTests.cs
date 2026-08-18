using Agenda.Api.Auth.Services;
using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Auth;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace Agenda.Api.Auth.Services.Tests;

/// <summary>
/// TokenService 测试。覆盖：
/// - 孩子用户 + 有 FamilyMember 记录 → JWT 包含 displayMode claim
/// - 孩子用户 + 无 FamilyMember 记录 → JWT 不包含 displayMode claim(走 IJwtService.GenerateToken(Guid, TimeSpan?) 重载)
/// - 家长用户 → 不加载 FamilyMember,JWT 不包含 displayMode claim
/// - displayMode 值正确写入 claim
/// - 默认值 Primary
/// </summary>
public class TokenServiceTests
{
    private static int _dbCounter;

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"TokenSvc_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static JwtOptions TestOptions() => new()
    {
        SecretKey = "test-secret-key-must-be-long-enough-for-hmacsha256",
        Issuer = "test-issuer",
        PreExpiryWindow = TimeSpan.FromMinutes(5)
    };

    private static IJwtService CreateJwtService() =>
        new JwtService(Options.Create(TestOptions()));

    [Fact]
    public async Task GenerateTokenAsync_ChildWithFamilyMember_IncludesDisplayModeClaim()
    {
        var db = CreateDbContext();
        var childId = Guid.NewGuid();
        var familyId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = childId,
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "小明",
            Role = UserRole.Child,
            Status = UserStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        });
        db.Families.Add(new DomainFamily
        {
            Id = familyId,
            Name = "测试家庭",
            CreatedAt = DateTimeOffset.UtcNow,
            Status = FamilyStatus.Normal
        });
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = familyId,
            UserId = childId,
            Role = UserRole.Child,
            DisplayMode = DisplayMode.UpperGrades,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var jwt = CreateJwtService();
        var svc = new TokenService(db, jwt);

        var token = await svc.GenerateTokenAsync(childId);

        var principal = jwt.ValidateToken(token);
        Assert.NotNull(principal);
        var claim = principal!.FindFirst("displayMode");
        Assert.NotNull(claim);
        Assert.Equal("UpperGrades", claim!.Value);
    }

    [Fact]
    public async Task GenerateTokenAsync_ChildWithoutFamilyMember_OmitsDisplayModeClaim()
    {
        // 新用户登录后尚未加入任何家庭 → FamilyMember 不存在
        var db = CreateDbContext();
        var childId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = childId,
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "未加入家庭的孩子",
            Role = UserRole.Child,
            Status = UserStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var jwt = CreateJwtService();
        var svc = new TokenService(db, jwt);

        var token = await svc.GenerateTokenAsync(childId);

        var principal = jwt.ValidateToken(token);
        Assert.NotNull(principal);
        var claim = principal!.FindFirst("displayMode");
        Assert.Null(claim);
    }

    [Fact]
    public async Task GenerateTokenAsync_Parent_DoesNotQueryFamilyMember()
    {
        // 家长不加载 displayMode,JWT 不含该 claim
        var db = CreateDbContext();
        var parentId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = parentId,
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "家长",
            Role = UserRole.Parent,
            Status = UserStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var jwt = CreateJwtService();
        var svc = new TokenService(db, jwt);

        var token = await svc.GenerateTokenAsync(parentId);

        var principal = jwt.ValidateToken(token);
        Assert.NotNull(principal);
        var claim = principal!.FindFirst("displayMode");
        Assert.Null(claim);
    }

    [Fact]
    public async Task GenerateTokenAsync_ChildWithDefaultDisplayMode_IncludesPrimaryClaim()
    {
        // FamilyMember.DisplayMode 默认值是 Primary
        var db = CreateDbContext();
        var childId = Guid.NewGuid();
        var familyId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = childId,
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "默认模式孩子",
            Role = UserRole.Child,
            Status = UserStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        });
        db.Families.Add(new DomainFamily
        {
            Id = familyId,
            Name = "测试家庭",
            CreatedAt = DateTimeOffset.UtcNow,
            Status = FamilyStatus.Normal
        });
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = familyId,
            UserId = childId,
            Role = UserRole.Child,
            // DisplayMode 不显式设置 → 默认 Primary
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var jwt = CreateJwtService();
        var svc = new TokenService(db, jwt);

        var token = await svc.GenerateTokenAsync(childId);

        var principal = jwt.ValidateToken(token);
        var claim = principal!.FindFirst("displayMode");
        Assert.NotNull(claim);
        Assert.Equal("Primary", claim!.Value);
    }

    [Fact]
    public async Task GenerateTokenAsync_ChildWithDeletedFamilyMember_OmitsDisplayModeClaim()
    {
        // 注销中的 FamilyMember(IsDeleted=true)不应作为有效 displayMode 来源
        var db = CreateDbContext();
        var childId = Guid.NewGuid();
        var familyId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = childId,
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "已注销孩子",
            Role = UserRole.Child,
            Status = UserStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        });
        db.Families.Add(new DomainFamily
        {
            Id = familyId,
            Name = "测试家庭",
            CreatedAt = DateTimeOffset.UtcNow,
            Status = FamilyStatus.Normal
        });
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = familyId,
            UserId = childId,
            Role = UserRole.Child,
            DisplayMode = DisplayMode.Preschool,
            IsDeleted = true,
            DeletedAt = DateTimeOffset.UtcNow,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var jwt = CreateJwtService();
        var svc = new TokenService(db, jwt);

        var token = await svc.GenerateTokenAsync(childId);

        var principal = jwt.ValidateToken(token);
        var claim = principal!.FindFirst("displayMode");
        Assert.Null(claim);
    }

    [Fact]
    public async Task GenerateTokenAsync_ChildInMultipleFamilies_UsesFirstOrDefaultDisplayMode()
    {
        // T01: 孩子属于多个家庭 — 同一用户在两个家庭有不同 DisplayMode，
        // 取 FirstOrDefault 结果的 displayMode。
        var db = CreateDbContext();
        var childId = Guid.NewGuid();
        var family1Id = Guid.NewGuid();
        var family2Id = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = childId,
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "多家庭孩子",
            Role = UserRole.Child,
            Status = UserStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        });
        db.Families.Add(new DomainFamily
        {
            Id = family1Id,
            Name = "家庭一",
            CreatedAt = DateTimeOffset.UtcNow,
            Status = FamilyStatus.Normal
        });
        db.Families.Add(new DomainFamily
        {
            Id = family2Id,
            Name = "家庭二",
            CreatedAt = DateTimeOffset.UtcNow,
            Status = FamilyStatus.Normal
        });
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = family1Id,
            UserId = childId,
            Role = UserRole.Child,
            DisplayMode = DisplayMode.UpperGrades,
            JoinedAt = DateTimeOffset.UtcNow
        });
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = family2Id,
            UserId = childId,
            Role = UserRole.Child,
            DisplayMode = DisplayMode.Preschool,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var jwt = CreateJwtService();
        var svc = new TokenService(db, jwt);

        var token = await svc.GenerateTokenAsync(childId);

        var principal = jwt.ValidateToken(token);
        Assert.NotNull(principal);
        var claim = principal!.FindFirst("displayMode");
        Assert.NotNull(claim);
        // FirstOrDefault 取第一个匹配记录，不保证顺序，但保证有值
        var validModes = new[] { "UpperGrades", "Preschool" };
        Assert.Contains(claim!.Value, validModes);
    }
}
