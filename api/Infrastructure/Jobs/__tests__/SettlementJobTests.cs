using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Domain.Interfaces;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Infrastructure.Jobs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Agenda.Api.Infrastructure.Jobs.Tests;

public class SettlementJobTests
{
    private static int _dbCounter;
    private static readonly Guid ChildId = Guid.NewGuid();
    private static readonly Guid FamilyId = Guid.NewGuid();
    private static readonly DateOnly Yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8).AddDays(-1));

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"SettlementTest_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Domain.Entities.Schedule NewSchedule(ScheduleType type, Guid childId, DateOnly? dueDate = null)
    {
        return new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = "测试日程",
            ScheduleType = type,
            FamilyId = FamilyId,
            AssignedChildId = childId,
            CreatedBy = Guid.NewGuid(),
            GroupKey = Guid.NewGuid(),
            RepeatEndDate = null,
            DueDate = dueDate,
            RowVersion = Guid.NewGuid().ToByteArray(),
            IsDeleted = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    private static (AppDbContext Db, Mock<IScheduleQueryService> Query, SettlementJob Job) CreateJob()
    {
        var db = CreateDbContext();
        var query = new Mock<IScheduleQueryService>();
        query.Setup(x => x.GetCancellationStatusAsync(It.IsAny<Guid>(), It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        query.Setup(x => x.IsDateExcludedAsync(It.IsAny<Guid>(), It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        return (db, query, new SettlementJob(db, query.Object, NullLogger<SettlementJob>.Instance));
    }

    private static async Task SeedScheduleAsync(
        AppDbContext db, Domain.Entities.Schedule schedule, bool withTimeSlot, bool checkedIn)
    {
        if (withTimeSlot)
        {
            schedule.TimeSlots.Add(new TimeSlot
            {
                ScheduleId = schedule.Id,
                DayOfWeek = Yesterday.DayOfWeek,
                StartTime = new TimeOnly(7, 0),
                EndTime = new TimeOnly(8, 0)
            });
        }
        db.Schedules.Add(schedule);
        await db.SaveChangesAsync();

        if (checkedIn)
        {
            db.Checkins.Add(new Domain.Entities.Checkin
            {
                ScheduleId = schedule.Id,
                Date = Yesterday,
                UserId = schedule.AssignedChildId,
                CheckinAt = DateTimeOffset.UtcNow,
                Source = CheckinSource.Child,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task ExecuteAsync_SettlesAllThreeTypes_ToTerminalStatus()
    {
        var (db, _, job) = CreateJob();
        var routine = NewSchedule(ScheduleType.DailyRoutine, ChildId);
        var activity = NewSchedule(ScheduleType.AfterSchoolActivity, ChildId);
        var homework = NewSchedule(ScheduleType.HomeworkTask, ChildId, dueDate: Yesterday);
        await SeedScheduleAsync(db, routine, withTimeSlot: true, checkedIn: false);
        await SeedScheduleAsync(db, activity, withTimeSlot: true, checkedIn: false);
        await SeedScheduleAsync(db, homework, withTimeSlot: false, checkedIn: false);

        await job.ExecuteAsync(CancellationToken.None);

        var settlements = await db.CheckinSettlements.ToListAsync();
        Assert.Equal(3, settlements.Count);
        Assert.Equal(ScheduleStatus.Incomplete, settlements.Single(s => s.ScheduleId == routine.Id).Status);
        Assert.Equal(ScheduleStatus.Ended, settlements.Single(s => s.ScheduleId == activity.Id).Status);
        Assert.Equal(ScheduleStatus.Overdue, settlements.Single(s => s.ScheduleId == homework.Id).Status);
    }

    [Fact]
    public async Task ExecuteAsync_SkipsCheckedInInstance()
    {
        var (db, _, job) = CreateJob();
        var checkedIn = NewSchedule(ScheduleType.DailyRoutine, ChildId);
        var uncheckedIn = NewSchedule(ScheduleType.DailyRoutine, ChildId);
        await SeedScheduleAsync(db, checkedIn, withTimeSlot: true, checkedIn: true);
        await SeedScheduleAsync(db, uncheckedIn, withTimeSlot: true, checkedIn: false);

        await job.ExecuteAsync(CancellationToken.None);

        var settlements = await db.CheckinSettlements.ToListAsync();
        Assert.Single(settlements);
        Assert.Equal(uncheckedIn.Id, settlements[0].ScheduleId);
    }

    [Fact]
    public async Task ExecuteAsync_SkipsCancelledInstance()
    {
        var (db, query, job) = CreateJob();
        var cancelled = NewSchedule(ScheduleType.DailyRoutine, ChildId);
        await SeedScheduleAsync(db, cancelled, withTimeSlot: true, checkedIn: false);
        query.Setup(x => x.GetCancellationStatusAsync(cancelled.Id, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        await job.ExecuteAsync(CancellationToken.None);

        Assert.Empty(await db.CheckinSettlements.ToListAsync());
    }

    [Fact]
    public async Task ExecuteAsync_IsIdempotent()
    {
        var (db, _, job) = CreateJob();
        var routine = NewSchedule(ScheduleType.DailyRoutine, ChildId);
        await SeedScheduleAsync(db, routine, withTimeSlot: true, checkedIn: false);

        await job.ExecuteAsync(CancellationToken.None);
        await job.ExecuteAsync(CancellationToken.None);

        Assert.Single(await db.CheckinSettlements.ToListAsync());
    }

    [Fact]
    public async Task ExecuteAsync_StreakIncrement_WhenCheckedIn()
    {
        var (db, _, job) = CreateJob();
        var routine = NewSchedule(ScheduleType.DailyRoutine, ChildId);
        await SeedScheduleAsync(db, routine, withTimeSlot: true, checkedIn: true);

        await job.ExecuteAsync(CancellationToken.None);

        var scheduleStreak = await db.Streaks.SingleAsync(s => s.Scope == StreakScope.Schedule && s.SubjectId == routine.Id);
        var childStreak = await db.Streaks.SingleAsync(s => s.Scope == StreakScope.Child && s.SubjectId == ChildId);
        Assert.Equal(1, scheduleStreak.CurrentStreak);
        Assert.Equal(1, childStreak.CurrentStreak);
        Assert.Equal(Yesterday, scheduleStreak.LastSettledDate);
    }

    [Fact]
    public async Task ExecuteAsync_StreakReset_WhenNotCheckedIn()
    {
        var (db, _, job) = CreateJob();
        var routine = NewSchedule(ScheduleType.DailyRoutine, ChildId);
        await SeedScheduleAsync(db, routine, withTimeSlot: true, checkedIn: false);

        await job.ExecuteAsync(CancellationToken.None);

        var scheduleStreak = await db.Streaks.SingleAsync(s => s.Scope == StreakScope.Schedule && s.SubjectId == routine.Id);
        var childStreak = await db.Streaks.SingleAsync(s => s.Scope == StreakScope.Child && s.SubjectId == ChildId);
        Assert.Equal(0, scheduleStreak.CurrentStreak);
        Assert.Equal(0, childStreak.CurrentStreak);
    }

    [Fact]
    public async Task ExecuteAsync_AllCancelled_NoStreakChange()
    {
        var (db, query, job) = CreateJob();
        var cancelled = NewSchedule(ScheduleType.DailyRoutine, ChildId);
        await SeedScheduleAsync(db, cancelled, withTimeSlot: true, checkedIn: false);
        query.Setup(x => x.GetCancellationStatusAsync(cancelled.Id, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        await job.ExecuteAsync(CancellationToken.None);

        Assert.Empty(await db.Streaks.ToListAsync());
    }

    [Fact]
    public async Task ExecuteAsync_StreakIdempotent_OnRerun()
    {
        var (db, _, job) = CreateJob();
        var routine = NewSchedule(ScheduleType.DailyRoutine, ChildId);
        await SeedScheduleAsync(db, routine, withTimeSlot: true, checkedIn: true);

        await job.ExecuteAsync(CancellationToken.None);
        await job.ExecuteAsync(CancellationToken.None);

        var scheduleStreak = await db.Streaks.SingleAsync(s => s.Scope == StreakScope.Schedule && s.SubjectId == routine.Id);
        Assert.Equal(1, scheduleStreak.CurrentStreak); // 幂等：重复结算不重复累加
    }
}
