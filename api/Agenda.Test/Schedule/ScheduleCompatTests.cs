using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Agenda.Test.Schedule;

/// <summary>
/// 兼容层测试（Task 5.3）：旧字段名请求（childIds）仍成功；memberIds 优先；都不传 → MEMBER_NOT_SELECTED；
/// 响应双输出 assignedChildId 与 assignedMemberId 同值。
/// </summary>
public class ScheduleCompatTests
{
    private static int _dbCounter;

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: $"ScheduleCompatTest_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Mock<ILogger<ScheduleService>> CreateLogger() => new();

    private sealed record Seed(Guid FamilyId, Guid ParentId, Guid ChildId);

    private static async Task<Seed> SeedFamilyAsync(AppDbContext db)
    {
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var familyId = Guid.NewGuid();
        db.Users.Add(new User { Id = parentId, Nickname = "Parent", Role = UserRole.Parent, OpenId = "p" });
        db.Users.Add(new User { Id = childId, Nickname = "Child", Role = UserRole.Child, OpenId = "c" });
        db.Families.Add(new DomainFamily { Id = familyId, Name = "F" });
        db.FamilyMembers.Add(new DomainFamilyMember { Id = Guid.NewGuid(), FamilyId = familyId, UserId = parentId, Role = UserRole.Parent, JoinedAt = DateTimeOffset.UtcNow });
        db.FamilyMembers.Add(new DomainFamilyMember { Id = Guid.NewGuid(), FamilyId = familyId, UserId = childId, Role = UserRole.Child, JoinedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        return new Seed(familyId, parentId, childId);
    }

    private static CreateScheduleRequest ValidRequest() => new()
    {
        Name = "钢琴课",
        ScheduleType = "AfterSchoolActivity",
        TimeSlots =
        [
            new TimeSlotDto { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
        ]
    };

    [Fact]
    public async Task CreateAsync_OnlyChildIds_Succeeds()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);

        var request = ValidRequest() with { ChildIds = [seed.ChildId] };

        var result = await service.CreateAsync(seed.FamilyId, seed.ParentId, UserRole.Parent, request);

        Assert.Single(result.Schedules);
        // 响应双输出：assignedChildId 与 assignedMemberId 同值
        Assert.Equal(seed.ChildId, result.Schedules[0].AssignedChildId);
        Assert.Equal(seed.ChildId, result.Schedules[0].AssignedMemberId);
    }

    [Fact]
    public async Task CreateAsync_BothFields_MemberIdsWins()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);

        var request = ValidRequest() with
        {
            MemberIds = [seed.ChildId], // 新字段优先
            ChildIds = [seed.ParentId]  // 旧字段被忽略
        };

        var result = await service.CreateAsync(seed.FamilyId, seed.ParentId, UserRole.Parent, request);

        Assert.Single(result.Schedules);
        Assert.Equal(seed.ChildId, result.Schedules[0].AssignedMemberId);
    }

    [Fact]
    public async Task CreateAsync_NoMembers_ThrowsMemberNotSelected()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateAsync(seed.FamilyId, seed.ParentId, UserRole.Parent, ValidRequest()));

        Assert.Equal(ErrorCodes.MemberNotSelected, ex.Message);
    }
}
