using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Template.Dtos;
using Agenda.Api.Template.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Agenda.Test.Template;

/// <summary>
/// 模板兼容层测试（Task 5.3）：旧字段 childId 单选归一化为 memberIds 单元素。
/// </summary>
public class TemplateCompatTests
{
    private static int _dbCounter;
    private static readonly Guid FamilyA = Guid.NewGuid();
    private static readonly Guid UserA = Guid.NewGuid();
    private static readonly Guid ChildA = Guid.NewGuid();

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"TemplateCompatTest_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task ApplyAsync_ChildId_NormalizesToSingleElementMemberIds()
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

        var template = new DomainTemplate
        {
            Id = Guid.NewGuid(),
            Name = "模板",
            ScheduleType = ScheduleType.DailyRoutine,
            IsPreset = false,
            FamilyId = FamilyA,
            CreatedBy = UserA,
            IsDeleted = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        template.TimeSlots.Add(new DomainTemplateTimeSlot
        {
            DayOfWeek = DayOfWeek.Monday,
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(10, 0)
        });
        db.Templates.Add(template);
        await db.SaveChangesAsync();

        CreateScheduleRequest? captured = null;
        var scheduleService = new Mock<IScheduleService>();
        scheduleService
            .Setup(s => s.CreateAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<UserRole>(),
                It.IsAny<CreateScheduleRequest>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, Guid, UserRole, CreateScheduleRequest, CancellationToken>((_, _, _, req, _) => captured = req)
            .ReturnsAsync(new CreateScheduleResponse { GroupKey = Guid.NewGuid(), Schedules = new() });

        var service = new TemplateService(db, scheduleService.Object, new Mock<ILogger<TemplateService>>().Object);

        await service.ApplyAsync(template.Id, FamilyA, UserA,
            new ApplyTemplateRequest { ChildId = ChildA, StartDate = DateOnly.FromDateTime(DateTime.UtcNow) },
            default);

        Assert.NotNull(captured);
        Assert.Single(captured!.MemberIds);
        Assert.Equal(ChildA, captured.MemberIds[0]);
    }
}
