using Agenda.Api.Infrastructure;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Shared.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Agenda.Api.Schedule.Controllers;

[ApiController]
[Route("api/v1/calendar")]
[Authorize]
public class CalendarController : ControllerBase
{
    private readonly ICalendarQueryService _calendarService;
    private readonly IFamilyContextService _familyContext;

    public CalendarController(ICalendarQueryService calendarService, IFamilyContextService familyContext)
    {
        _calendarService = calendarService;
        _familyContext = familyContext;
    }

    /// <summary>日历视图查询（月/周/日三视图数据聚合）</summary>
    [HttpGet]
    public async Task<IActionResult> Query(
        [FromQuery] string view = "month",
        [FromQuery] DateOnly? startDate = null,
        [FromQuery] DateOnly? endDate = null,
        [FromQuery] Guid? memberId = null,
        [FromQuery] Guid? childId = null,
        [FromQuery] string? scheduleTypes = null,
        CancellationToken ct = default)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        var reqStartDate = startDate ?? DateOnly.FromDateTime(DateTime.Today);
        var reqEndDate = endDate ?? reqStartDate.AddMonths(1);

        // 归一化：两者都传以 memberId 为准，仅传 childId 兜底
        var effectiveMemberId = memberId ?? childId;

        // 孩子端只能看到自己的数据（先归一化、后角色强制，覆盖客户端传入值）
        if (role == Domain.Enums.UserRole.Child)
            effectiveMemberId = User.GetUserId();

        var request = new CalendarQueryRequest
        {
            View = view,
            StartDate = reqStartDate,
            EndDate = reqEndDate,
            MemberId = effectiveMemberId,
            ScheduleTypes = scheduleTypes?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
        };

        try
        {
            var result = await _calendarService.QueryAsync(request, familyId, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex) when (ex.Message == ErrorCodes.DateRangeTooLarge)
        {
            return BadRequest(ErrorResponse.From(ErrorCodes.DateRangeTooLarge));
        }
    }
}
