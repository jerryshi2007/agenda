using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Microsoft.Extensions.Logging;

namespace Agenda.Api.Schedule.Services.Tests;

public class ScheduleServiceTests
{
    private static int _dbCounter;

    private AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: $"EventTest_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var db = new AppDbContext(options);
        return db;
    }

    private Mock<ILogger<ScheduleService>> CreateLogger() => new();

    private sealed class SeedResult
    {
        public Guid FamilyId { get; init; }
        public Guid UserId { get; init; }
    }

    private async Task<SeedResult> SeedFamilyAsync(AppDbContext db)
    {
        var userId = Guid.NewGuid();
        var familyId = Guid.NewGuid();
        db.Users.Add(new User { Id = userId, Nickname = "TestParent", Role = UserRole.Parent, OpenId = "test-openid" });
        db.Families.Add(new DomainFamily { Id = familyId, Name = "TestFamily" });
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = familyId,
            UserId = userId,
            Role = UserRole.Parent,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        return new SeedResult { FamilyId = familyId, UserId = userId };
    }

    [Fact]
    public async Task CreateAsync_WithValidRequest_CreatesEventsWithTimeSlots()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);
        var childId = Guid.NewGuid();

        var request = new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            ChildIds = [childId],
            TimeSlots =
            [
                new TimeSlotDto { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) },
                new TimeSlotDto { DayOfWeek = DayOfWeek.Thursday, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
            ],
            RepeatEndDate = new DateOnly(2026, 12, 31),
            Location = "少年宫3楼",
            Notes = "记得带琴谱"
        };

        var result = await service.CreateAsync(seed.FamilyId, seed.UserId, request);

        Assert.NotEqual(Guid.Empty, result.GroupKey);
        Assert.Single(result.Schedules);
        var evt = result.Schedules[0];
        Assert.Equal(childId, evt.AssignedChildId);
        Assert.Equal("钢琴课", evt.Name);
        Assert.Equal("AfterSchoolActivity", evt.ScheduleType);
        Assert.Equal(2, evt.TimeSlots.Count);

        var dbEvents = await db.Schedules.Include(e => e.TimeSlots).ToListAsync();
        Assert.Single(dbEvents);
        Assert.Equal(2, dbEvents[0].TimeSlots.Count);
    }

    [Fact]
    public async Task CreateAsync_WithMultipleChildren_CreatesMultipleEvents()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);

        var request = new CreateScheduleRequest
        {
            Name = "游泳课",
            ScheduleType = "AfterSchoolActivity",
            ChildIds = [Guid.NewGuid(), Guid.NewGuid()],
            TimeSlots =
            [
                new TimeSlotDto { DayOfWeek = DayOfWeek.Wednesday, StartTime = new TimeOnly(15, 0), EndTime = new TimeOnly(16, 0) }
            ]
        };

        var result = await service.CreateAsync(seed.FamilyId, seed.UserId, request);

        Assert.Equal(2, result.Schedules.Count);
        Assert.Equal(result.Schedules[0].Name, result.Schedules[1].Name);

        var dbEvents = await db.Schedules.ToListAsync();
        Assert.Equal(2, dbEvents.Count);
    }

    [Fact]
    public async Task CreateAsync_HomeworkTask_DoesNotCreateTimeSlots()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);

        var request = new CreateScheduleRequest
        {
            Name = "数学作业",
            ScheduleType = "HomeworkTask",
            ChildIds = [Guid.NewGuid()],
            DueDate = new DateOnly(2026, 12, 31),
            Notes = "第3章习题"
        };

        var result = await service.CreateAsync(seed.FamilyId, seed.UserId, request);

        Assert.Single(result.Schedules);

        var dbEvent = await db.Schedules.Include(e => e.TimeSlots).FirstAsync();
        Assert.Empty(dbEvent.TimeSlots);
        Assert.Equal(new DateOnly(2026, 12, 31), dbEvent.DueDate);
    }

    [Fact]
    public async Task GetByIdAsync_ExistingEvent_ReturnsScheduleResponse()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);
        var childId = Guid.NewGuid();

        var request = new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            ChildIds = [childId],
            TimeSlots =
            [
                new TimeSlotDto { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
            ],
            RepeatEndDate = new DateOnly(2026, 12, 31)
        };

        var created = await service.CreateAsync(seed.FamilyId, seed.UserId, request);
        var eventId = created.Schedules[0].ScheduleId;

        var result = await service.GetByIdAsync(eventId, null, seed.UserId, seed.FamilyId, UserRole.Parent);

        Assert.NotNull(result);
        Assert.Equal("钢琴课", result!.Name);
        Assert.Equal("AfterSchoolActivity", result.ScheduleType);
        Assert.Single(result.TimeSlots);
        Assert.False(result.IsCancelled);
        Assert.False(result.IsExcluded);
        Assert.True(result.CanEdit);
        Assert.True(result.CanCancel);
    }

    [Fact]
    public async Task GetByIdAsync_ChildAccess_OtherChild_ThrowsAccessDenied()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);

        var request = new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            ChildIds = [Guid.NewGuid()],
            TimeSlots =
            [
                new TimeSlotDto { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
            ]
        };

        var created = await service.CreateAsync(seed.FamilyId, seed.UserId, request);
        var eventId = created.Schedules[0].ScheduleId;

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => service.GetByIdAsync(eventId, null, Guid.NewGuid(), seed.FamilyId, UserRole.Child));
    }

    [Fact]
    public async Task CancelInstanceAsync_HomeworkTask_ThrowsError()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);

        var request = new CreateScheduleRequest
        {
            Name = "数学作业",
            ScheduleType = "HomeworkTask",
            ChildIds = [Guid.NewGuid()],
            DueDate = new DateOnly(2026, 12, 31)
        };

        var created = await service.CreateAsync(seed.FamilyId, seed.UserId, request);
        var eventId = created.Schedules[0].ScheduleId;

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CancelInstanceAsync(eventId, new DateOnly(2026, 12, 31), seed.UserId, seed.FamilyId));
        Assert.Equal("HOMEWORK_NO_CANCEL", ex.Message);
    }

    [Fact]
    public async Task CancelInstanceAsync_AlreadyCancelled_ThrowsError()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);
        var date = new DateOnly(2026, 12, 31);

        var request = new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            ChildIds = [Guid.NewGuid()],
            TimeSlots =
            [
                new TimeSlotDto { DayOfWeek = date.DayOfWeek, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
            ],
            RepeatEndDate = new DateOnly(2026, 12, 31)
        };

        var created = await service.CreateAsync(seed.FamilyId, seed.UserId, request);
        var eventId = created.Schedules[0].ScheduleId;

        await service.CancelInstanceAsync(eventId, date, seed.UserId, seed.FamilyId);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CancelInstanceAsync(eventId, date, seed.UserId, seed.FamilyId));
        Assert.Equal("SCHEDULE_ALREADY_CANCELLED", ex.Message);
    }

    [Fact]
    public async Task CancelInstanceAsync_AndRestore_WorksAsExpected()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);
        var date = new DateOnly(2026, 12, 31);

        var request = new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            ChildIds = [Guid.NewGuid()],
            TimeSlots =
            [
                new TimeSlotDto { DayOfWeek = date.DayOfWeek, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
            ],
            RepeatEndDate = new DateOnly(2026, 12, 31)
        };

        var created = await service.CreateAsync(seed.FamilyId, seed.UserId, request);
        var eventId = created.Schedules[0].ScheduleId;

        var cancelResult = await service.CancelInstanceAsync(eventId, date, seed.UserId, seed.FamilyId);
        Assert.True(cancelResult.Cancelled);

        var afterCancel = await service.GetByIdAsync(eventId, date, seed.UserId, seed.FamilyId, UserRole.Parent);
        Assert.True(afterCancel!.IsCancelled);

        var restoreResult = await service.RestoreInstanceAsync(eventId, date, seed.UserId, seed.FamilyId);
        Assert.True(restoreResult.Restored);
        Assert.Equal("cancellation", restoreResult.RestoredFrom);

        var afterRestore = await service.GetByIdAsync(eventId, date, seed.UserId, seed.FamilyId, UserRole.Parent);
        Assert.False(afterRestore!.IsCancelled);
    }

    [Fact]
    public async Task DeleteAsync_ThisOnly_CreatesScheduleDateExclusion()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);
        var date = new DateOnly(2026, 12, 31);

        var request = new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            ChildIds = [Guid.NewGuid()],
            TimeSlots =
            [
                new TimeSlotDto { DayOfWeek = date.DayOfWeek, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
            ],
            RepeatEndDate = new DateOnly(2026, 12, 31)
        };

        var created = await service.CreateAsync(seed.FamilyId, seed.UserId, request);
        var eventId = created.Schedules[0].ScheduleId;

        var deleteResult = await service.DeleteAsync(eventId, "ThisOnly", date, seed.UserId, seed.FamilyId);
        Assert.True(deleteResult.Deleted);
        Assert.Equal("exclusion", deleteResult.Method);

        var exclusions = await db.ScheduleDateExclusions.ToListAsync();
        Assert.Single(exclusions);
        Assert.Equal(eventId, exclusions[0].ScheduleId);
        Assert.Equal(date, exclusions[0].ExcludedDate);
    }

    [Fact]
    public async Task DeleteAsync_ThisAndFuture_TruncatesRepeatEndDate()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);
        var date = new DateOnly(2026, 10, 15);

        var request = new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            ChildIds = [Guid.NewGuid()],
            TimeSlots =
            [
                new TimeSlotDto { DayOfWeek = date.DayOfWeek, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
            ],
            RepeatEndDate = new DateOnly(2026, 12, 31)
        };

        var created = await service.CreateAsync(seed.FamilyId, seed.UserId, request);
        var eventId = created.Schedules[0].ScheduleId;

        var deleteResult = await service.DeleteAsync(eventId, "ThisAndFuture", date, seed.UserId, seed.FamilyId);
        Assert.True(deleteResult.Deleted);
        Assert.Equal("truncate", deleteResult.Method);
        Assert.Equal(new DateOnly(2026, 10, 14), deleteResult.TruncatedRepeatEndDate);

        var dbEvent = await db.Schedules.FirstAsync();
        Assert.Equal(new DateOnly(2026, 10, 14), dbEvent.RepeatEndDate);
    }

    [Fact]
    public async Task UpdateAsync_WithRowVersionMismatch_ThrowsConcurrencyError()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);

        var request = new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            ChildIds = [Guid.NewGuid()],
            TimeSlots =
            [
                new TimeSlotDto { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
            ]
        };

        var created = await service.CreateAsync(seed.FamilyId, seed.UserId, request);
        var eventId = created.Schedules[0].ScheduleId;

        var updateRequest = new UpdateScheduleRequest
        {
            Scope = "ThisAndFuture",
            Name = "钢琴课(改)",
            RowVersion = [0xFF, 0xFF]
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.UpdateAsync(eventId, updateRequest, seed.UserId, seed.FamilyId));
        Assert.Equal("CONCURRENT_EDIT_CONFLICT", ex.Message);
    }

    [Fact]
    public async Task RestoreInstanceAsync_NotCancelledOrExcluded_ThrowsError()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);
        var date = new DateOnly(2026, 12, 31);

        var request = new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            ChildIds = [Guid.NewGuid()],
            TimeSlots =
            [
                new TimeSlotDto { DayOfWeek = date.DayOfWeek, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(17, 0) }
            ],
            RepeatEndDate = new DateOnly(2026, 12, 31)
        };

        var created = await service.CreateAsync(seed.FamilyId, seed.UserId, request);
        var eventId = created.Schedules[0].ScheduleId;

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.RestoreInstanceAsync(eventId, date, seed.UserId, seed.FamilyId));
        Assert.Equal("NOT_CANCELLED_OR_EXCLUDED", ex.Message);
    }

    [Fact]
    public async Task DeleteAsync_HomeworkTask_SoftDeletes()
    {
        var db = CreateDbContext();
        var seed = await SeedFamilyAsync(db);
        var service = new ScheduleService(db, CreateLogger().Object);

        var request = new CreateScheduleRequest
        {
            Name = "数学作业",
            ScheduleType = "HomeworkTask",
            ChildIds = [Guid.NewGuid()],
            DueDate = new DateOnly(2026, 12, 31)
        };

        var created = await service.CreateAsync(seed.FamilyId, seed.UserId, request);
        var eventId = created.Schedules[0].ScheduleId;

        var deleteResult = await service.DeleteAsync(eventId, "ThisOnly", null, seed.UserId, seed.FamilyId);
        Assert.True(deleteResult.Deleted);
        Assert.Equal("soft_delete", deleteResult.Method);

        var dbEvent = await db.Schedules.IgnoreQueryFilters().FirstAsync();
        Assert.True(dbEvent.IsDeleted);
    }
}
