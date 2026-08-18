using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Family.Dtos;
using Agenda.Api.Family.Services;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Agenda.Api.Family.Tests;

/// <summary>
/// 邀请码服务测试。覆盖 GWT 场景：
/// - 生成：6 位 2-9、24h 有效、唯一、5 次碰撞重试、家庭满 10 人拒绝
/// - 加入：正常/过期/已使用/已撤销/不存在/家庭满
/// - 撤销：仅邀请人/仅待使用
/// - 列表：返回所有邀请记录
/// </summary>
public class InvitationCodeServiceTests
{
    private static int _dbCounter;

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"InviteCode_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static async Task<User> SeedUserAsync(AppDbContext db, UserRole role = UserRole.Parent, string nickname = "用户")
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = nickname,
            Status = UserStatus.Active,
            Role = role,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static async Task<(DomainFamily family, User creator)> SeedFamilyAsync(
        AppDbContext db, string name = "我们家", UserRole creatorRole = UserRole.Parent)
    {
        var creator = await SeedUserAsync(db, creatorRole, "创建者");
        var family = new DomainFamily
        {
            Id = Guid.NewGuid(),
            Name = name,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatorId = creator.Id,
            Status = FamilyStatus.Normal
        };
        db.Families.Add(family);
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            UserId = creator.Id,
            Role = creatorRole,
            DisplayMode = DisplayMode.Primary,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        return (family, creator);
    }

    private static async Task<DomainFamilyMember> AddMemberAsync(
        AppDbContext db, DomainFamily family, UserRole role, string? childName = null)
    {
        var user = await SeedUserAsync(db, role);
        var member = new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            UserId = user.Id,
            Role = role,
            DisplayMode = DisplayMode.Primary,
            ChildName = childName,
            JoinedAt = DateTimeOffset.UtcNow
        };
        db.FamilyMembers.Add(member);
        await db.SaveChangesAsync();
        return member;
    }

    private static DateTimeOffset Now() => DateTimeOffset.UtcNow;
    private static InvitationCodeService CreateService(AppDbContext db) => new(db);

    // ---------- 生成 ----------

    [Fact]
    public async Task GenerateAsync_ForParent_CreatesValidCode()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);

        var resp = await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest
        {
            TargetRole = UserRole.Parent
        }, Now());

        Assert.Equal(6, resp.Code.Length);
        Assert.All(resp.Code, c => Assert.True(c >= '2' && c <= '9', $"字符 {c} 不在 2-9 范围"));
        Assert.True(resp.ExpiresAt > Now());
    }

    [Fact]
    public async Task GenerateAsync_ForChild_StoresChildNameAndDisplayMode()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);

        await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest
        {
            TargetRole = UserRole.Child,
            TargetChildName = "小明",
            TargetDisplayMode = DisplayMode.Primary
        }, Now());

        var code = await db.InvitationCodes.SingleAsync();
        Assert.Equal("小明", code.TargetChildName);
        Assert.Equal(DisplayMode.Primary, code.TargetDisplayMode);
    }

    [Fact]
    public async Task GenerateAsync_FamilyFull_ThrowsMemberLimitExceeded()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        // 凑满 10 人
        for (int i = 0; i < 9; i++)
        {
            await AddMemberAsync(db, family, UserRole.Child, $"孩子{i}");
        }
        var svc = CreateService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now()));
        Assert.Equal(ErrorCodes.FamilyMemberLimitExceeded, ex.ErrorCode);
    }

    [Fact]
    public async Task GenerateAsync_CollisionRetriesAndSucceeds()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        // 预先插入一条使用特定 code 的记录，让生成器必须重试
        db.InvitationCodes.Add(new DomainInvitationCode
        {
            Id = Guid.NewGuid(),
            Code = "222222",
            FamilyId = Guid.NewGuid(),
            TargetRole = UserRole.Parent,
            CreatorId = Guid.NewGuid(),
            CreatedAt = Now(),
            ExpiresAt = Now().AddHours(24),
            Status = InvitationCodeStatus.Pending
        });
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        var resp = await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());

        Assert.NotEqual("222222", resp.Code);
        Assert.Equal(6, resp.Code.Length);
    }

    [Fact]
    public async Task GenerateAsync_AllRetriesCollide_ThrowsInvitationCodeGenerationFailed()
    {
        // 强制随机源始终返回下标 0（即永远生成 "222222"），让 10 次重试全部碰撞。
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        // 预先占用码 "222222"，使每次生成尝试都撞库。
        db.InvitationCodes.Add(new DomainInvitationCode
        {
            Id = Guid.NewGuid(),
            Code = "222222",
            FamilyId = Guid.NewGuid(),
            TargetRole = UserRole.Parent,
            CreatorId = Guid.NewGuid(),
            CreatedAt = Now(),
            ExpiresAt = Now().AddHours(24),
            Status = InvitationCodeStatus.Pending
        });
        await db.SaveChangesAsync();
        var svc = new InvitationCodeService(db, _ => 0);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now()));
        Assert.Equal(ErrorCodes.InvitationCodeGenerationFailed, ex.ErrorCode);
    }

    [Fact]
    public async Task GenerateAsync_CreatesValidInvitationCodeStatusPending()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);

        await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());

        var code = await db.InvitationCodes.SingleAsync();
        Assert.Equal(InvitationCodeStatus.Pending, code.Status);
        Assert.Equal(family.Id, code.FamilyId);
        Assert.Equal(creator.Id, code.CreatorId);
    }

    [Fact]
    public async Task GenerateAsync_NonMember_ThrowsNotFamilyMember()
    {
        var db = CreateDbContext();
        var (family, _) = await SeedFamilyAsync(db);
        var outsider = await SeedUserAsync(db);
        var svc = CreateService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.GenerateAsync(family.Id, outsider.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now()));
        Assert.Equal(ErrorCodes.NotFamilyMember, ex.ErrorCode);
    }

    [Fact]
    public async Task GenerateAsync_DissolvedFamily_ThrowsFamilyAlreadyDissolved()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        family.Status = FamilyStatus.Dissolved;
        family.DissolvedAt = Now();
        await db.SaveChangesAsync();
        var svc = CreateService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now()));
        Assert.Equal(ErrorCodes.FamilyAlreadyDissolved, ex.ErrorCode);
    }

    // ---------- 撤销 ----------

    [Fact]
    public async Task RevokeAsync_AsCreator_RevokesPendingCode()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);
        var resp = await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());
        var code = await db.InvitationCodes.SingleAsync();

        await svc.RevokeAsync(family.Id, creator.Id, code.Id);

        var updated = await db.InvitationCodes.SingleAsync();
        Assert.Equal(InvitationCodeStatus.Redeemed, updated.Status);
    }

    [Fact]
    public async Task RevokeAsync_NotCreator_ThrowsPermissionDenied()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var other = await AddMemberAsync(db, family, UserRole.Parent);
        var svc = CreateService(db);
        await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());
        var code = await db.InvitationCodes.SingleAsync();

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.RevokeAsync(family.Id, other.UserId, code.Id));
        Assert.Equal(ErrorCodes.PermissionDenied, ex.ErrorCode);
    }

    [Fact]
    public async Task RevokeAsync_UsedCode_ThrowsInvitationCannotRevoke()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);
        await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());
        var code = await db.InvitationCodes.SingleAsync();
        code.Status = InvitationCodeStatus.Used;
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.RevokeAsync(family.Id, creator.Id, code.Id));
        Assert.Equal(ErrorCodes.InvitationCannotRevoke, ex.ErrorCode);
    }

    // ---------- 列表 ----------

    [Fact]
    public async Task ListAsync_ReturnsAllFamilyCodes()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);
        await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());
        await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Child, TargetChildName = "小", TargetDisplayMode = DisplayMode.Primary }, Now());

        var resp = await svc.ListAsync(family.Id, creator.Id);

        Assert.Equal(2, resp.Count);
    }

    [Fact]
    public async Task ListAsync_ShowsCanRevokeOnlyForPending()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);
        await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());
        var c1 = await db.InvitationCodes.OrderBy(c => c.CreatedAt).FirstAsync();
        c1.Status = InvitationCodeStatus.Used;
        await db.SaveChangesAsync();

        var resp = await svc.ListAsync(family.Id, creator.Id);

        var used = resp.First(r => r.Id == c1.Id);
        Assert.False(used.CanRevoke);
    }

    // ---------- 通过邀请码加入 ----------

    [Fact]
    public async Task JoinByCodeAsync_ValidPendingCode_CreatesMembership()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);
        var resp = await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());
        var joiner = await SeedUserAsync(db);

        var result = await svc.JoinByCodeAsync(new JoinByCodeRequest { Code = resp.Code }, joiner.Id, Now());

        Assert.Equal(family.Id, result.FamilyId);
        var member = await db.FamilyMembers.FirstAsync(m => m.UserId == joiner.Id);
        Assert.Equal(UserRole.Parent, member.Role);
        var code = await db.InvitationCodes.SingleAsync(c => c.Code == resp.Code);
        Assert.Equal(InvitationCodeStatus.Used, code.Status);
    }

    [Fact]
    public async Task JoinByCodeAsync_ChildCode_CreatesChildWithName()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);
        var resp = await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest
        {
            TargetRole = UserRole.Child,
            TargetChildName = "小明",
            TargetDisplayMode = DisplayMode.Primary
        }, Now());
        var joiner = await SeedUserAsync(db);

        var result = await svc.JoinByCodeAsync(new JoinByCodeRequest { Code = resp.Code }, joiner.Id, Now());

        var member = await db.FamilyMembers.FirstAsync(m => m.UserId == joiner.Id);
        Assert.Equal(UserRole.Child, member.Role);
        Assert.Equal("小明", member.ChildName);
        Assert.Equal(DisplayMode.Primary, member.DisplayMode);
    }

    [Fact]
    public async Task JoinByCodeAsync_ExpiredCode_ThrowsInvitationCodeExpired()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);
        await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());
        var code = await db.InvitationCodes.SingleAsync();
        code.ExpiresAt = Now().AddSeconds(-1);
        await db.SaveChangesAsync();
        var joiner = await SeedUserAsync(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.JoinByCodeAsync(new JoinByCodeRequest { Code = code.Code }, joiner.Id, Now()));
        Assert.Equal(ErrorCodes.InvitationCodeExpired, ex.ErrorCode);
    }

    [Fact]
    public async Task JoinByCodeAsync_UsedCode_ThrowsInvitationCodeUsed()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);
        await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());
        var code = await db.InvitationCodes.SingleAsync();
        code.Status = InvitationCodeStatus.Used;
        await db.SaveChangesAsync();
        var joiner = await SeedUserAsync(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.JoinByCodeAsync(new JoinByCodeRequest { Code = code.Code }, joiner.Id, Now()));
        Assert.Equal(ErrorCodes.InvitationCodeUsed, ex.ErrorCode);
    }

    [Fact]
    public async Task JoinByCodeAsync_RevokedCode_ThrowsInvitationCodeRedeemed()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = CreateService(db);
        await svc.GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());
        var code = await db.InvitationCodes.SingleAsync();
        code.Status = InvitationCodeStatus.Redeemed;
        await db.SaveChangesAsync();
        var joiner = await SeedUserAsync(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.JoinByCodeAsync(new JoinByCodeRequest { Code = code.Code }, joiner.Id, Now()));
        Assert.Equal(ErrorCodes.InvitationCodeRedeemed, ex.ErrorCode);
    }

    [Fact]
    public async Task JoinByCodeAsync_NonExistentCode_ThrowsInvalidInvitationCode()
    {
        var db = CreateDbContext();
        var svc = CreateService(db);
        var joiner = await SeedUserAsync(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.JoinByCodeAsync(new JoinByCodeRequest { Code = "999999" }, joiner.Id, Now()));
        Assert.Equal(ErrorCodes.InvalidInvitationCode, ex.ErrorCode);
    }

    [Fact]
    public async Task JoinByCodeAsync_UserAlreadyInAnyFamily_ThrowsUserAlreadyInFamily()
    {
        var db = CreateDbContext();
        var (family, _) = await SeedFamilyAsync(db);
        var svc = CreateService(db);
        var joiner = await SeedUserAsync(db);
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = Guid.NewGuid(),
            UserId = joiner.Id,
            Role = UserRole.Parent,
            DisplayMode = DisplayMode.Primary,
            JoinedAt = Now()
        });
        await db.SaveChangesAsync();
        var resp = await svc.GenerateAsync(family.Id, family.CreatorId, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.JoinByCodeAsync(new JoinByCodeRequest { Code = resp.Code }, joiner.Id, Now()));
        Assert.Equal(ErrorCodes.UserAlreadyInFamily, ex.ErrorCode);
    }

    [Fact]
    public async Task JoinByCodeAsync_FamilyFull_ThrowsMemberLimitExceeded()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        // 先生成邀请码（家庭 1 人，未满），再用其他成员填满到 10 人。
        var resp = await CreateService(db).GenerateAsync(family.Id, creator.Id, new GenerateInviteCodeRequest { TargetRole = UserRole.Parent }, Now());
        for (int i = 0; i < 9; i++)
        {
            await AddMemberAsync(db, family, UserRole.Child, $"孩子{i}");
        }
        var joiner = await SeedUserAsync(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => CreateService(db).JoinByCodeAsync(new JoinByCodeRequest { Code = resp.Code }, joiner.Id, Now()));
        Assert.Equal(ErrorCodes.FamilyMemberLimitExceeded, ex.ErrorCode);
    }
}
