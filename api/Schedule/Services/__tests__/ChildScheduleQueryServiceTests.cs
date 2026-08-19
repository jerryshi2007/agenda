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

    private static Domain.Entities.Schedule CreateDerivativeActivity(
        Guid familyId, Guid childId, string name, Guid sourceScheduleId, DateOnly overrideDate,
        DayOfWeek day, TimeOnly start, TimeOnly end)
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
            SourceScheduleId = sourceScheduleId,
            OverrideDate = overrideDate,
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

    // ---------- 衍生日程 / 边界 ----------

    [Fact]
    public async Task GetDailyListAsync_DerivativeScheduleOverrideDateMatchesToday_AppearsInList()
    {
        // B01: 衍生日程按 OverrideDate 匹配今日。源日程 TimeSlot 不匹配今日，
        // 衍生日程 OverrideDate=today → 衍生日程出现，源日程不出现。
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var today = new DateOnly(2026, 8, 24); // 周一
        // 源日程：周二才出现（TimeSlot 不匹配周一）
        var source = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Tuesday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(source);
        // 衍生日程：OverrideDate=周一（今天）
        var derivative = CreateDerivativeActivity(familyId, childId, "钢琴课(调整)", source.Id, today,
            DayOfWeek.Monday, new TimeOnly(15, 0), new TimeOnly(16, 0));
        db.Schedules.Add(derivative);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetDailyListAsync(childId, familyId, today);

        Assert.Single(resp.Items);
        Assert.Equal(derivative.Id, resp.Items[0].ScheduleId);
        Assert.Equal(1, resp.TotalCount);
    }

    [Fact]
    public async Task GetDailyListAsync_DerivativeScheduleOverrideDateNotToday_NotAppears()
    {
        // B02: 衍生日程 OverrideDate 不在今日则不出现
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var today = new DateOnly(2026, 8, 24); // 周一
        var otherDay = new DateOnly(2026, 8, 25); // 周二
        var source = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(source);
        var derivative = CreateDerivativeActivity(familyId, childId, "钢琴课(调整)", source.Id, otherDay,
            DayOfWeek.Tuesday, new TimeOnly(15, 0), new TimeOnly(16, 0));
        db.Schedules.Add(derivative);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetDailyListAsync(childId, familyId, today);

        // 仅源日程的周一实例出现，衍生日程不出现（OverrideDate=周二）
        Assert.Single(resp.Items);
        Assert.Equal(source.Id, resp.Items[0].ScheduleId);
    }

    [Fact]
    public async Task GetDailyListAsync_DateExclusionExcludesDate_NotAppears()
    {
        // B03: DateExclusion 排除日期过滤 — 源日程在今天有 DateExclusion 记录，不出现在今日列表
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var today = new DateOnly(2026, 8, 24); // 周一
        var activity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(activity);
        db.ScheduleDateExclusions.Add(new ScheduleDateExclusion
        {
            ScheduleId = activity.Id,
            ExcludedDate = today,
            ExcludedBy = childId,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetDailyListAsync(childId, familyId, today);

        Assert.Empty(resp.Items);
        Assert.Equal(0, resp.TotalCount);
    }

    [Fact]
    public async Task GetDailyListAsync_RepeatEndDateExpired_NotAppears()
    {
        // B04: RepeatEndDate 到期后不再出现 — RepeatEndDate=昨天，查询今天，不出现在列表
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var yesterday = new DateOnly(2026, 8, 23); // 周日
        var today = new DateOnly(2026, 8, 24); // 周一
        var activity = new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = "已到期课程",
            ScheduleType = ScheduleType.AfterSchoolActivity,
            FamilyId = familyId,
            AssignedChildId = childId,
            CreatedBy = childId,
            GroupKey = Guid.NewGuid(),
            RepeatEndDate = yesterday,
            IsDeleted = false,
            RowVersion = Guid.NewGuid().ToByteArray(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            TimeSlots =
            {
                new TimeSlot { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
            }
        };
        db.Schedules.Add(activity);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetDailyListAsync(childId, familyId, today);

        Assert.Empty(resp.Items);
        Assert.Equal(0, resp.TotalCount);
    }

    [Fact]
    public async Task GetWeeklyListAsync_RepeatEndDateInWeekBoundary_RespectsEndDate()
    {
        // B05: RepeatEndDate 在周中边界 — RepeatEndDate=本周六，查询周视图(周一~周日)，
        // 周六及之前出现，周日不出现。
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var weekStart = new DateOnly(2026, 8, 24); // 周一
        var saturday = new DateOnly(2026, 8, 29); // 周六
        // 活动：每天都有 TimeSlot，但 RepeatEndDate=周六
        var activity = new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = "暑期班",
            ScheduleType = ScheduleType.AfterSchoolActivity,
            FamilyId = familyId,
            AssignedChildId = childId,
            CreatedBy = childId,
            GroupKey = Guid.NewGuid(),
            RepeatEndDate = saturday,
            IsDeleted = false,
            RowVersion = Guid.NewGuid().ToByteArray(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            TimeSlots =
            {
                new TimeSlot { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0) },
                new TimeSlot { DayOfWeek = DayOfWeek.Tuesday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0) },
                new TimeSlot { DayOfWeek = DayOfWeek.Wednesday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0) },
                new TimeSlot { DayOfWeek = DayOfWeek.Thursday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0) },
                new TimeSlot { DayOfWeek = DayOfWeek.Friday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0) },
                new TimeSlot { DayOfWeek = DayOfWeek.Saturday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0) },
                new TimeSlot { DayOfWeek = DayOfWeek.Sunday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0) }
            }
        };
        db.Schedules.Add(activity);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetWeeklyListAsync(childId, familyId, weekStart);

        // 周一~周六 6 天出现，周日不出现（超出 RepeatEndDate）
        Assert.Equal(6, resp.TotalCount);
    }

    [Fact]
    public async Task GetDailyListAsync_IsDeletedSchedule_FilteredOut()
    {
        // B06: IsDeleted=true 日程被过滤 — 不出现在任何查询
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var today = new DateOnly(2026, 8, 24); // 周一
        var activity = CreateActivity(familyId, childId, "已删除课程", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        activity.IsDeleted = true;
        db.Schedules.Add(activity);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetDailyListAsync(childId, familyId, today);

        Assert.Empty(resp.Items);
        Assert.Equal(0, resp.TotalCount);
    }

    [Fact]
    public async Task GetWeeklyListAsync_DerivativeScheduleInWeek_CountedInTotal()
    {
        // B07: 衍生日程在周视图正确计数 — 衍生日程 OverrideDate 在周内，计入 totalCount
        var (db, familyId, childId) = await SeedAsync(db: CreateDbContext());
        var weekStart = new DateOnly(2026, 8, 24); // 周一
        var wednesday = new DateOnly(2026, 8, 26); // 周三
        // 源日程：周四才出现（TimeSlot 不匹配周一~周三）
        var source = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Thursday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(source);
        // 衍生日程：OverrideDate=周三
        var derivative = CreateDerivativeActivity(familyId, childId, "钢琴课(调整)", source.Id, wednesday,
            DayOfWeek.Wednesday, new TimeOnly(15, 0), new TimeOnly(16, 0));
        db.Schedules.Add(derivative);
        await db.SaveChangesAsync();
        var svc = new ChildScheduleQueryService(db);

        var resp = await svc.GetWeeklyListAsync(childId, familyId, weekStart);

        // 源日程(周四) + 衍生日程(周三) = 2
        Assert.Equal(2, resp.TotalCount);
        Assert.Equal(2, resp.Items.Count);
    }
}
