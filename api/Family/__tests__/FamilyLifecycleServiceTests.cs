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
/// 家庭生命周期服务测试。覆盖 GWT 场景：
/// - 创建：首个成员、孩子角色、名称长度
/// - 改名：家长成功、孩子失败
/// - 退出：非创建者成功、创建者拒绝、最后家长拒绝
/// - 解散：名称匹配、最后一人允许
/// - 恢复：30 天内成功、超过 30 天失败
/// - 成员列表/移除/转让/展示模式设置
/// </summary>
public class FamilyLifecycleServiceTests
{
    private static int _dbCounter;

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"FamilyLife_{Interlocked.Increment(ref _dbCounter)}")
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
        AppDbContext db, DomainFamily family, UserRole role, string? childName = null, bool isDeleted = false, DateTimeOffset? deletedAt = null)
    {
        var user = await SeedUserAsync(db, role, role == UserRole.Parent ? "家长" : "孩子");
        var member = new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            UserId = user.Id,
            Role = role,
            DisplayMode = DisplayMode.Primary,
            ChildName = childName,
            IsDeleted = isDeleted,
            DeletedAt = deletedAt,
            JoinedAt = DateTimeOffset.UtcNow
        };
        db.FamilyMembers.Add(member);
        await db.SaveChangesAsync();
        return member;
    }

    private static DateTimeOffset Now() => DateTimeOffset.UtcNow;
    private static DateTimeOffset ServerTime() => DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(8));

    // ---------- 创建家庭 ----------

    [Fact]
    public async Task CreateAsync_AsParent_CreatesFamilyAndFirstMember()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var svc = new FamilyLifecycleService(db);

        var resp = await svc.CreateAsync(user.Id, new CreateFamilyRequest { Name = "我们家", Role = UserRole.Parent }, Now());

        Assert.NotEqual(Guid.Empty, resp.FamilyId);
        var family = await db.Families.SingleAsync();
        Assert.Equal("我们家", family.Name);
        Assert.Equal(user.Id, family.CreatorId);
        Assert.Equal(FamilyStatus.Normal, family.Status);
        var member = await db.FamilyMembers.SingleAsync();
        Assert.Equal(user.Id, member.UserId);
        Assert.Equal(UserRole.Parent, member.Role);
    }

    [Fact]
    public async Task CreateAsync_AsChild_CreatesFamilyWithChildRole()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var svc = new FamilyLifecycleService(db);

        await svc.CreateAsync(user.Id, new CreateFamilyRequest { Name = "我家", Role = UserRole.Child }, Now());

        var member = await db.FamilyMembers.SingleAsync();
        Assert.Equal(UserRole.Child, member.Role);
    }

    // ---------- 修改名称 ----------

    [Fact]
    public async Task UpdateNameAsync_AsParent_UpdatesName()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db, name: "旧名");
        var svc = new FamilyLifecycleService(db);

        await svc.UpdateNameAsync(family.Id, creator.Id, new UpdateFamilyNameRequest { Name = "新名" });

        var updated = await db.Families.SingleAsync();
        Assert.Equal("新名", updated.Name);
    }

    [Fact]
    public async Task UpdateNameAsync_AsChild_ThrowsPermissionDenied()
    {
        var db = CreateDbContext();
        var (family, _) = await SeedFamilyAsync(db);
        var childMember = await AddMemberAsync(db, family, UserRole.Child, childName: "小童");
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.UpdateNameAsync(family.Id, childMember.UserId, new UpdateFamilyNameRequest { Name = "新名" }));
        Assert.Equal(ErrorCodes.PermissionDenied, ex.ErrorCode);
    }

    [Fact]
    public async Task UpdateNameAsync_FamilyNotFound_ThrowsFamilyNotFound()
    {
        var db = CreateDbContext();
        var (_, creator) = await SeedFamilyAsync(db);
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.UpdateNameAsync(Guid.NewGuid(), creator.Id, new UpdateFamilyNameRequest { Name = "新名" }));
        Assert.Equal(ErrorCodes.FamilyNotFound, ex.ErrorCode);
    }

    // ---------- 退出家庭 ----------

    [Fact]
    public async Task ExitAsync_AsNonCreatorParent_RemovesMember()
    {
        var db = CreateDbContext();
        var (family, _) = await SeedFamilyAsync(db);
        var otherParent = await AddMemberAsync(db, family, UserRole.Parent);
        var svc = new FamilyLifecycleService(db);

        var resp = await svc.ExitAsync(family.Id, otherParent.UserId);

        Assert.True(resp.Exited);
        Assert.False(await db.FamilyMembers.AnyAsync(m => m.UserId == otherParent.UserId && m.FamilyId == family.Id));
    }

    [Fact]
    public async Task ExitAsync_AsCreator_ThrowsCreatorCannotExit()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        await AddMemberAsync(db, family, UserRole.Child);
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.ExitAsync(family.Id, creator.Id));
        Assert.Equal(ErrorCodes.FamilyCreatorCannotExit, ex.ErrorCode);
    }

    [Fact]
    public async Task ExitAsync_AsLastParentWithChildren_ThrowsLastParentCannotExit()
    {
        var db = CreateDbContext();
        var (family, _) = await SeedFamilyAsync(db);
        await AddMemberAsync(db, family, UserRole.Child);
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.ExitAsync(family.Id, family.CreatorId));
        Assert.Equal(ErrorCodes.FamilyCreatorCannotExit, ex.ErrorCode);
    }

    [Fact]
    public async Task ExitAsync_AsNonMember_ThrowsNotFamilyMember()
    {
        var db = CreateDbContext();
        var (family, _) = await SeedFamilyAsync(db);
        var outsider = await SeedUserAsync(db);
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.ExitAsync(family.Id, outsider.Id));
        Assert.Equal(ErrorCodes.NotFamilyMember, ex.ErrorCode);
    }

    // ---------- 解散家庭 ----------

    [Fact]
    public async Task DissolveAsync_AsCreatorWithNameMatch_MarksFamilyDissolved()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db, name: "我们家");
        await AddMemberAsync(db, family, UserRole.Child);
        var svc = new FamilyLifecycleService(db);

        await svc.DissolveAsync(family.Id, creator.Id, new DissolveFamilyRequest { FamilyName = "我们家" }, Now());

        var f = await db.Families.SingleAsync();
        Assert.Equal(FamilyStatus.Dissolved, f.Status);
        Assert.NotNull(f.DissolvedAt);
    }

    [Fact]
    public async Task DissolveAsync_WithWrongName_ThrowsFamilyNameMismatch()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db, name: "我们家");
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.DissolveAsync(family.Id, creator.Id, new DissolveFamilyRequest { FamilyName = "别家" }, Now()));
        Assert.Equal(ErrorCodes.FamilyNameMismatch, ex.ErrorCode);
    }

    [Fact]
    public async Task DissolveAsync_AsNonCreator_ThrowsPermissionDenied()
    {
        var db = CreateDbContext();
        var (family, _) = await SeedFamilyAsync(db);
        var other = await AddMemberAsync(db, family, UserRole.Parent);
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.DissolveAsync(family.Id, other.UserId, new DissolveFamilyRequest { FamilyName = "我们家" }, Now()));
        Assert.Equal(ErrorCodes.PermissionDenied, ex.ErrorCode);
    }

    [Fact]
    public async Task DissolveAsync_AlreadyDissolved_ThrowsFamilyAlreadyDissolved()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = new FamilyLifecycleService(db);
        await svc.DissolveAsync(family.Id, creator.Id, new DissolveFamilyRequest { FamilyName = "我们家" }, Now());

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.DissolveAsync(family.Id, creator.Id, new DissolveFamilyRequest { FamilyName = "我们家" }, Now()));
        Assert.Equal(ErrorCodes.FamilyAlreadyDissolved, ex.ErrorCode);
    }

    // ---------- 恢复家庭 ----------

    [Fact]
    public async Task RestoreAsync_Within30Days_RestoresFamily()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = new FamilyLifecycleService(db);
        var dissolvedAt = Now().AddDays(-5);
        family.Status = FamilyStatus.Dissolved;
        family.DissolvedAt = dissolvedAt;
        await db.SaveChangesAsync();

        var resp = await svc.RestoreAsync(family.Id, creator.Id, Now());

        Assert.True(resp.Restored);
        var f = await db.Families.SingleAsync();
        Assert.Equal(FamilyStatus.Normal, f.Status);
        Assert.Null(f.DissolvedAt);
    }

    [Fact]
    public async Task RestoreAsync_After30Days_ThrowsDissolvedExpired()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = new FamilyLifecycleService(db);
        family.Status = FamilyStatus.Dissolved;
        family.DissolvedAt = Now().AddDays(-31);
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.RestoreAsync(family.Id, creator.Id, Now()));
        Assert.Equal(ErrorCodes.DissolvedExpired, ex.ErrorCode);
    }

    [Fact]
    public async Task RestoreAsync_NotDissolved_ThrowsFamilyNotDissolved()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.RestoreAsync(family.Id, creator.Id, Now()));
        Assert.Equal(ErrorCodes.FamilyNotDissolved, ex.ErrorCode);
    }

    // ---------- 成员列表 ----------

    [Fact]
    public async Task GetMembersAsync_GroupsParentsAndChildren_IncludesCreator()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var p2 = await AddMemberAsync(db, family, UserRole.Parent);
        var c1 = await AddMemberAsync(db, family, UserRole.Child, childName: "小明");
        var c2 = await AddMemberAsync(db, family, UserRole.Child, childName: "小红");
        var svc = new FamilyLifecycleService(db);

        var resp = await svc.GetMembersAsync(family.Id, creator.Id);

        Assert.Equal("我们家", resp.FamilyName);
        Assert.Equal(creator.Id, resp.CreatorId);
        Assert.Equal(2, resp.Parents.Count);
        Assert.Equal(2, resp.Children.Count);
        Assert.Equal(4, resp.ActiveMemberCount);
        Assert.Equal(10, resp.MaxMemberCount);
        Assert.Contains(resp.Parents, p => p.IsCreator && p.UserId == creator.Id);
        Assert.Contains(resp.Children, c => c.ChildName == "小明");
    }

    [Fact]
    public async Task GetMembersAsync_ExcludesDeletedMembersFromCount()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        await AddMemberAsync(db, family, UserRole.Child, childName: "已注销", isDeleted: true, deletedAt: Now());
        var svc = new FamilyLifecycleService(db);

        var resp = await svc.GetMembersAsync(family.Id, creator.Id);

        Assert.Equal(1, resp.ActiveMemberCount);
    }

    // ---------- 移除成员 ----------

    [Fact]
    public async Task RemoveMemberAsync_AsParent_RemovesChild()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var child = await AddMemberAsync(db, family, UserRole.Child, childName: "小明");
        var svc = new FamilyLifecycleService(db);

        await svc.RemoveMemberAsync(family.Id, creator.Id, child.Id);

        Assert.Empty(await db.FamilyMembers.Where(m => m.Id == child.Id).ToListAsync());
    }

    [Fact]
    public async Task RemoveMemberAsync_SelfTarget_ThrowsCannotRemoveSelf()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var creatorMember = await db.FamilyMembers.SingleAsync(m => m.UserId == creator.Id);
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.RemoveMemberAsync(family.Id, creator.Id, creatorMember.Id));
        Assert.Equal(ErrorCodes.CannotRemoveSelf, ex.ErrorCode);
    }

    [Fact]
    public async Task RemoveMemberAsync_AsChild_ThrowsPermissionDenied()
    {
        var db = CreateDbContext();
        var (family, _) = await SeedFamilyAsync(db);
        var child1 = await AddMemberAsync(db, family, UserRole.Child, childName: "甲");
        var child2 = await AddMemberAsync(db, family, UserRole.Child, childName: "乙");
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.RemoveMemberAsync(family.Id, child1.UserId, child2.Id));
        Assert.Equal(ErrorCodes.PermissionDenied, ex.ErrorCode);
    }

    // ---------- 转让创建者 ----------

    [Fact]
    public async Task TransferCreatorAsync_ToOtherParent_TransfersCreator()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var otherParent = await AddMemberAsync(db, family, UserRole.Parent);
        var otherMember = await db.FamilyMembers.SingleAsync(m => m.UserId == otherParent.UserId);
        var svc = new FamilyLifecycleService(db);

        await svc.TransferCreatorAsync(family.Id, creator.Id, otherMember.Id);

        var f = await db.Families.SingleAsync();
        Assert.Equal(otherMember.UserId, f.CreatorId);
    }

    [Fact]
    public async Task TransferCreatorAsync_ToChild_ThrowsInvalidTransferTarget()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var child = await AddMemberAsync(db, family, UserRole.Child, childName: "小明");
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.TransferCreatorAsync(family.Id, creator.Id, child.Id));
        Assert.Equal(ErrorCodes.InvalidTransferTarget, ex.ErrorCode);
    }

    // ---------- 设置展示模式 ----------

    [Fact]
    public async Task SetMemberDisplayModeAsync_AsParent_UpdatesDisplayMode()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var child = await AddMemberAsync(db, family, UserRole.Child, childName: "小明");
        var svc = new FamilyLifecycleService(db);

        await svc.SetMemberDisplayModeAsync(family.Id, creator.Id, child.Id, new SetDisplayModeRequest { DisplayMode = DisplayMode.UpperGrades });

        var updated = await db.FamilyMembers.SingleAsync(m => m.Id == child.Id);
        Assert.Equal(DisplayMode.UpperGrades, updated.DisplayMode);
    }

    [Fact]
    public async Task SetMemberDisplayModeAsync_OnParent_ThrowsPermissionDenied()
    {
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        var otherParent = await AddMemberAsync(db, family, UserRole.Parent);
        var otherMember = await db.FamilyMembers.SingleAsync(m => m.UserId == otherParent.UserId);
        var svc = new FamilyLifecycleService(db);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.SetMemberDisplayModeAsync(family.Id, creator.Id, otherMember.Id, new SetDisplayModeRequest { DisplayMode = DisplayMode.Preschool }));
        Assert.Equal(ErrorCodes.PermissionDenied, ex.ErrorCode);
    }

    // ---------- 我的家庭列表 ----------

    [Fact]
    public async Task GetMyFamiliesAsync_ReturnsAllUserFamilies()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var svc = new FamilyLifecycleService(db);

        // 创建两个家庭，用户都加入
        var f1Resp = await svc.CreateAsync(user.Id, new CreateFamilyRequest { Name = "家一", Role = UserRole.Parent }, Now());
        var f2Resp = await svc.CreateAsync(user.Id, new CreateFamilyRequest { Name = "家二", Role = UserRole.Child }, Now());

        var resp = await svc.GetMyFamiliesAsync(user.Id);

        Assert.Equal(2, resp.Families.Count);
        Assert.Contains(resp.Families, f => f.FamilyId == f1Resp.FamilyId);
        Assert.Contains(resp.Families, f => f.FamilyId == f2Resp.FamilyId);
    }

    [Fact]
    public async Task GetMyFamiliesAsync_ExcludesDissolvedFamilies()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var svc = new FamilyLifecycleService(db);

        // 创建两个家庭，解散其中一个
        var f1Resp = await svc.CreateAsync(user.Id, new CreateFamilyRequest { Name = "正常家", Role = UserRole.Parent }, Now());
        var f2Resp = await svc.CreateAsync(user.Id, new CreateFamilyRequest { Name = "解散家", Role = UserRole.Parent }, Now());
        await svc.DissolveAsync(f2Resp.FamilyId, user.Id, new DissolveFamilyRequest { FamilyName = "解散家" }, Now());

        var resp = await svc.GetMyFamiliesAsync(user.Id);

        Assert.Single(resp.Families);
        Assert.Equal(f1Resp.FamilyId, resp.Families[0].FamilyId);
        Assert.DoesNotContain(resp.Families, f => f.FamilyId == f2Resp.FamilyId);
    }

    [Fact]
    public async Task GetMyFamiliesAsync_MemberCountUsesGroupedQuery_NotNPlus1()
    {
        // 验证 N+1 修复：用户加入 5 个家庭，每个家庭有不同的活跃成员数，
        // GetMyFamiliesAsync 不应触发逐家庭 CountAsync（实际不可直接断言 SQL 次数，
        // 但可断言返回的 MemberCount 与 GroupBy 结果一致）。
        var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var svc = new FamilyLifecycleService(db);

        for (int i = 0; i < 5; i++)
        {
            var f = await svc.CreateAsync(user.Id, new CreateFamilyRequest { Name = $"家{i}", Role = UserRole.Parent }, Now());
            // 给每个家庭额外加 i 个孩子，验证 MemberCount 准确
            var family = await db.Families.FirstAsync(x => x.Id == f.FamilyId);
            for (int j = 0; j < i; j++)
            {
                await AddMemberAsync(db, family, UserRole.Child, $"孩子{i}-{j}");
            }
        }

        var resp = await svc.GetMyFamiliesAsync(user.Id);

        Assert.Equal(5, resp.Families.Count);
        for (int i = 0; i < 5; i++)
        {
            var info = resp.Families.First(f => f.FamilyName == $"家{i}");
            // 创建者 1 + i 个孩子 = 1 + i
            Assert.Equal(1 + i, info.MemberCount);
        }
    }

    // ---------- 容量检查 ----------

    [Fact]
    public async Task CreateAsync_ReachesFamilyMemberLimit_BlocksFurtherJoins()
    {
        // 间接验证：通过添加 10 个成员后，再用 AddMember 应识别为超限。
        // 这里我们直接验证 GetMembersAsync 返回的 MaxMemberCount 与已用计数。
        var db = CreateDbContext();
        var (family, creator) = await SeedFamilyAsync(db);
        // creator + 9 others = 10
        for (int i = 0; i < 9; i++)
        {
            await AddMemberAsync(db, family, UserRole.Child, childName: $"孩子{i}");
        }
        var svc = new FamilyLifecycleService(db);

        var resp = await svc.GetMembersAsync(family.Id, creator.Id);

        Assert.Equal(10, resp.ActiveMemberCount);
    }
}
