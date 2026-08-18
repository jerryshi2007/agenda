using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Agenda.Api.Schedule.Services.Tests;

/// <summary>
/// 孩子端查询服务测试。覆盖：
/// - 日/周/月列表：自动过滤 AssignedChildId、过滤已取消/已排除、计算完成统计
/// - GetById：他人日程 → 抛 CHILD_ACCESS_DENIED
/// - GetById：本人日程 → 返回 ScheduleInfo
/// - GetById：不存在 → 返回 null
/// </summary>
public class ChildScheduleQueryServiceTests
{
    private static int _dbCounter;

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"ChildSched_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static async Task<(AppDbContext Db, Guid FamilyId, Guid ChildId)> SeedAsync(
        AppDbContext db, Guid? childId = null, Guid? familyId = null)
    {
        var resolvedChild = childId ?? Guid.NewGuid();
        var resolvedFamily = familyId ?? Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = resolvedChild,
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "小明",
            Role = UserRole.Child,
            Status = UserStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        });
        db.Families.Add(new DomainFamily
        {
            Id = resolvedFamily,
            Name = "测试家庭",
            CreatedAt = DateTimeOffset.UtcNow,
            Status = FamilyStatus.Normal
        });
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = resolvedFamily,
            UserId = resolvedChild,
            Role = UserRole.Child,
            DisplayMode = DisplayMode.Primary,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        return (db, resolvedFamily, resolvedChild);
    }

    private static Domain.Entities.Schedule CreateActivity(
        Guid familyId, Guid childId, string name, DayOfWeek day, TimeOnly start, TimeOnly end)
    {
        return new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = name,
            ScheduleType = ScheduleType.AfterSchoolActivity,
            FamilyId = familyId,
            AssignedChildId = childId,
            CreatedBy = childId,
            GroupKey = Guid.NewGuid(),
            RepeatEndDate = null,
            IsDeleted = false,
            RowVersion = Guid.NewGuid().ToByteArray(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            TimeSlots =
            {
                new TimeSlot { DayOfWeek = day, StartTime = start, EndTime = end }
            }
        };
    }

    private static Domain.Entities.Schedule CreateHomework(
        Guid familyId, Guid childId, string name, DateOnly dueDate)
    {
        return new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = name,
            ScheduleType = ScheduleType.HomeworkTask,
            FamilyId = familyId,
            AssignedChildId = childId,
            CreatedBy = childId,
            GroupKey = Guid.NewGuid(),
            DueDate = dueDate,
            IsDeleted = false,
            RowVersion = Guid.NewGuid().ToByteArray(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    // ---------- 今日视图 ----------

    [Fact]
    public async Task GetDailyListAsync_TodayMatchesTimeSlot_ReturnsScheduleAndCounts()
    {
        // 周一的活动,查询周一 → 应出现 + 完成率 0%
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var mondayActivity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(mondayActivity);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var queryDate = new DateOnly(2026, 8, 24); // 周一
        var resp = await svc.GetDailyListAsync(childId, familyId, queryDate);

        Assert.Single(resp.Items);
        Assert.Equal(mondayActivity.Id, resp.Items[0].ScheduleId);
        Assert.Equal(0, resp.CompletedCount);
        Assert.Equal(1, resp.TotalCount);
        Assert.Equal(0.0, resp.CompletionPercentage);
    }

    [Fact]
    public async Task GetDailyListAsync_TodayMatchesHomeworkDueDate_ReturnsHomework()
    {
        // 作业到期日 = 今天 → 出现
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var today = new DateOnly(2026, 8, 24);
        var homework = CreateHomework(familyId, childId, "数学作业", today);
        db.Schedules.Add(homework);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetDailyListAsync(childId, familyId, today);

        Assert.Single(resp.Items);
        Assert.Equal(ScheduleType.HomeworkTask, resp.Items[0].ScheduleType);
    }

    [Fact]
    public async Task GetDailyListAsync_TodayNoMatchingSchedule_ReturnsEmptyList()
    {
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        // 周一的活动,查询周二 → 不会出现
        var mondayActivity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(mondayActivity);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetDailyListAsync(childId, familyId, new DateOnly(2026, 8, 25)); // 周二

        Assert.Empty(resp.Items);
        Assert.Equal(0, resp.CompletedCount);
        Assert.Equal(0, resp.TotalCount);
        Assert.Equal(0.0, resp.CompletionPercentage);
    }

    [Fact]
    public async Task GetDailyListAsync_OtherChildsSchedule_NotIncluded()
    {
        // 别的孩子的日程不能出现
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var otherChildId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = otherChildId,
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "小红",
            Role = UserRole.Child,
            Status = UserStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        });
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = familyId,
            UserId = otherChildId,
            Role = UserRole.Child,
            DisplayMode = DisplayMode.Primary,
            JoinedAt = DateTimeOffset.UtcNow
        });
        db.Schedules.Add(CreateActivity(familyId, otherChildId, "别人的课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0)));
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetDailyListAsync(childId, familyId, new DateOnly(2026, 8, 24));

        Assert.Empty(resp.Items);
    }

    [Fact]
    public async Task GetDailyListAsync_TodayCancelled_ExcludedFromCounts()
    {
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var today = new DateOnly(2026, 8, 24);
        var activity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(activity);
        db.Cancellations.Add(new Cancellation
        {
            ScheduleId = activity.Id,
            CancelDate = today,
            CancelledBy = childId,
            CancelledAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetDailyListAsync(childId, familyId, today);

        // 取消的日程不计入 totalCount
        Assert.Equal(0, resp.TotalCount);
        Assert.Equal(0, resp.CompletionPercentage);
    }

    [Fact]
    public async Task GetDailyListAsync_TodayCheckedIn_IncrementsCompletedCount()
    {
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var today = new DateOnly(2026, 8, 24);
        var activity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(activity);
        db.Checkins.Add(new Domain.Entities.Checkin
        {
            ScheduleId = activity.Id,
            Date = today,
            UserId = childId,
            Source = CheckinSource.Child,
            CheckinAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetDailyListAsync(childId, familyId, today);

        Assert.Equal(1, resp.CompletedCount);
        Assert.Equal(1, resp.TotalCount);
        Assert.Equal(100.0, resp.CompletionPercentage);
    }

    // ---------- 本周视图 ----------

    [Fact]
    public async Task GetWeeklyListAsync_AllWeekInstancesCounted()
    {
        // 周一+周四的活动,查询整周 → 2 个实例
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var activity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        activity.TimeSlots.Add(new TimeSlot { DayOfWeek = DayOfWeek.Thursday, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) });
        db.Schedules.Add(activity);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var weekStart = new DateOnly(2026, 8, 24); // 周一
        var resp = await svc.GetWeeklyListAsync(childId, familyId, weekStart);

        Assert.Single(resp.Items); // 去重后是 1 条
        Assert.Equal(2, resp.TotalCount);
        Assert.Equal(0, resp.CompletedCount);
    }

    // ---------- 本月视图 ----------

    [Fact]
    public async Task GetMonthlyListAsync_AcrossMonthBoundary_RespectsDateRange()
    {
        // 周一+周四的活动,查询整月(8月) → 多个实例
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var activity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(activity);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var monthStart = new DateOnly(2026, 8, 1);
        var resp = await svc.GetMonthlyListAsync(childId, familyId, monthStart);

        // 8月有 5 个周一 → 5 个实例
        Assert.Equal(5, resp.TotalCount);
        Assert.Single(resp.Items);
    }

    // ---------- GetById 权限校验 ----------

    [Fact]
    public async Task GetByIdAsync_OthersSchedule_ThrowsChildAccessDenied()
    {
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var otherChildId = Guid.NewGuid();
        db.Users.Add(new User
        {
            Id = otherChildId,
            OpenId = Guid.NewGuid().ToString("N"),
            Nickname = "小红",
            Role = UserRole.Child,
            Status = UserStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        });
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = familyId,
            UserId = otherChildId,
            Role = UserRole.Child,
            DisplayMode = DisplayMode.Primary,
            JoinedAt = DateTimeOffset.UtcNow
        });
        var othersSchedule = CreateActivity(familyId, otherChildId, "别人的课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(othersSchedule);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.GetByIdAsync(othersSchedule.Id, childId, familyId));
        Assert.Equal("CHILD_ACCESS_DENIED", ex.Message);
    }

    [Fact]
    public async Task GetByIdAsync_OwnSchedule_ReturnsScheduleInfo()
    {
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var myActivity = CreateActivity(familyId, childId, "我的课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(myActivity);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var result = await svc.GetByIdAsync(myActivity.Id, childId, familyId);

        Assert.NotNull(result);
        Assert.Equal(myActivity.Id, result!.ScheduleId);
        Assert.Equal(childId, result.AssignedChildId);
    }

    [Fact]
    public async Task GetByIdAsync_NotFound_ReturnsNull()
    {
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var svc = new ChildScheduleQueryService(db);

        var result = await svc.GetByIdAsync(Guid.NewGuid(), childId, familyId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetByIdAsync_OwnScheduleButDifferentFamily_ReturnsNull()
    {
        // 跨家庭访问视为"不存在"(与现有 ScheduleService.GetByIdAsync 行为一致),不暴露存在性。
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var myActivity = CreateActivity(familyId, childId, "我的课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(myActivity);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);
        var wrongFamilyId = Guid.NewGuid();

        var result = await svc.GetByIdAsync(myActivity.Id, childId, wrongFamilyId);

        Assert.Null(result);
    }
}
