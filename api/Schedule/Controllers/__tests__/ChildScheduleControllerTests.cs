using System.Security.Claims;
using Agenda.Api.Checkin.Services;
using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Domain.Interfaces;
using Agenda.Api.Schedule.Controllers;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Agenda.Api.Schedule.Controllers.Tests;

/// <summary>
/// ChildScheduleController 测试。覆盖：
/// - 5 个端点：today/week/month/{id}/stats/weekly-completion
/// - 角色校验：非 Child 返回 403（Parent 角色覆盖全部 5 个端点,非家庭成员返回 403）
/// - 成功路径：返回 service 结果
/// - 正常路径（happy path）：所有 5 个端点
/// - 越权（cross-access）：Parent 角色 5 端点 + GetById 跨日程 403
/// - 空（empty）：today/week/month 端点 service 返回空时 controller 透传
/// - 完成率边界：total=0 时 controller 返回结构化零值响应
/// - GetById：访问他人 schedule 抛 CHILD_ACCESS_DENIED → 403；不存在 → 404
/// </summary>
public class ChildScheduleControllerTests
{
    private static readonly Guid TestUserId = Guid.NewGuid();
    private static readonly Guid TestFamilyId = Guid.NewGuid();
    private static readonly Guid TestScheduleId = Guid.NewGuid();

    private static Mock<IChildScheduleQueryService> CreateChildScheduleMock()
    {
        var mock = new Mock<IChildScheduleQueryService>();
        mock.Setup(s => s.GetDailyListAsync(TestUserId, TestFamilyId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChildScheduleListResponse
            {
                Items = new List<ScheduleInfo>
                {
                    new() { ScheduleId = TestScheduleId, Name = "今日课", ScheduleType = ScheduleType.AfterSchoolActivity, FamilyId = TestFamilyId, AssignedChildId = TestUserId }
                },
                CompletedCount = 0,
                TotalCount = 1,
                CompletionPercentage = 0.0
            });
        mock.Setup(s => s.GetWeeklyListAsync(TestUserId, TestFamilyId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChildScheduleListResponse { TotalCount = 5, CompletedCount = 2, CompletionPercentage = 40.0 });
        mock.Setup(s => s.GetMonthlyListAsync(TestUserId, TestFamilyId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChildScheduleListResponse { TotalCount = 20, CompletedCount = 15, CompletionPercentage = 75.0 });
        mock.Setup(s => s.GetByIdAsync(TestScheduleId, TestUserId, TestFamilyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ScheduleInfo { ScheduleId = TestScheduleId, Name = "我的课", ScheduleType = ScheduleType.AfterSchoolActivity, FamilyId = TestFamilyId, AssignedChildId = TestUserId });
        return mock;
    }

    private static Mock<ICompletionStatsService> CreateStatsMock()
    {
        var mock = new Mock<ICompletionStatsService>();
        mock.Setup(s => s.GetChildWeeklyCompletionRateAsync(TestUserId, TestFamilyId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((60.0, 3, 5));
        return mock;
    }

    private static Mock<IFamilyContextService> CreateFamilyContextMock(UserRole role = UserRole.Child)
    {
        var mock = new Mock<IFamilyContextService>();
        mock.Setup(s => s.GetFamilyContextAsync(TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((TestFamilyId, role));
        return mock;
    }

    private static ChildScheduleController CreateController(
        Mock<IChildScheduleQueryService>? childSvc = null,
        Mock<ICompletionStatsService>? statsSvc = null,
        Mock<IFamilyContextService>? familyCtx = null,
        UserRole role = UserRole.Child)
    {
        var controller = new ChildScheduleController(
            (childSvc ?? CreateChildScheduleMock()).Object,
            (statsSvc ?? CreateStatsMock()).Object,
            (familyCtx ?? CreateFamilyContextMock(role)).Object);

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
    public async Task GetToday_AsChild_ReturnsOkWithList()
    {
        var controller = CreateController();

        var result = await controller.GetToday(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<ChildScheduleListResponse>(ok.Value);
        Assert.Single(resp.Items);
        Assert.Equal(1, resp.TotalCount);
    }

    [Fact]
    public async Task GetToday_AsParent_Returns403()
    {
        var controller = CreateController(role: UserRole.Parent);

        var result = await controller.GetToday(CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
    }

    [Fact]
    public async Task GetToday_NotFamilyMember_Returns403()
    {
        var familyCtx = new Mock<IFamilyContextService>();
        familyCtx.Setup(s => s.GetFamilyContextAsync(TestUserId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new UnauthorizedAccessException("NOT_FAMILY_MEMBER"));
        var controller = CreateController(familyCtx: familyCtx);

        var result = await controller.GetToday(CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
    }

    [Fact]
    public async Task GetWeek_AsChild_ReturnsOk()
    {
        var controller = CreateController();

        var result = await controller.GetWeek(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<ChildScheduleListResponse>(ok.Value);
        Assert.Equal(5, resp.TotalCount);
        Assert.Equal(2, resp.CompletedCount);
    }

    [Fact]
    public async Task GetMonth_AsChild_ReturnsOk()
    {
        var controller = CreateController();

        var result = await controller.GetMonth(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<ChildScheduleListResponse>(ok.Value);
        Assert.Equal(20, resp.TotalCount);
    }

    [Fact]
    public async Task GetById_OwnSchedule_ReturnsOkWithScheduleInfo()
    {
        var controller = CreateController();

        var result = await controller.GetById(TestScheduleId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var info = Assert.IsType<ScheduleInfo>(ok.Value);
        Assert.Equal(TestScheduleId, info.ScheduleId);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        var childSvc = CreateChildScheduleMock();
        childSvc.Setup(s => s.GetByIdAsync(It.IsAny<Guid>(), TestUserId, TestFamilyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ScheduleInfo?)null);
        var controller = CreateController(childSvc: childSvc);

        var result = await controller.GetById(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task GetById_OthersSchedule_Returns403()
    {
        var childSvc = CreateChildScheduleMock();
        childSvc.Setup(s => s.GetByIdAsync(It.IsAny<Guid>(), TestUserId, TestFamilyId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new UnauthorizedAccessException("CHILD_ACCESS_DENIED"));
        var controller = CreateController(childSvc: childSvc);

        var result = await controller.GetById(Guid.NewGuid(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
        // 跨孩子访问 schedule 走 service 异常分支,锁定 CHILD_ACCESS_DENIED 错误码
        Assert.Equal("CHILD_ACCESS_DENIED", GetBodyProperty(status.Value, "error"));
    }

    // ---------- 错误码锁定: 角色非 Child 时返回 CHILD_ONLY_ENDPOINT（与跨孩子访问 CHILD_ACCESS_DENIED 区分）----------

    [Fact]
    public async Task GetToday_AsParent_Returns403WithChildOnlyEndpoint()
    {
        var controller = CreateController(role: UserRole.Parent);

        var result = await controller.GetToday(CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
        Assert.Equal("CHILD_ONLY_ENDPOINT", GetBodyProperty(status.Value, "error"));
        Assert.Equal("仅孩子角色可访问", GetBodyProperty(status.Value, "message"));
    }

    [Fact]
    public async Task GetWeek_AsParent_Returns403WithChildOnlyEndpoint()
    {
        var controller = CreateController(role: UserRole.Parent);

        var result = await controller.GetWeek(CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
        Assert.Equal("CHILD_ONLY_ENDPOINT", GetBodyProperty(status.Value, "error"));
    }

    /// <summary>从匿名错误体读取字段值（ObjectResult.Value 是 new { error, message }）。</summary>
    private static object? GetBodyProperty(object? body, string propertyName)
    {
        Assert.NotNull(body);
        return body!.GetType().GetProperty(propertyName)?.GetValue(body);
    }

    [Fact]
    public async Task GetWeeklyCompletion_AsChild_ReturnsOk()
    {
        var controller = CreateController();

        var result = await controller.GetWeeklyCompletion(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<ChildWeeklyCompletionResponse>(ok.Value);
        Assert.Equal(60.0, resp.Percentage);
        Assert.Equal(3, resp.Completed);
        Assert.Equal(5, resp.Total);
    }

    [Fact]
    public async Task GetWeeklyCompletion_AsParent_Returns403()
    {
        var controller = CreateController(role: UserRole.Parent);

        var result = await controller.GetWeeklyCompletion(CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
    }

    // ---------- 空列表（service 返回空时 controller 正确透传）----------

    [Fact]
    public async Task GetToday_AsChild_NoSchedules_ReturnsOkWithEmptyList()
    {
        var childSvc = new Mock<IChildScheduleQueryService>();
        childSvc.Setup(s => s.GetDailyListAsync(TestUserId, TestFamilyId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChildScheduleListResponse
            {
                Items = new List<ScheduleInfo>(),
                CompletedCount = 0,
                TotalCount = 0,
                CompletionPercentage = 0.0
            });
        var controller = CreateController(childSvc: childSvc);

        var result = await controller.GetToday(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<ChildScheduleListResponse>(ok.Value);
        Assert.Empty(resp.Items);
        Assert.Equal(0, resp.TotalCount);
        Assert.Equal(0, resp.CompletedCount);
        Assert.Equal(0.0, resp.CompletionPercentage);
    }

    [Fact]
    public async Task GetWeek_AsChild_NoSchedules_ReturnsOkWithEmptyList()
    {
        var childSvc = new Mock<IChildScheduleQueryService>();
        childSvc.Setup(s => s.GetWeeklyListAsync(TestUserId, TestFamilyId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChildScheduleListResponse
            {
                Items = new List<ScheduleInfo>(),
                CompletedCount = 0,
                TotalCount = 0,
                CompletionPercentage = 0.0
            });
        var controller = CreateController(childSvc: childSvc);

        var result = await controller.GetWeek(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<ChildScheduleListResponse>(ok.Value);
        Assert.Empty(resp.Items);
        Assert.Equal(0, resp.TotalCount);
    }

    [Fact]
    public async Task GetMonth_AsChild_NoSchedules_ReturnsOkWithEmptyList()
    {
        var childSvc = new Mock<IChildScheduleQueryService>();
        childSvc.Setup(s => s.GetMonthlyListAsync(TestUserId, TestFamilyId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChildScheduleListResponse
            {
                Items = new List<ScheduleInfo>(),
                CompletedCount = 0,
                TotalCount = 0,
                CompletionPercentage = 0.0
            });
        var controller = CreateController(childSvc: childSvc);

        var result = await controller.GetMonth(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<ChildScheduleListResponse>(ok.Value);
        Assert.Empty(resp.Items);
        Assert.Equal(0, resp.TotalCount);
    }

    // ---------- 越权：周/月/详情端点的 Parent 角色 403 ----------

    [Fact]
    public async Task GetWeek_AsParent_Returns403()
    {
        var controller = CreateController(role: UserRole.Parent);

        var result = await controller.GetWeek(CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
    }

    [Fact]
    public async Task GetMonth_AsParent_Returns403()
    {
        var controller = CreateController(role: UserRole.Parent);

        var result = await controller.GetMonth(CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
    }

    [Fact]
    public async Task GetById_AsParent_Returns403()
    {
        var controller = CreateController(role: UserRole.Parent);

        var result = await controller.GetById(TestScheduleId, CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
    }

    // ---------- 完成率边界：total = 0 时 controller 仍返回结构化响应 ----------

    [Fact]
    public async Task GetWeeklyCompletion_AsChild_NoSchedules_ReturnsZeroStats()
    {
        var statsSvc = new Mock<ICompletionStatsService>();
        statsSvc.Setup(s => s.GetChildWeeklyCompletionRateAsync(TestUserId, TestFamilyId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((0.0, 0, 0));
        var controller = CreateController(statsSvc: statsSvc);

        var result = await controller.GetWeeklyCompletion(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var resp = Assert.IsType<ChildWeeklyCompletionResponse>(ok.Value);
        Assert.Equal(0.0, resp.Percentage);
        Assert.Equal(0, resp.Completed);
        Assert.Equal(0, resp.Total);
    }
}
