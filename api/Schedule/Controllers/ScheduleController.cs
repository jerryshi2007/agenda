using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Shared.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace Agenda.Api.Schedule.Controllers;

[ApiController]
[Route("api/v1/schedules")]
public class ScheduleController : ControllerBase
{
    private readonly IScheduleService _eventService;
    private readonly IConflictDetectionService _conflictService;
    private readonly AppDbContext _db;

    public ScheduleController(IScheduleService eventService, IConflictDetectionService conflictService, AppDbContext db)
    {
        _eventService = eventService;
        _conflictService = conflictService;
        _db = db;
    }

    /// <summary>创建日程（含多孩子展开）</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateScheduleRequest request, CancellationToken ct)
    {
        var (familyId, role) = await User.GetFamilyContextAsync(_db, ct);

        if (role != Domain.Enums.UserRole.Parent)
            return ForbidJwt("CHILD_ACCESS_DENIED", "孩子不能创建日程");

        try
        {
            // Optional conflict check (if not ignoring)
            if (!request.IgnoreConflict && request.ChildIds.Count == 1 && request.TimeSlots.Count > 0)
            {
                foreach (var ts in request.TimeSlots)
                {
                    var conflictResult = await _conflictService.CheckConflictAsync(new ScheduleConflictCheckRequest
                    {
                        ChildId = request.ChildIds[0],
                        Date = DateOnly.FromDateTime(DateTime.Today),
                        StartTime = ts.StartTime,
                        EndTime = ts.EndTime
                    }, ct);

                    if (conflictResult.HasConflict)
                        return Conflict(conflictResult);
                }
            }

            var result = await _eventService.CreateAsync(familyId, User.GetUserId(), request, ct);
            return CreatedAtAction(nameof(GetById), new { scheduleId = result.Schedules.First().ScheduleId }, result);
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>获取日程详情</summary>
    [HttpGet("{scheduleId:guid}")]
    public async Task<IActionResult> GetById(Guid scheduleId, [FromQuery] DateOnly? date, CancellationToken ct)
    {
        var (familyId, role) = await User.GetFamilyContextAsync(_db, ct);

        try
        {
            var result = await _eventService.GetByIdAsync(scheduleId, date, User.GetUserId(), familyId, role, ct);
            if (result == null)
                return NotFound(new { error = "SCHEDULE_NOT_FOUND" });

            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ForbidJwt("CHILD_ACCESS_DENIED", ex.Message);
        }
    }

    /// <summary>编辑日程（含 EditScope 逻辑）</summary>
    [HttpPut("{scheduleId:guid}")]
    public async Task<IActionResult> Update(Guid scheduleId, [FromBody] UpdateScheduleRequest request, CancellationToken ct)
    {
        var (familyId, role) = await User.GetFamilyContextAsync(_db, ct);

        if (role != Domain.Enums.UserRole.Parent)
            return ForbidJwt("CHILD_ACCESS_DENIED", "孩子不能编辑日程");

        try
        {
            var result = await _eventService.UpdateAsync(scheduleId, request, User.GetUserId(), familyId, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex) when (ex.Message == "CONCURRENT_EDIT_CONFLICT")
        {
            return Conflict(new { error = ex.Message });
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException ex) when (ex.Message == "SCHEDULE_NOT_FOUND")
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>删除日程（含 scope 参数）</summary>
    [HttpDelete("{scheduleId:guid}")]
    public async Task<IActionResult> Delete(
        Guid scheduleId,
        [FromQuery] string scope = "ThisOnly",
        [FromQuery] DateOnly? date = null,
        CancellationToken ct = default)
    {
        var (familyId, role) = await User.GetFamilyContextAsync(_db, ct);

        if (role != Domain.Enums.UserRole.Parent)
            return ForbidJwt("CHILD_ACCESS_DENIED", "孩子不能删除日程");

        try
        {
            var result = await _eventService.DeleteAsync(scheduleId, scope, date, User.GetUserId(), familyId, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException ex) when (ex.Message == "SCHEDULE_NOT_FOUND")
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>临时取消本次实例</summary>
    [HttpPost("{scheduleId:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid scheduleId, [FromBody] CancelScheduleInstanceRequest request, CancellationToken ct)
    {
        var (familyId, role) = await User.GetFamilyContextAsync(_db, ct);

        if (role != Domain.Enums.UserRole.Parent)
            return ForbidJwt("CHILD_ACCESS_DENIED", "孩子不能取消日程");

        try
        {
            var result = await _eventService.CancelInstanceAsync(scheduleId, request.Date, User.GetUserId(), familyId, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException ex) when (ex.Message == "SCHEDULE_NOT_FOUND")
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>恢复已取消/已删除实例</summary>
    [HttpPost("{scheduleId:guid}/restore")]
    public async Task<IActionResult> Restore(Guid scheduleId, [FromBody] RestoreScheduleInstanceRequest request, CancellationToken ct)
    {
        var (familyId, role) = await User.GetFamilyContextAsync(_db, ct);

        if (role != Domain.Enums.UserRole.Parent)
            return ForbidJwt("CHILD_ACCESS_DENIED", "孩子不能恢复日程");

        try
        {
            var result = await _eventService.RestoreInstanceAsync(scheduleId, request.Date, User.GetUserId(), familyId, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException ex) when (ex.Message == "SCHEDULE_NOT_FOUND")
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>冲突检测（可选调用）</summary>
    [HttpPost("check-conflict")]
    public async Task<IActionResult> CheckConflict([FromBody] ScheduleConflictCheckRequest request, CancellationToken ct)
    {
        await User.GetFamilyContextAsync(_db, ct); // 鉴权
        var result = await _conflictService.CheckConflictAsync(request, ct);
        return Ok(result);
    }

    private static bool IsDomainError(string message) =>
        message switch
        {
            "CHILD_NOT_SELECTED" or "SCHEDULE_NAME_EMPTY" or "SCHEDULE_NAME_TOO_LONG"
                or "TIME_SLOT_INVALID" or "NO_DAY_SELECTED" or "NOTES_TOO_LONG"
                or "DUE_DATE_INVALID" or "REPEAT_END_DATE_INVALID" or "DUE_DATE_REQUIRED"
                or "CHILD_NOT_IN_FAMILY" or "SCHEDULE_ALREADY_CANCELLED" or "HOMEWORK_NO_CANCEL"
                or "NOT_CANCELLED_OR_EXCLUDED" or "INVALID_SCOPE" or "SCHEDULE_TYPE_INVALID"
                or "LOCATION_TOO_LONG" or "SCHEDULE_TYPE_REQUIRED"
                => true,
            _ => false
        };

    private ObjectResult ForbidJwt(string errorCode, string message)
    {
        return StatusCode(403, new { error = errorCode, message });
    }
}
