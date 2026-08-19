using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Template.Controllers;
using Agenda.Api.Template.Dtos;
using Agenda.Api.Template.Services;
using Agenda.Api.Template.Validators;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Agenda.Api.Template.Tests;

/// <summary>
/// TemplateController 单元测试：覆盖 6 个端点 + 403/404 路径。
/// 验证 controller 编排逻辑、DTO 映射、错误码转换、role 校验。
/// </summary>
public class TemplateControllerTests
{
    private static readonly Guid FamilyId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    private static TemplateController CreateController(
        Mock<ITemplateService>? templateService = null,
        Mock<IFamilyContextService>? familyContext = null,
        UserRole role = UserRole.Parent)
    {
        templateService ??= new Mock<ITemplateService>();
        familyContext ??= new Mock<IFamilyContextService>();
        familyContext.Setup(x => x.GetFamilyContextAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((FamilyId, role));

        var controller = new TemplateController(
            templateService.Object,
            familyContext.Object,
            new CreateTemplateRequestValidator(),
            new UpdateTemplateRequestValidator(),
            new ApplyTemplateRequestValidator());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = BuildClaimsPrincipal(UserId) }
        };
        return controller;
    }

    private static System.Security.Claims.ClaimsPrincipal BuildClaimsPrincipal(Guid userId)
    {
        var identity = new System.Security.Claims.ClaimsIdentity(
            new[] { new System.Security.Claims.Claim("userId", userId.ToString()) },
            "TestAuth");
        return new System.Security.Claims.ClaimsPrincipal(identity);
    }

    // ---------- Role check ----------

    [Fact]
    public async Task List_WhenChildRole_Returns403()
    {
        var controller = CreateController(role: UserRole.Child);

        var result = await controller.List(null, null, null, 1, 20, default);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
    }

    [Fact]
    public async Task GetById_WhenChildRole_Returns403()
    {
        var controller = CreateController(role: UserRole.Child);

        var result = await controller.GetById(Guid.NewGuid(), default);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
    }

    [Fact]
    public async Task Create_WhenChildRole_Returns403()
    {
        var controller = CreateController(role: UserRole.Child);

        var result = await controller.Create(new CreateTemplateRequest
        {
            Name = "x",
            ScheduleType = "DailyRoutine",
            TimeSlots = new List<TemplateTimeSlotDto>
            {
                new() { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(10, 0) }
            }
        }, default);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
    }

    // ---------- List ----------

    [Fact]
    public async Task List_AsParent_ReturnsOkWithServiceResult()
    {
        var templateService = new Mock<ITemplateService>();
        templateService.Setup(x => x.ListAsync(FamilyId, "kw", null, null, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ListTemplatesResponse
            {
                Items = new List<TemplateSummary>(),
                TotalCount = 0,
                Page = 1,
                PageSize = 20
            });
        var controller = CreateController(templateService);

        var result = await controller.List("kw", null, null, 1, 20, default);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.IsType<ListTemplatesResponse>(ok.Value);
    }

    [Fact]
    public async Task List_ClampsPageSizeTo100()
    {
        var templateService = new Mock<ITemplateService>();
        templateService.Setup(x => x.ListAsync(FamilyId, null, null, null, 1, 100, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ListTemplatesResponse
            {
                Items = new List<TemplateSummary>(),
                TotalCount = 0,
                Page = 1,
                PageSize = 100
            });
        var controller = CreateController(templateService);

        var result = await controller.List(null, null, null, 1, 999, default);

        templateService.Verify(x => x.ListAsync(FamilyId, null, null, null, 1, 100, It.IsAny<CancellationToken>()), Times.Once);
        Assert.IsType<OkObjectResult>(result);
    }

    // ---------- GetById ----------

    [Fact]
    public async Task GetById_WhenServiceReturnsNull_Returns404()
    {
        var templateService = new Mock<ITemplateService>();
        templateService.Setup(x => x.GetByIdAsync(It.IsAny<Guid>(), FamilyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((TemplateDetail?)null);
        var controller = CreateController(templateService);

        var result = await controller.GetById(Guid.NewGuid(), default);

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(ErrorCodes.TemplateNotFound, (notFound.Value as dynamic)!.error);
    }

    [Fact]
    public async Task GetById_WhenServiceReturnsTemplate_ReturnsOk()
    {
        var templateService = new Mock<ITemplateService>();
        templateService.Setup(x => x.GetByIdAsync(It.IsAny<Guid>(), FamilyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TemplateDetail
            {
                TemplateId = Guid.NewGuid(),
                Name = "T",
                ScheduleType = "DailyRoutine",
                IsPreset = false,
                CreatedBy = UserId,
                CreatedAt = DateTimeOffset.UtcNow,
                UsageCount = 3
            });
        var controller = CreateController(templateService);

        var result = await controller.GetById(Guid.NewGuid(), default);

        var ok = Assert.IsType<OkObjectResult>(result);
        var detail = Assert.IsType<TemplateDetail>(ok.Value);
        Assert.Equal(3, detail.UsageCount);
    }

    // ---------- Create ----------

    [Fact]
    public async Task Create_ValidRequest_Returns201WithDetail()
    {
        var templateService = new Mock<ITemplateService>();
        var newId = Guid.NewGuid();
        templateService.Setup(x => x.CreateAsync(FamilyId, UserId, It.IsAny<CreateTemplateRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TemplateDetail
            {
                TemplateId = newId,
                Name = "Test",
                ScheduleType = "DailyRoutine",
                IsPreset = false,
                CreatedBy = UserId,
                CreatedAt = DateTimeOffset.UtcNow,
                UsageCount = 0
            });
        var controller = CreateController(templateService);

        var result = await controller.Create(new CreateTemplateRequest
        {
            Name = "Test",
            ScheduleType = "DailyRoutine",
            TimeSlots = new List<TemplateTimeSlotDto>
            {
                new() { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(10, 0) }
            }
        }, default);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Equal(newId, ((TemplateDetail)created.Value!).TemplateId);
    }

    [Fact]
    public async Task Create_InvalidRequest_ThrowsValidationException()
    {
        var templateService = new Mock<ITemplateService>();
        var controller = CreateController(templateService);

        // Empty name -> validation error
        await Assert.ThrowsAsync<ValidationException>(() =>
            controller.Create(new CreateTemplateRequest
            {
                Name = "",
                ScheduleType = "DailyRoutine",
                TimeSlots = new List<TemplateTimeSlotDto>
                {
                    new() { DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(10, 0) }
                }
            }, default));
    }

    // ---------- Apply ----------

    [Fact]
    public async Task Apply_AsParent_ReturnsOkWithCreateScheduleResponse()
    {
        var templateService = new Mock<ITemplateService>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var groupKey = Guid.NewGuid();
        templateService.Setup(x => x.ApplyAsync(It.IsAny<Guid>(), FamilyId, UserId,
                It.IsAny<ApplyTemplateRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CreateScheduleResponse
            {
                GroupKey = groupKey,
                Schedules = new List<ScheduleSummary>
                {
                    new()
                    {
                        ScheduleId = Guid.NewGuid(),
                        AssignedChildId = Guid.NewGuid(),
                        Name = "Created",
                        ScheduleType = "DailyRoutine",
                        CreatedAt = DateTimeOffset.UtcNow
                    }
                }
            });
        var controller = CreateController(templateService);

        var result = await controller.Apply(Guid.NewGuid(), new ApplyTemplateRequest
        {
            ChildId = Guid.NewGuid(),
            StartDate = today
        }, default);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<CreateScheduleResponse>(ok.Value);
        Assert.Equal(groupKey, resp.GroupKey);
    }

    [Fact]
    public async Task Apply_StartDateInPast_ThrowsValidationException()
    {
        var controller = CreateController();

        var past = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);
        await Assert.ThrowsAsync<ValidationException>(() =>
            controller.Apply(Guid.NewGuid(), new ApplyTemplateRequest
            {
                ChildId = Guid.NewGuid(),
                StartDate = past
            }, default));
    }
}
