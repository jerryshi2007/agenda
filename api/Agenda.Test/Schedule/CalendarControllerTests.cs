using System.Security.Claims;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Schedule.Controllers;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Agenda.Test.Schedule;

/// <summary>
/// CalendarController 兼容层测试（Task 5.3）：锁定「先归一化、后角色强制」的安全边界。
/// - 孩子角色携带 memberId/childId=其他成员 → 强制为自身 UserId
/// - 家长角色两者都传 → memberId 优先；仅 childId → 兜底
/// </summary>
public class CalendarControllerTests
{
    private static readonly Guid TestUserId = Guid.NewGuid();
    private static readonly Guid TestFamilyId = Guid.NewGuid();
    private static readonly Guid OtherMemberId = Guid.NewGuid();

    private static CalendarController CreateController(UserRole role, Mock<ICalendarQueryService> calendar)
    {
        var familyCtx = new Mock<IFamilyContextService>();
        familyCtx.Setup(s => s.GetFamilyContextAsync(TestUserId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((TestFamilyId, role));

        var controller = new CalendarController(calendar.Object, familyCtx.Object);
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
    public async Task Query_AsChild_WithOtherMemberId_ForcesSelf()
    {
        CalendarQueryRequest? captured = null;
        var calendar = new Mock<ICalendarQueryService>();
        calendar
            .Setup(s => s.QueryAsync(It.IsAny<CalendarQueryRequest>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Callback<CalendarQueryRequest, Guid, CancellationToken>((req, _, _) => captured = req)
            .ReturnsAsync(new CalendarResponse());
        var controller = CreateController(UserRole.Child, calendar);

        await controller.Query(memberId: OtherMemberId, ct: CancellationToken.None);

        Assert.NotNull(captured);
        Assert.Equal(TestUserId, captured!.MemberId); // 覆盖客户端传入值
    }

    [Fact]
    public async Task Query_AsChild_WithOtherChildId_ForcesSelf()
    {
        CalendarQueryRequest? captured = null;
        var calendar = new Mock<ICalendarQueryService>();
        calendar
            .Setup(s => s.QueryAsync(It.IsAny<CalendarQueryRequest>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Callback<CalendarQueryRequest, Guid, CancellationToken>((req, _, _) => captured = req)
            .ReturnsAsync(new CalendarResponse());
        var controller = CreateController(UserRole.Child, calendar);

        await controller.Query(childId: OtherMemberId, ct: CancellationToken.None);

        Assert.NotNull(captured);
        Assert.Equal(TestUserId, captured!.MemberId);
    }

    [Fact]
    public async Task Query_AsParent_BothFields_MemberIdWins()
    {
        CalendarQueryRequest? captured = null;
        var calendar = new Mock<ICalendarQueryService>();
        calendar
            .Setup(s => s.QueryAsync(It.IsAny<CalendarQueryRequest>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Callback<CalendarQueryRequest, Guid, CancellationToken>((req, _, _) => captured = req)
            .ReturnsAsync(new CalendarResponse());
        var controller = CreateController(UserRole.Parent, calendar);

        await controller.Query(memberId: OtherMemberId, childId: Guid.NewGuid(), ct: CancellationToken.None);

        Assert.NotNull(captured);
        Assert.Equal(OtherMemberId, captured!.MemberId);
    }

    [Fact]
    public async Task Query_AsParent_OnlyChildId_FallsBack()
    {
        CalendarQueryRequest? captured = null;
        var calendar = new Mock<ICalendarQueryService>();
        calendar
            .Setup(s => s.QueryAsync(It.IsAny<CalendarQueryRequest>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Callback<CalendarQueryRequest, Guid, CancellationToken>((req, _, _) => captured = req)
            .ReturnsAsync(new CalendarResponse());
        var controller = CreateController(UserRole.Parent, calendar);

        await controller.Query(childId: OtherMemberId, ct: CancellationToken.None);

        Assert.NotNull(captured);
        Assert.Equal(OtherMemberId, captured!.MemberId);
    }
}
