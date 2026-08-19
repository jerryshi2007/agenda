using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Template.Dtos;
using Agenda.Api.Template.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Agenda.Api.Template.Tests;

/// <summary>
/// TemplateService 单元测试：覆盖 CRUD 正常 + 异常路径、跨家庭隔离、usageCount 统计。
/// 使用 InMemory database 隔离每次测试。
/// </summary>
public class TemplateServiceTests
{
    private static int _dbCounter;
    private static readonly Guid FamilyA = Guid.NewGuid();
    private static readonly Guid FamilyB = Guid.NewGuid();
    private static readonly Guid UserA = Guid.NewGuid();
    private static readonly Guid UserOther = Guid.NewGuid();
    private static readonly Guid ChildA = Guid.NewGuid();

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"TemplateTest_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static TemplateService CreateService(AppDbContext db)
    {
        var scheduleService = new Mock<IScheduleService>();
        scheduleService
            .Setup(x => x.CreateAsync(It.IsAny<Guid>(), It.IsAny<Guid>(),
                It.IsAny<CreateScheduleRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid f, Guid u, CreateScheduleRequest r, CancellationToken _) =>
                new CreateScheduleResponse
                {
                    GroupKey = Guid.NewGuid(),
                    Schedules = r.ChildIds.Select(c => new ScheduleSummary
                    {
                        ScheduleId = Guid.NewGuid(),
                        AssignedChildId = c,
                        Name = r.Name,
                        ScheduleType = r.ScheduleType,
                        TimeSlots = r.TimeSlots.Select(t => new TimeSlotDto
                        {
                            DayOfWeek = t.DayOfWeek,
                            StartTime = t.StartTime,
                            EndTime = t.EndTime
                        }).ToList(),
                        RepeatEndDate = r.RepeatEndDate,
                        Location = r.Location,
                        Notes = r.Notes,
                        CreatedAt = DateTimeOffset.UtcNow
                    }).ToList()
                });
        var logger = new Mock<ILogger<TemplateService>>().Object;
        return new TemplateService(db, scheduleService.Object, logger);
    }

    private static CreateTemplateRequest SampleRequest(ScheduleType type = ScheduleType.DailyRoutine) =>
        new()
        {
            Name = "我的模板",
            ScheduleType = type.ToString(),
            TimeSlots = type == ScheduleType.HomeworkTask
                ? new()
                : new List<TemplateTimeSlotDto>
                {
                    new() { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(10, 0) }
                },
            Location = "家",
            Notes = "备注"
        };

    // ---------- CreateAsync ----------

    [Fact]
    public async Task CreateAsync_ValidRequest_PersistsTemplate()
    {
        var db = CreateDbContext();
        var service = CreateService(db);

        var result = await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        Assert.NotEqual(Guid.Empty, result.TemplateId);
        Assert.Equal("我的模板", result.Name);
        Assert.False(result.IsPreset);
        Assert.Single(result.TimeSlots);
        var stored = await db.Templates.Include(t => t.TimeSlots).FirstOrDefaultAsync();
        Assert.NotNull(stored);
        Assert.Single(stored!.TimeSlots);
    }

    [Fact]
    public async Task CreateAsync_HomeworkWithoutTimeSlots_Succeeds()
    {
        var db = CreateDbContext();
        var service = CreateService(db);

        var result = await service.CreateAsync(FamilyA, UserA, SampleRequest(ScheduleType.HomeworkTask), default);

        Assert.Empty(result.TimeSlots);
    }

    [Fact]
    public async Task CreateAsync_DuplicateNameInSameFamily_ThrowsTemplateDuplicateName()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            service.CreateAsync(FamilyA, UserA, SampleRequest(), default));
        Assert.Equal(ErrorCodes.TemplateDuplicateName, ex.ErrorCode);
    }

    [Fact]
    public async Task CreateAsync_SameNameInDifferentFamily_Succeeds()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        var result = await service.CreateAsync(FamilyB, UserA, SampleRequest(), default);
        Assert.NotEqual(Guid.Empty, result.TemplateId);
    }

    [Fact]
    public async Task CreateAsync_InvalidScheduleType_ThrowsTemplateTypeInvalid()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var req = SampleRequest();
        var bad = req with { ScheduleType = "InvalidType" };

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            service.CreateAsync(FamilyA, UserA, bad, default));
        Assert.Equal(ErrorCodes.TemplateTypeInvalid, ex.ErrorCode);
    }

    // ---------- UpdateAsync ----------

    [Fact]
    public async Task UpdateAsync_AsOwner_UpdatesTemplate()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var created = await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        var update = new UpdateTemplateRequest
        {
            Name = "新名字",
            TimeSlots = new List<TemplateTimeSlotDto>
            {
                new() { DayOfWeek = DayOfWeek.Friday, StartTime = new TimeOnly(8, 0), EndTime = new TimeOnly(9, 0) }
            },
            Location = "学校"
        };

        var result = await service.UpdateAsync(created.TemplateId, UserA, update, default);

        Assert.Equal("新名字", result.Name);
        Assert.Equal("学校", result.Location);
        Assert.Single(result.TimeSlots);
        Assert.Equal(DayOfWeek.Friday, result.TimeSlots[0].DayOfWeek);
    }

    [Fact]
    public async Task UpdateAsync_AsNonOwner_ThrowsTemplateNotOwner()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var created = await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            service.UpdateAsync(created.TemplateId, UserOther, new UpdateTemplateRequest
            {
                Name = "x",
                TimeSlots = new()
            }, default));
        Assert.Equal(ErrorCodes.TemplateNotOwner, ex.ErrorCode);
    }

    [Fact]
    public async Task UpdateAsync_OnPreset_ThrowsTemplatePresetReadonly()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var preset = new DomainTemplate
        {
            Id = Guid.NewGuid(),
            Name = "预设",
            ScheduleType = ScheduleType.DailyRoutine,
            IsPreset = true,
            CreatedBy = Guid.Empty,
            IsDeleted = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Templates.Add(preset);
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            service.UpdateAsync(preset.Id, UserA, new UpdateTemplateRequest
            {
                Name = "x",
                TimeSlots = new()
            }, default));
        Assert.Equal(ErrorCodes.TemplatePresetReadonly, ex.ErrorCode);
    }

    // ---------- DeleteAsync ----------

    [Fact]
    public async Task DeleteAsync_AsOwner_SoftDeletesTemplate()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var created = await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        var result = await service.DeleteAsync(created.TemplateId, UserA, default);

        Assert.True(result.Deleted);
        var stored = await db.Templates.IgnoreQueryFilters().FirstAsync(t => t.Id == created.TemplateId);
        Assert.True(stored.IsDeleted);
    }

    [Fact]
    public async Task DeleteAsync_AsNonOwner_ThrowsTemplateNotOwner()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var created = await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            service.DeleteAsync(created.TemplateId, UserOther, default));
        Assert.Equal(ErrorCodes.TemplateNotOwner, ex.ErrorCode);
    }

    [Fact]
    public async Task DeleteAsync_Preset_ThrowsTemplatePresetReadonly()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var preset = new DomainTemplate
        {
            Id = Guid.NewGuid(),
            Name = "预设",
            ScheduleType = ScheduleType.DailyRoutine,
            IsPreset = true,
            CreatedBy = Guid.Empty,
            IsDeleted = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Templates.Add(preset);
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            service.DeleteAsync(preset.Id, UserA, default));
        Assert.Equal(ErrorCodes.TemplatePresetReadonly, ex.ErrorCode);
    }

    // ---------- GetByIdAsync ----------

    [Fact]
    public async Task GetByIdAsync_CrossFamilyTemplate_ReturnsNull()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var created = await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        var result = await service.GetByIdAsync(created.TemplateId, FamilyB, default);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetByIdAsync_PresetTemplate_AccessibleFromAnyFamily()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var preset = new DomainTemplate
        {
            Id = Guid.NewGuid(),
            Name = "预设模板",
            ScheduleType = ScheduleType.DailyRoutine,
            IsPreset = true,
            CreatedBy = Guid.Empty,
            IsDeleted = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        preset.TimeSlots.Add(new DomainTemplateTimeSlot
        {
            DayOfWeek = DayOfWeek.Monday,
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(10, 0)
        });
        db.Templates.Add(preset);
        await db.SaveChangesAsync();

        var result = await service.GetByIdAsync(preset.Id, FamilyB, default);

        Assert.NotNull(result);
        Assert.True(result!.IsPreset);
        Assert.Single(result.TimeSlots);
    }

    // ---------- ListAsync ----------

    [Fact]
    public async Task ListAsync_ReturnsPresetsAndCustomInSameFamily()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        // Add a preset
        var preset = new DomainTemplate
        {
            Id = Guid.NewGuid(),
            Name = "预设A",
            ScheduleType = ScheduleType.DailyRoutine,
            IsPreset = true,
            CreatedBy = Guid.Empty,
            IsDeleted = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Templates.Add(preset);
        await db.SaveChangesAsync();
        // Add custom for FamilyA
        await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);
        // Add custom for FamilyB
        await service.CreateAsync(FamilyB, UserA, SampleRequest(), default);

        var result = await service.ListAsync(FamilyA, null, null, null, 1, 20, default);

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(2, result.Items.Count);
        // Preset first
        Assert.True(result.Items[0].IsPreset);
        Assert.False(result.Items[1].IsPreset);
    }

    [Fact]
    public async Task ListAsync_KeywordFilter_MatchesName()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        var result = await service.ListAsync(FamilyA, "我的", null, null, 1, 20, default);

        Assert.Single(result.Items);
        Assert.Contains("我的", result.Items[0].Name);
    }

    [Fact]
    public async Task ListAsync_IsPresetFilter_OnlyReturnsPresets()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var preset = new DomainTemplate
        {
            Id = Guid.NewGuid(),
            Name = "预设X",
            ScheduleType = ScheduleType.DailyRoutine,
            IsPreset = true,
            CreatedBy = Guid.Empty,
            IsDeleted = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Templates.Add(preset);
        await db.SaveChangesAsync();
        await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        var result = await service.ListAsync(FamilyA, null, null, true, 1, 20, default);

        Assert.Single(result.Items);
        Assert.True(result.Items[0].IsPreset);
    }

    // ---------- ApplyAsync ----------

    [Fact]
    public async Task ApplyAsync_ValidRequest_CreatesScheduleWithSourceTemplateId()
    {
        var db = CreateDbContext();
        // Seed child membership
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = FamilyA,
            UserId = ChildA,
            Role = UserRole.Child,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var created = await CreateService(db).CreateAsync(FamilyA, UserA, SampleRequest(), default);
        var service = CreateService(db);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var result = await service.ApplyAsync(
            created.TemplateId,
            FamilyA,
            UserA,
            new ApplyTemplateRequest
            {
                ChildId = ChildA,
                StartDate = today,
                Name = "覆盖名称"
            },
            default);

        Assert.Single(result.Schedules);
        Assert.Equal("覆盖名称", result.Schedules[0].Name);
        Assert.Equal(ChildA, result.Schedules[0].AssignedChildId);
    }

    [Fact]
    public async Task ApplyAsync_ChildNotInFamily_ThrowsChildNotInFamily()
    {
        var db = CreateDbContext();
        var created = await CreateService(db).CreateAsync(FamilyA, UserA, SampleRequest(), default);
        var service = CreateService(db);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            service.ApplyAsync(
                created.TemplateId,
                FamilyA,
                UserA,
                new ApplyTemplateRequest { ChildId = Guid.NewGuid(), StartDate = today },
                default));
        Assert.Equal(ErrorCodes.TemplateChildNotInFamily, ex.ErrorCode);
    }

    [Fact]
    public async Task ApplyAsync_ChildRoleUser_ThrowsChildNotInFamily()
    {
        var db = CreateDbContext();
        // Seed a parent user
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = FamilyA,
            UserId = Guid.NewGuid(),
            Role = UserRole.Parent,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var created = await CreateService(db).CreateAsync(FamilyA, UserA, SampleRequest(), default);
        var service = CreateService(db);

        // Pick a parent-role user as childId (not a child)
        var parentId = await db.FamilyMembers
            .Where(fm => fm.FamilyId == FamilyA && fm.Role == UserRole.Parent)
            .Select(fm => fm.UserId)
            .FirstAsync();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            service.ApplyAsync(
                created.TemplateId,
                FamilyA,
                UserA,
                new ApplyTemplateRequest { ChildId = parentId, StartDate = today },
                default));
        Assert.Equal(ErrorCodes.TemplateChildNotInFamily, ex.ErrorCode);
    }

    [Fact]
    public async Task ApplyAsync_TemplateFromOtherFamily_ThrowsTemplateNotFound()
    {
        var db = CreateDbContext();
        // Create a custom template in FamilyB
        var created = await CreateService(db).CreateAsync(FamilyB, UserA, SampleRequest(), default);

        // Try to apply from FamilyA
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = FamilyA,
            UserId = ChildA,
            Role = UserRole.Child,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            service.ApplyAsync(
                created.TemplateId,
                FamilyA,
                UserA,
                new ApplyTemplateRequest { ChildId = ChildA, StartDate = today },
                default));
        Assert.Equal(ErrorCodes.TemplateNotFound, ex.ErrorCode);
    }

    [Fact]
    public async Task ApplyAsync_OverridesTimeSlotsAndLocation_WhenProvided()
    {
        var db = CreateDbContext();
        db.FamilyMembers.Add(new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = FamilyA,
            UserId = ChildA,
            Role = UserRole.Child,
            JoinedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var created = await CreateService(db).CreateAsync(FamilyA, UserA, SampleRequest(), default);
        var service = CreateService(db);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var result = await service.ApplyAsync(
            created.TemplateId,
            FamilyA,
            UserA,
            new ApplyTemplateRequest
            {
                ChildId = ChildA,
                StartDate = today,
                TimeSlots = new List<TemplateTimeSlotDto>
                {
                    new() { DayOfWeek = DayOfWeek.Sunday, StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(8, 0) }
                },
                Location = "新地点"
            },
            default);

        Assert.Single(result.Schedules[0].TimeSlots);
        Assert.Equal(DayOfWeek.Sunday, result.Schedules[0].TimeSlots[0].DayOfWeek);
        Assert.Equal("新地点", result.Schedules[0].Location);
    }

    // ---------- usageCount ----------

    [Fact]
    public async Task GetByIdAsync_UsageCount_CountsNonDeletedSchedules()
    {
        var db = CreateDbContext();
        var service = CreateService(db);
        var created = await service.CreateAsync(FamilyA, UserA, SampleRequest(), default);

        // Add 2 schedules pointing to this template, 1 deleted
        db.Schedules.Add(new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = "S1",
            ScheduleType = ScheduleType.DailyRoutine,
            FamilyId = FamilyA,
            AssignedChildId = ChildA,
            CreatedBy = UserA,
            GroupKey = Guid.NewGuid(),
            SourceTemplateId = created.TemplateId,
            RowVersion = Guid.NewGuid().ToByteArray(),
            IsDeleted = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.Schedules.Add(new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = "S2",
            ScheduleType = ScheduleType.DailyRoutine,
            FamilyId = FamilyA,
            AssignedChildId = ChildA,
            CreatedBy = UserA,
            GroupKey = Guid.NewGuid(),
            SourceTemplateId = created.TemplateId,
            RowVersion = Guid.NewGuid().ToByteArray(),
            IsDeleted = true, // soft-deleted, should not count
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await service.GetByIdAsync(created.TemplateId, FamilyA, default);

        Assert.Equal(1, result!.UsageCount);
    }
}
