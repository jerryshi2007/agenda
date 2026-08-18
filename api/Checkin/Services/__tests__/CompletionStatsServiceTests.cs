using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Checkin.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Agenda.Api.Checkin.Services.Tests;

/// <summary>
/// 孩子端完成率统计服务测试。覆盖：
/// - GetChildWeeklyCompletionRateAsync：本周孩子日程完成率统计
/// - 仅统计 AssignedChildId == userId 的日程
/// - 已取消日程不计入
/// - 作业任务按 DueDate 判定是否在周内
/// - 重复日程按 TimeSlot.DayOfWeek 判定
/// - 已排除日期不计入
/// - 已打卡计入 completed
/// </summary>
public class CompletionStatsServiceTests
{
    private static int _dbCounter;

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"CompletionStats_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static async Task<(AppDbContext Db, Guid FamilyId, Guid ChildId)> SeedAsync(AppDbContext db)
    {
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
            DisplayMode = DisplayMode.Primary,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        return (db, familyId, childId);
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
            TimeSlots = { new TimeSlot { DayOfWeek = day, StartTime = start, EndTime = end } }
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

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_NoSchedules_ReturnsZeros()
    {
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
        var svc = new CompletionStatsService(db);
        var weekStart = new DateOnly(2026, 8, 24); // 周一

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        Assert.Equal(0.0, percentage);
        Assert.Equal(0, completed);
        Assert.Equal(0, total);
    }

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_OnlyCountsAssignedChildSchedules()
    {
        // 别的孩子的日程不计入
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
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
        var svc = new CompletionStatsService(db);
        var weekStart = new DateOnly(2026, 8, 24);

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        Assert.Equal(0, total);
    }

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_TwoInstancesOneChecked_ReturnsHalf()
    {
        // 周一+周四的活动,周四已打卡 → 50%
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
        var activity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        activity.TimeSlots.Add(new TimeSlot { DayOfWeek = DayOfWeek.Thursday, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) });
        db.Schedules.Add(activity);
        // 周四(8月27日)打卡
        db.Checkins.Add(new Domain.Entities.Checkin
        {
            ScheduleId = activity.Id,
            Date = new DateOnly(2026, 8, 27),
            UserId = childId,
            Source = CheckinSource.Child,
            CheckinAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var svc = new CompletionStatsService(db);
        var weekStart = new DateOnly(2026, 8, 24);

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        Assert.Equal(2, total);
        Assert.Equal(1, completed);
        Assert.Equal(50.0, percentage);
    }

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_CancelledDay_NotCounted()
    {
        // 周一的活动,周一被取消 → total=0
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
        var activity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(activity);
        db.Cancellations.Add(new Cancellation
        {
            ScheduleId = activity.Id,
            CancelDate = new DateOnly(2026, 8, 24), // 周一
            CancelledBy = childId,
            CancelledAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var svc = new CompletionStatsService(db);
        var weekStart = new DateOnly(2026, 8, 24);

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        Assert.Equal(0, total);
    }

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_HomeworkDueThisWeek_CountedAsInstance()
    {
        // 作业到期日在本周内 → 计入 total
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
        var homework = new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = "数学作业",
            ScheduleType = ScheduleType.HomeworkTask,
            FamilyId = familyId,
            AssignedChildId = childId,
            CreatedBy = childId,
            GroupKey = Guid.NewGuid(),
            DueDate = new DateOnly(2026, 8, 26), // 周三
            IsDeleted = false,
            RowVersion = Guid.NewGuid().ToByteArray(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Schedules.Add(homework);
        db.Checkins.Add(new Domain.Entities.Checkin
        {
            ScheduleId = homework.Id,
            Date = new DateOnly(2026, 8, 26),
            UserId = childId,
            Source = CheckinSource.Child,
            CheckinAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var svc = new CompletionStatsService(db);
        var weekStart = new DateOnly(2026, 8, 24);

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        Assert.Equal(1, total);
        Assert.Equal(1, completed);
        Assert.Equal(100.0, percentage);
    }

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_HomeworkDueNextWeek_NotCounted()
    {
        // 作业到期日在下周 → 不计入
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
        var homework = new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = "数学作业",
            ScheduleType = ScheduleType.HomeworkTask,
            FamilyId = familyId,
            AssignedChildId = childId,
            CreatedBy = childId,
            GroupKey = Guid.NewGuid(),
            DueDate = new DateOnly(2026, 8, 31), // 下周一
            IsDeleted = false,
            RowVersion = Guid.NewGuid().ToByteArray(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Schedules.Add(homework);
        await db.SaveChangesAsync();
        var svc = new CompletionStatsService(db);
        var weekStart = new DateOnly(2026, 8, 24);

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        Assert.Equal(0, total);
    }

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_ExcludedDate_NotCounted()
    {
        // 周一的活动,周一被排除 → total=0
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
        var activity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(activity);
        db.ScheduleDateExclusions.Add(new ScheduleDateExclusion
        {
            ScheduleId = activity.Id,
            ExcludedDate = new DateOnly(2026, 8, 24),
            ExcludedBy = childId,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var svc = new CompletionStatsService(db);
        var weekStart = new DateOnly(2026, 8, 24);

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        Assert.Equal(0, total);
    }

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_AllChecked_Returns100()
    {
        // 周一的活动已打卡 → 100%
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
        var activity = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(activity);
        db.Checkins.Add(new Domain.Entities.Checkin
        {
            ScheduleId = activity.Id,
            Date = new DateOnly(2026, 8, 24),
            UserId = childId,
            Source = CheckinSource.Child,
            CheckinAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var svc = new CompletionStatsService(db);
        var weekStart = new DateOnly(2026, 8, 24);

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        Assert.Equal(1, total);
        Assert.Equal(1, completed);
        Assert.Equal(100.0, percentage);
    }

    // ---------- 衍生日程 / 边界 ----------

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_DerivativeScheduleInWeek_CountedInTotal()
    {
        // C01: 衍生日程按 OverrideDate 计入周统计 — 衍生日程 OverrideDate 在周内，
        // 计入 total，若已打卡计入 completed。
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
        var weekStart = new DateOnly(2026, 8, 24); // 周一
        var wednesday = new DateOnly(2026, 8, 26); // 周三
        // 源日程：周四才出现
        var source = CreateActivity(familyId, childId, "钢琴课", DayOfWeek.Thursday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Schedules.Add(source);
        // 衍生日程：OverrideDate=周三
        var derivative = CreateDerivativeActivity(familyId, childId, "钢琴课(调整)", source.Id, wednesday,
            DayOfWeek.Wednesday, new TimeOnly(15, 0), new TimeOnly(16, 0));
        db.Schedules.Add(derivative);
        // 周三打卡
        db.Checkins.Add(new Domain.Entities.Checkin
        {
            ScheduleId = derivative.Id,
            Date = wednesday,
            UserId = childId,
            Source = CheckinSource.Child,
            CheckinAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        var svc = new CompletionStatsService(db);

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        // 源日程(周四) + 衍生日程(周三) = 2 total，衍生日程已打卡 = 1 completed
        Assert.Equal(2, total);
        Assert.Equal(1, completed);
        Assert.Equal(50.0, percentage);
    }

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_RepeatEndDateMidWeek_OnlyCountsBeforeEndDate()
    {
        // C02: RepeatEndDate 在周中到期 — RepeatEndDate=周三，weekStart=周一，
        // 周一至周三计入，周四至周日不计入。
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
        var weekStart = new DateOnly(2026, 8, 24); // 周一
        var wednesday = new DateOnly(2026, 8, 26); // 周三
        // 活动：每天都有 TimeSlot，但 RepeatEndDate=周三
        var activity = new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = "短期班",
            ScheduleType = ScheduleType.AfterSchoolActivity,
            FamilyId = familyId,
            AssignedChildId = childId,
            CreatedBy = childId,
            GroupKey = Guid.NewGuid(),
            RepeatEndDate = wednesday,
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
        var svc = new CompletionStatsService(db);

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        // 周一~周三 3 天计入，周四~周日 4 天不计入
        Assert.Equal(3, total);
        Assert.Equal(0, completed);
        Assert.Equal(0.0, percentage);
    }

    [Fact]
    public async Task GetChildWeeklyCompletionRateAsync_IsDeletedSchedule_NotCounted()
    {
        // C03: IsDeleted=true 日程不计入 — 日程度 IsDeleted=true，不计入 total
        var (db, familyId, childId) = await SeedAsync(CreateDbContext());
        var weekStart = new DateOnly(2026, 8, 24); // 周一
        var activity = CreateActivity(familyId, childId, "已删除课程", DayOfWeek.Monday, new TimeOnly(16, 0), new TimeOnly(17, 0));
        activity.IsDeleted = true;
        db.Schedules.Add(activity);
        await db.SaveChangesAsync();
        var svc = new CompletionStatsService(db);

        var (percentage, completed, total) = await svc.GetChildWeeklyCompletionRateAsync(childId, familyId, weekStart);

        Assert.Equal(0, total);
        Assert.Equal(0.0, percentage);
    }
}
