using Agenda.Api.Infrastructure;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Shared.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Schedule.Controllers;

[ApiController]
[Route("api/v1/schedules")]
[Authorize]
public class ScheduleController : ControllerBase
{
    private readonly IScheduleService _scheduleService;
    private readonly IConflictDetectionService _conflictService;
    private readonly IFamilyContextService _familyContext;

    public ScheduleController(
        IScheduleService scheduleService,
        IConflictDetectionService conflictService,
        IFamilyContextService familyContext)
    {
        _scheduleService = scheduleService;
        _conflictService = conflictService;
        _familyContext = familyContext;
    }

    /// <summary>创建日程（含多成员展开）</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateScheduleRequest request, CancellationToken ct)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        var userId = User.GetUserId();
        var memberIds = request.GetEffectiveMemberIds();

        // 孩子只能给自己创建（防御纵深：Service 层同样校验）
        if (role == Domain.Enums.UserRole.Child &&
            (memberIds.Count != 1 || memberIds[0] != userId))
            return ForbidJwt(ErrorCodes.ChildSelfAssignOnly, ErrorCodes.Message(ErrorCodes.ChildSelfAssignOnly));

        try
        {
            // Optional conflict check (if not ignoring)
            if (!request.IgnoreConflict && memberIds.Count == 1 && request.TimeSlots.Count > 0)
            {
                foreach (var ts in request.TimeSlots)
                {
                    var conflictResult = await _conflictService.CheckConflictAsync(familyId, new ScheduleConflictCheckRequest
                    {
                        MemberId = memberIds[0],
                        // Derive a concrete date from the time slot's weekday so the
                        // conflict service matches the correct DayOfWeek.
                        Date = GetNextDateForDayOfWeek(ts.DayOfWeek),
                        StartTime = ts.StartTime,
                        EndTime = ts.EndTime
                    }, ct);

                    if (conflictResult.HasConflict)
                        return Conflict(conflictResult);
                }
            }

            var result = await _scheduleService.CreateAsync(familyId, userId, role, request, ct);
            return CreatedAtAction(nameof(GetById), new { scheduleId = result.Schedules.First().ScheduleId }, result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ForbidJwt(ex.Message, ErrorCodes.Message(ex.Message));
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(ErrorResponse.From(ex.Message));
        }
    }

    /// <summary>获取日程详情</summary>
    [HttpGet("{scheduleId:guid}")]
    public async Task<IActionResult> GetById(Guid scheduleId, [FromQuery] DateOnly? date, CancellationToken ct)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        try
        {
            var result = await _scheduleService.GetByIdAsync(scheduleId, date, User.GetUserId(), familyId, role, ct);
            if (result == null)
                return NotFound(ErrorResponse.From(ErrorCodes.ScheduleNotFound));

            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ForbidJwt(ex.Message, ErrorCodes.Message(ex.Message));
        }
    }

    /// <summary>编辑日程（含 EditScope 逻辑）</summary>
    [HttpPut("{scheduleId:guid}")]
    public async Task<IActionResult> Update(Guid scheduleId, [FromBody] UpdateScheduleRequest request, CancellationToken ct)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        try
        {
            var result = await _scheduleService.UpdateAsync(scheduleId, request, User.GetUserId(), familyId, role, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ForbidJwt(ex.Message, ErrorCodes.Message(ex.Message));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(ErrorResponse.From(ErrorCodes.ConcurrentEditConflict));
        }
        catch (InvalidOperationException ex) when (ex.Message == ErrorCodes.ConcurrentEditConflict)
        {
            return Conflict(ErrorResponse.From(ErrorCodes.ConcurrentEditConflict));
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(ErrorResponse.From(ex.Message));
        }
        catch (KeyNotFoundException ex) when (ex.Message == ErrorCodes.ScheduleNotFound)
        {
            return NotFound(ErrorResponse.From(ex.Message));
        }
    }

    /// <summary>删除日程（含 scope 参数）</summary>
    [HttpDelete("{scheduleId:guid}")]
    public async Task<IActionResult> Delete(
        Guid scheduleId,
        [FromQuery] string scope = "ThisOnly",
        [FromQuery] DateOnly? date = null,
        [FromQuery] bool force = false,
        CancellationToken ct = default)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        try
        {
            var result = await _scheduleService.DeleteAsync(scheduleId, scope, date, User.GetUserId(), familyId, role, force, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ForbidJwt(ex.Message, ErrorCodes.Message(ex.Message));
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(ErrorResponse.From(ex.Message));
        }
        catch (KeyNotFoundException ex) when (ex.Message == ErrorCodes.ScheduleNotFound)
        {
            return NotFound(ErrorResponse.From(ex.Message));
        }
    }

    /// <summary>临时取消本次实例</summary>
    [HttpPost("{scheduleId:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid scheduleId, [FromBody] CancelScheduleInstanceRequest request, CancellationToken ct)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        try
        {
            var result = await _scheduleService.CancelInstanceAsync(scheduleId, request.Date, User.GetUserId(), familyId, role, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ForbidJwt(ex.Message, ErrorCodes.Message(ex.Message));
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(ErrorResponse.From(ex.Message));
        }
        catch (KeyNotFoundException ex) when (ex.Message == ErrorCodes.ScheduleNotFound)
        {
            return NotFound(ErrorResponse.From(ex.Message));
        }
    }

    /// <summary>恢复已取消/已删除实例</summary>
    [HttpPost("{scheduleId:guid}/restore")]
    public async Task<IActionResult> Restore(Guid scheduleId, [FromBody] RestoreScheduleInstanceRequest request, CancellationToken ct)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        try
        {
            var result = await _scheduleService.RestoreInstanceAsync(scheduleId, request.Date, User.GetUserId(), familyId, role, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ForbidJwt(ex.Message, ErrorCodes.Message(ex.Message));
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(ErrorResponse.From(ex.Message));
        }
        catch (KeyNotFoundException ex) when (ex.Message == ErrorCodes.ScheduleNotFound)
        {
            return NotFound(ErrorResponse.From(ex.Message));
        }
    }

    /// <summary>冲突检测（可选调用）</summary>
    [HttpPost("check-conflict")]
    public async Task<IActionResult> CheckConflict([FromBody] ScheduleConflictCheckRequest request, CancellationToken ct)
    {
        var (familyId, _) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct); // 鉴权
        try
        {
            var result = await _conflictService.CheckConflictAsync(familyId, request, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex) when (IsDomainError(ex.Message))
        {
            return BadRequest(ErrorResponse.From(ex.Message));
        }
    }

    private static bool IsDomainError(string message) =>
        message switch
        {
            ErrorCodes.MemberNotSelected or ErrorCodes.ChildNotSelected
                or ErrorCodes.MemberNotInFamily or ErrorCodes.ChildNotInFamily
                or ErrorCodes.ScheduleNameEmpty or ErrorCodes.ScheduleNameTooLong
                or ErrorCodes.TimeSlotInvalid or ErrorCodes.NoDaySelected or ErrorCodes.NotesTooLong
                or ErrorCodes.DueDateInvalid or ErrorCodes.RepeatEndDateInvalid or ErrorCodes.DueDateRequired
                or ErrorCodes.ScheduleAlreadyCancelled or ErrorCodes.HomeworkNoCancel
                or ErrorCodes.NotCancelledOrExcluded or ErrorCodes.InvalidScope or ErrorCodes.ScheduleTypeInvalid
                or ErrorCodes.LocationTooLong or ErrorCodes.ScheduleTypeRequired
                => true,
            _ => false
        };

    private ObjectResult ForbidJwt(string errorCode, string message)
    {
        return StatusCode(403, new ErrorResponse(errorCode, message, null));
    }

    /// <summary>找到从今天起下一个指定星期几的日期（用于冲突检测时计算正确的 DayOfWeek）</summary>
    private static DateOnly GetNextDateForDayOfWeek(DayOfWeek dayOfWeek)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        int daysUntil = ((int)dayOfWeek - (int)today.DayOfWeek + 7) % 7;
        return today.AddDays(daysUntil == 0 ? 7 : daysUntil);
    }
}
