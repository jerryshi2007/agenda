using System.Security.Claims;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Agenda.Api.Schedule.Controllers.Tests;

/// <summary>
/// ScheduleController 测试（Task 5.1）。覆盖：
/// - Create 孩子仅自己：孩子给自己创建 → 201；孩子给他人创建 → 403 CHILD_SELF_ASSIGN_ONLY
/// - Update/Delete 孩子越权：Service 抛 UnauthorizedAccessException(CHILD_ACCESS_DENIED) → 403
/// </summary>
public class ScheduleControllerTests
{
    private static readonly Guid TestUserId = Guid.NewGuid();
    private static readonly Guid TestFamilyId = Guid.NewGuid();
    private static readonly Guid TestScheduleId = Guid.NewGuid();

    private static ScheduleController CreateController(UserRole role, Mock<IScheduleService>? scheduleSvc = null)
    {
        var scheduleMock = scheduleSvc ?? new Mock<IScheduleService>();
        var familyCtx = new Mock<IFamilyContextService>();
        familyCtx.Setup(s => s.GetFamilyContextAsync(TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((TestFamilyId, role));
        var conflict = new Mock<IConflictDetectionService>();

        var controller = new ScheduleController(scheduleMock.Object, conflict.Object, familyCtx.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.NameIdentifier, TestUserId.ToString()) },
                    "TestAuth"))
            }
        };
        return controller;
    }

    [Fact]
    public async Task Create_AsChild_AssignsOtherMember_Returns403ChildSelfAssignOnly()
    {
        var controller = CreateController(UserRole.Child);

        var result = await controller.Create(new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            MemberIds = [Guid.NewGuid()], // 非自己
            IgnoreConflict = true
        }, CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
        Assert.Equal(ErrorCodes.ChildSelfAssignOnly, GetBodyProperty(status.Value, "error"));
    }

    [Fact]
    public async Task Create_AsChild_AssignsSelf_ReturnsCreated()
    {
        var scheduleSvc = new Mock<IScheduleService>();
        scheduleSvc
            .Setup(s => s.CreateAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<UserRole>(),
                It.IsAny<CreateScheduleRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CreateScheduleResponse
            {
                GroupKey = Guid.NewGuid(),
                Schedules = new List<ScheduleSummary>
                {
                    new() { ScheduleId = TestScheduleId, Name = "钢琴课", ScheduleType = "AfterSchoolActivity", AssignedMemberId = TestUserId }
                }
            });
        var controller = CreateController(UserRole.Child, scheduleSvc);

        var result = await controller.Create(new CreateScheduleRequest
        {
            Name = "钢琴课",
            ScheduleType = "AfterSchoolActivity",
            MemberIds = [TestUserId], // 自己
            IgnoreConflict = true
        }, CancellationToken.None);

        Assert.IsType<CreatedAtActionResult>(result);
    }

    [Fact]
    public async Task Update_AsChild_ServiceThrowsChildAccessDenied_Returns403()
    {
        var scheduleSvc = new Mock<IScheduleService>();
        scheduleSvc
            .Setup(s => s.UpdateAsync(It.IsAny<Guid>(), It.IsAny<UpdateScheduleRequest>(),
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<UserRole>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new UnauthorizedAccessException(ErrorCodes.ChildAccessDenied));
        var controller = CreateController(UserRole.Child, scheduleSvc);

        var result = await controller.Update(TestScheduleId, new UpdateScheduleRequest { Scope = "ThisOnly" }, CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
        Assert.Equal(ErrorCodes.ChildAccessDenied, GetBodyProperty(status.Value, "error"));
    }

    [Fact]
    public async Task Delete_AsChild_ServiceThrowsChildAccessDenied_Returns403()
    {
        var scheduleSvc = new Mock<IScheduleService>();
        scheduleSvc
            .Setup(s => s.DeleteAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<DateOnly?>(),
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<UserRole>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new UnauthorizedAccessException(ErrorCodes.ChildAccessDenied));
        var controller = CreateController(UserRole.Child, scheduleSvc);

        var result = await controller.Delete(TestScheduleId, "ThisOnly", null, false, CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
        Assert.Equal(ErrorCodes.ChildAccessDenied, GetBodyProperty(status.Value, "error"));
    }

    /// <summary>从匿名错误体读取字段值（ObjectResult.Value 是 new { error, message }）。</summary>
    private static object? GetBodyProperty(object? body, string propertyName)
    {
        Assert.NotNull(body);
        return body!.GetType().GetProperty(propertyName)?.GetValue(body);
    }
}
