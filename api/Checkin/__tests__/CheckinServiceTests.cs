using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Domain.Interfaces;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace Agenda.Api.Checkin.Tests;

public class CheckinServiceTests
{
    private static int _dbCounter;
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid FamilyId = Guid.NewGuid();
    private static readonly Guid ScheduleId = Guid.NewGuid();
    private static readonly Guid AssignedChildId = Guid.NewGuid();
    private static readonly DateOnly Today = new(2026, 10, 27);
    private static readonly DateTimeOffset ServerNow = new(2026, 10, 27, 16, 0, 0, TimeSpan.FromHours(8));

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"CheckinTest_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static async Task<(AppDbContext Db, Mock<IScheduleQueryService> Query, CheckinService Service)> CreateAsync(
        ScheduleType type,
        TimeOnly? start = null,
        TimeOnly? end = null,
        DateOnly? dueDate = null,
        bool isDeleted = false,
        bool seedMembership = true)
    {
        var db = CreateDbContext();
        if (seedMembership)
        {
            db.FamilyMembers.Add(new FamilyMember
            {
                Id = Guid.NewGuid(),
                FamilyId = FamilyId,
                UserId = UserId,
                Role = UserRole.Parent,
                JoinedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var query = new Mock<IScheduleQueryService>();
        query.Setup(x => x.GetScheduleAsync(ScheduleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ScheduleInfo
            {
                ScheduleId = ScheduleId,
                Name = "测试日程",
                ScheduleType = type,
                FamilyId = FamilyId,
                AssignedChildId = AssignedChildId,
                IsDeleted = isDeleted
            });
        (TimeOnly? StartTime, TimeOnly? EndTime) timeSlot = (start, end);
        query.Setup(x => x.GetTimeSlotAsync(ScheduleId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(timeSlot);
        query.Setup(x => x.GetCancellationStatusAsync(ScheduleId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        query.Setup(x => x.IsDateExcludedAsync(ScheduleId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        query.Setup(x => x.GetDueDateAsync(ScheduleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(dueDate);

        return (db, query, new CheckinService(db, query.Object));
    }

    // ---------- 窗口查询：6 种状态 ----------

    [Fact]
    public async Task GetCheckinWindowAsync_ActivityWithinWindow_ReturnsCanCheckin()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.AfterSchoolActivity, new TimeOnly(16, 0), new TimeOnly(17, 0));

        var result = await svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, ServerNow);

        Assert.True(result.CanCheckin);
        Assert.False(result.CanUndo);
        Assert.Equal(CheckinStatus.Incomplete, result.Status);
        Assert.Null(result.Reason);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_ActivityPastGracePeriod_ReturnsEnded()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.AfterSchoolActivity, new TimeOnly(16, 0), new TimeOnly(17, 0));
        var serverTime = new DateTimeOffset(2026, 10, 27, 19, 1, 0, TimeSpan.FromHours(8));

        var result = await svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, serverTime);

        Assert.False(result.CanCheckin);
        Assert.Equal(CheckinStatus.Ended, result.Status);
        Assert.Equal(CheckinReason.TerminalState, result.Reason);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_ActivityWithinGracePeriod_ReturnsCanCheckin()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.AfterSchoolActivity, new TimeOnly(16, 0), new TimeOnly(17, 0));
        var serverTime = new DateTimeOffset(2026, 10, 27, 18, 30, 0, TimeSpan.FromHours(8));

        var result = await svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, serverTime);

        Assert.True(result.CanCheckin);
        Assert.Equal(CheckinStatus.Incomplete, result.Status);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_ActivityFutureDate_NotEndedByTodayGrace()
    {
        // 课后活动今天已过 endTime+2h，但查询的是未来日期实例，不应因今天的 endTime 误判 ended。
        var (_, _, svc) = await CreateAsync(ScheduleType.AfterSchoolActivity, new TimeOnly(16, 0), new TimeOnly(17, 0));
        var serverTime = new DateTimeOffset(2026, 10, 27, 20, 0, 0, TimeSpan.FromHours(8));
        var future = new DateOnly(2026, 10, 28);

        var result = await svc.GetCheckinWindowAsync(ScheduleId, future, UserId, serverTime);

        Assert.NotEqual(CheckinStatus.Ended, result.Status);
        Assert.False(result.CanCheckin);
        Assert.Equal(CheckinReason.Early, result.Reason);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_FutureDateRoutine_ReturnsEarly()
    {
        // 未来日期的日常作息：即使今天已过 startTime，仍按未来日期的 startTime 判定提前窗口（非今天）。
        var (_, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));
        var serverTime = new DateTimeOffset(2026, 10, 27, 12, 0, 0, TimeSpan.FromHours(8));
        var tomorrow = new DateOnly(2026, 10, 28);

        var result = await svc.GetCheckinWindowAsync(ScheduleId, tomorrow, UserId, serverTime);

        Assert.False(result.CanCheckin);
        Assert.Equal(CheckinReason.Early, result.Reason);
        Assert.True(result.RemainingSeconds > 0);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_BeforeEarlyWindow_ReturnsEarly()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(16, 0), new TimeOnly(17, 0));
        var serverTime = new DateTimeOffset(2026, 10, 27, 15, 29, 0, TimeSpan.FromHours(8));

        var result = await svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, serverTime);

        Assert.False(result.CanCheckin);
        Assert.Equal(CheckinReason.Early, result.Reason);
        Assert.True(result.RemainingSeconds > 0);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_AtEarlyWindowOpen_ReturnsCanCheckin()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(16, 0), new TimeOnly(17, 0));
        var serverTime = new DateTimeOffset(2026, 10, 27, 15, 31, 0, TimeSpan.FromHours(8));

        var result = await svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, serverTime);

        Assert.True(result.CanCheckin);
        Assert.Equal(CheckinStatus.Incomplete, result.Status);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_RoutinePastDate_ReturnsTerminalIncomplete()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));
        var serverTime = new DateTimeOffset(2026, 10, 27, 0, 1, 0, TimeSpan.FromHours(8));
        var yesterday = new DateOnly(2026, 10, 26);

        var result = await svc.GetCheckinWindowAsync(ScheduleId, yesterday, UserId, serverTime);

        Assert.False(result.CanCheckin);
        Assert.Equal(CheckinStatus.Incomplete, result.Status);
        Assert.Equal(CheckinReason.TerminalState, result.Reason);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_HomeworkPastDueDate_ReturnsOverdue()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.HomeworkTask, dueDate: new DateOnly(2026, 10, 26));
        var serverTime = new DateTimeOffset(2026, 10, 27, 8, 0, 0, TimeSpan.FromHours(8));

        var result = await svc.GetCheckinWindowAsync(ScheduleId, new DateOnly(2026, 10, 26), UserId, serverTime);

        Assert.False(result.CanCheckin);
        Assert.Equal(CheckinStatus.Overdue, result.Status);
        Assert.Equal(CheckinReason.TerminalState, result.Reason);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_HomeworkOnDueDate_ReturnsCanCheckin()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.HomeworkTask, new TimeOnly(16, 0), new TimeOnly(17, 0), dueDate: Today);

        var result = await svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, ServerNow);

        Assert.True(result.CanCheckin);
        Assert.Equal(CheckinStatus.Incomplete, result.Status);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_CancelledInstance_ReturnsCancelled()
    {
        var (_, query, svc) = await CreateAsync(ScheduleType.AfterSchoolActivity, new TimeOnly(16, 0), new TimeOnly(17, 0));
        query.Setup(x => x.GetCancellationStatusAsync(ScheduleId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, ServerNow);

        Assert.Equal(CheckinStatus.Cancelled, result.Status);
        Assert.False(result.CanCheckin);
        Assert.Equal(CheckinReason.TerminalState, result.Reason);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_ExcludedInstance_ReturnsCancelled()
    {
        var (_, query, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));
        query.Setup(x => x.IsDateExcludedAsync(ScheduleId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, ServerNow);

        Assert.Equal(CheckinStatus.Cancelled, result.Status);
        Assert.False(result.CanCheckin);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_CheckedIn_ReturnsCompletedCanUndo()
    {
        var (db, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));
        db.Checkins.Add(new Domain.Entities.Checkin
        {
            ScheduleId = ScheduleId,
            Date = Today,
            UserId = UserId,
            CheckinAt = ServerNow,
            Source = CheckinSource.Parent,
            CreatedAt = ServerNow
        });
        await db.SaveChangesAsync();

        var result = await svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, ServerNow);

        Assert.Equal(CheckinStatus.Completed, result.Status);
        Assert.True(result.CanUndo);
        Assert.False(result.CanCheckin);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_Settled_ReturnsTerminal()
    {
        var (db, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));
        db.CheckinSettlements.Add(new CheckinSettlement
        {
            ScheduleId = ScheduleId,
            Date = Today,
            Status = ScheduleStatus.Incomplete,
            SettledAt = ServerNow
        });
        await db.SaveChangesAsync();

        var result = await svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, ServerNow);

        Assert.False(result.CanCheckin);
        Assert.Equal(CheckinStatus.Incomplete, result.Status);
        Assert.Equal(CheckinReason.TerminalState, result.Reason);
    }

    // ---------- 权限 ----------

    [Fact]
    public async Task GetCheckinWindowAsync_NotFamilyMember_ThrowsNotFamilyMember()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, seedMembership: false);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, ServerNow));

        Assert.Equal(ErrorCodes.NotFamilyMember, ex.ErrorCode);
    }

    [Fact]
    public async Task GetCheckinWindowAsync_ScheduleNotFound_ThrowsScheduleNotFound()
    {
        var (_, query, svc) = await CreateAsync(ScheduleType.DailyRoutine);
        query.Setup(x => x.GetScheduleAsync(ScheduleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ScheduleInfo?)null);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.GetCheckinWindowAsync(ScheduleId, Today, UserId, ServerNow));

        Assert.Equal(ErrorCodes.ScheduleNotFound, ex.ErrorCode);
    }

    // ---------- 打卡执行 ----------

    [Fact]
    public async Task CheckinAsync_ValidWindow_CreatesRecord()
    {
        var (db, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));

        var result = await svc.CheckinAsync(ScheduleId, Today, UserId, ServerNow);

        Assert.NotEqual(0, result.CheckinId);
        Assert.Null(result.AlreadyCheckedIn);
        Assert.Equal(CheckinSource.Parent.ToString(), result.Source);

        var record = await db.Checkins.SingleAsync(c => c.ScheduleId == ScheduleId && c.Date == Today);
        Assert.Equal(UserId, record.UserId);
        Assert.Equal(CheckinSource.Parent, record.Source);
    }

    [Fact]
    public async Task CheckinAsync_PersistsUtcAndRespondsBeijingTime()
    {
        var (db, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));

        var result = await svc.CheckinAsync(ScheduleId, Today, UserId, ServerNow);

        // 持久化值 MUST 为 UTC（offset 0），且与 serverTime 同一时刻（Npgsql 10 拒绝非 UTC offset 写 timestamptz）。
        var record = await db.Checkins.SingleAsync(c => c.ScheduleId == ScheduleId && c.Date == Today);
        Assert.Equal(TimeSpan.Zero, record.CheckinAt.Offset);
        Assert.Equal(TimeSpan.Zero, record.CreatedAt.Offset);
        Assert.Equal(ServerNow.UtcDateTime, record.CheckinAt.UtcDateTime);

        // 响应值 MUST 序列化为北京时间（+08:00），客户端直接展示。
        Assert.Equal(TimeSpan.FromHours(8), result.CheckinAt.Offset);
        Assert.Equal(ServerNow, result.CheckinAt);

        // 幂等路径同样返回北京时间（ToResponse 边界转回）。
        var second = await svc.CheckinAsync(ScheduleId, Today, UserId, ServerNow);
        Assert.True(second.AlreadyCheckedIn);
        Assert.Equal(TimeSpan.FromHours(8), second.CheckinAt.Offset);
    }

    [Fact]
    public async Task CheckinAsync_AlreadyCheckedIn_ReturnsIdempotent()
    {
        var (db, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));

        var first = await svc.CheckinAsync(ScheduleId, Today, UserId, ServerNow);
        var second = await svc.CheckinAsync(ScheduleId, Today, UserId, ServerNow);

        Assert.True(second.AlreadyCheckedIn);
        Assert.Equal(first.CheckinId, second.CheckinId);
        Assert.Single(await db.Checkins.ToListAsync());
    }

    [Fact]
    public async Task CheckinAsync_Cancelled_ThrowsScheduleCancelled()
    {
        var (_, query, svc) = await CreateAsync(ScheduleType.AfterSchoolActivity, new TimeOnly(16, 0), new TimeOnly(17, 0));
        query.Setup(x => x.GetCancellationStatusAsync(ScheduleId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.CheckinAsync(ScheduleId, Today, UserId, ServerNow));

        Assert.Equal(ErrorCodes.ScheduleCancelled, ex.ErrorCode);
    }

    [Fact]
    public async Task CheckinAsync_Terminal_ThrowsTerminalState()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));
        var serverTime = new DateTimeOffset(2026, 10, 27, 0, 1, 0, TimeSpan.FromHours(8));

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.CheckinAsync(ScheduleId, new DateOnly(2026, 10, 26), UserId, serverTime));

        Assert.Equal(ErrorCodes.TerminalState, ex.ErrorCode);
    }

    [Fact]
    public async Task CheckinAsync_EarlyWindow_ThrowsCheckinWindowClosed()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(16, 0), new TimeOnly(17, 0));
        var serverTime = new DateTimeOffset(2026, 10, 27, 15, 29, 0, TimeSpan.FromHours(8));

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.CheckinAsync(ScheduleId, Today, UserId, serverTime));

        Assert.Equal(ErrorCodes.CheckinWindowClosed, ex.ErrorCode);
    }

    // ---------- 撤销 ----------

    [Fact]
    public async Task UndoAsync_ValidWindow_DeletesRecord()
    {
        var (db, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));
        await svc.CheckinAsync(ScheduleId, Today, UserId, ServerNow);

        var result = await svc.UndoAsync(ScheduleId, Today, UserId, ServerNow);

        Assert.True(result.Undone);
        Assert.Equal(CheckinStatus.Incomplete, result.Status);
        Assert.Empty(await db.Checkins.ToListAsync());
    }

    [Fact]
    public async Task UndoAsync_NotCheckedIn_ThrowsNotCheckedIn()
    {
        var (_, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.UndoAsync(ScheduleId, Today, UserId, ServerNow));

        Assert.Equal(ErrorCodes.NotCheckedIn, ex.ErrorCode);
    }

    [Fact]
    public async Task UndoAsync_Settled_ThrowsTerminalState()
    {
        var (db, _, svc) = await CreateAsync(ScheduleType.DailyRoutine, new TimeOnly(7, 0), new TimeOnly(8, 0));
        db.Checkins.Add(new Domain.Entities.Checkin
        {
            ScheduleId = ScheduleId,
            Date = Today,
            UserId = UserId,
            CheckinAt = ServerNow,
            Source = CheckinSource.Parent,
            CreatedAt = ServerNow
        });
        db.CheckinSettlements.Add(new CheckinSettlement
        {
            ScheduleId = ScheduleId,
            Date = Today,
            Status = ScheduleStatus.Incomplete,
            SettledAt = ServerNow
        });
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.UndoAsync(ScheduleId, Today, UserId, ServerNow));

        Assert.Equal(ErrorCodes.TerminalState, ex.ErrorCode);
    }

    [Fact]
    public async Task UndoAsync_ActivityPastGracePeriod_ThrowsWindowClosed()
    {
        var (db, _, svc) = await CreateAsync(ScheduleType.AfterSchoolActivity, new TimeOnly(16, 0), new TimeOnly(17, 0));
        db.Checkins.Add(new Domain.Entities.Checkin
        {
            ScheduleId = ScheduleId,
            Date = Today,
            UserId = UserId,
            CheckinAt = ServerNow,
            Source = CheckinSource.Parent,
            CreatedAt = ServerNow
        });
        await db.SaveChangesAsync();
        var serverTime = new DateTimeOffset(2026, 10, 27, 19, 1, 0, TimeSpan.FromHours(8));

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => svc.UndoAsync(ScheduleId, Today, UserId, serverTime));

        Assert.Equal(ErrorCodes.WindowClosed, ex.ErrorCode);
    }

    // ---------- 数据模型约束（幂等最后防线） ----------

    [Fact]
    public void Model_Checkin_HasUniqueScheduleIdDateIndex()
    {
        var db = CreateDbContext();
        var entity = db.Model.FindEntityType(typeof(Domain.Entities.Checkin))!;

        var uniqueIndex = entity.GetIndexes().SingleOrDefault(i => i.IsUnique
            && i.Properties.Count == 2
            && i.Properties.Any(p => p.Name == nameof(Domain.Entities.Checkin.ScheduleId))
            && i.Properties.Any(p => p.Name == nameof(Domain.Entities.Checkin.Date)));

        Assert.NotNull(uniqueIndex);
    }
}
