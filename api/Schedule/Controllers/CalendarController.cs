using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Shared.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace Agenda.Api.Schedule.Controllers;

[ApiController]
[Route("api/v1/calendar")]
public class CalendarController : ControllerBase
{
    private readonly ICalendarQueryService _calendarService;
    private readonly AppDbContext _db;

    public CalendarController(ICalendarQueryService calendarService, AppDbContext db)
    {
        _calendarService = calendarService;
        _db = db;
    }

    /// <summary>日历视图查询（月/周/日三视图数据聚合）</summary>
    [HttpGet]
    public async Task<IActionResult> Query(
        [FromQuery] string view = "month",
        [FromQuery] DateOnly? startDate = null,
        [FromQuery] DateOnly? endDate = null,
        [FromQuery] Guid? childId = null,
        [FromQuery] string? eventTypes = null,
        CancellationToken ct = default)
    {
        var (familyId, role) = await User.GetFamilyContextAsync(_db, ct);

        var reqStartDate = startDate ?? DateOnly.FromDateTime(DateTime.Today);
        var reqEndDate = endDate ?? reqStartDate.AddMonths(1);

        var request = new CalendarQueryRequest
        {
            View = view,
            StartDate = reqStartDate,
            EndDate = reqEndDate,
            ChildId = childId,
            ScheduleTypes = eventTypes?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
        };

        // 孩子端只能看到自己的数据
        Guid? childUserId = role == Domain.Enums.UserRole.Child ? User.GetUserId() : null;
        if (childUserId.HasValue)
            request.ChildId = childUserId.Value;

        try
        {
            var result = await _calendarService.QueryAsync(request, familyId, childUserId, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex) when (ex.Message == "DATE_RANGE_TOO_LARGE")
        {
            return BadRequest(new { error = "DATE_RANGE_TOO_LARGE" });
        }
    }
}
