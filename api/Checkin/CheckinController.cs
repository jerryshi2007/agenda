using Agenda.Api.Checkin.Dtos;
using Agenda.Api.Checkin.Validators;
using Agenda.Api.Shared.Extensions;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Agenda.Api.Checkin;

[ApiController]
[Route("api/v1/checkin")]
[Authorize]
public class CheckinController : ControllerBase
{
    private readonly ICheckinService _checkinService;
    private readonly IValidator<CheckinRequest> _validator;

    public CheckinController(ICheckinService checkinService, IValidator<CheckinRequest> validator)
    {
        _checkinService = checkinService;
        _validator = validator;
    }

    /// <summary>查询打卡窗口状态</summary>
    [HttpGet("window/{scheduleId:guid}/{date}")]
    public async Task<IActionResult> GetWindow(Guid scheduleId, DateOnly date, CancellationToken ct)
        => Ok(await _checkinService.GetCheckinWindowAsync(scheduleId, date, User.GetUserId(), ServerTime(), ct));

    /// <summary>执行打卡（幂等）</summary>
    [HttpPost]
    public async Task<IActionResult> Checkin([FromBody] CheckinRequest request, CancellationToken ct)
    {
        await _validator.ValidateAndThrowAsync(request, ct);
        return Ok(await _checkinService.CheckinAsync(request.ScheduleId, request.Date, User.GetUserId(), ServerTime(), ct));
    }

    /// <summary>撤销打卡</summary>
    [HttpDelete("{scheduleId:guid}/{date}")]
    public async Task<IActionResult> Undo(Guid scheduleId, DateOnly date, CancellationToken ct)
        => Ok(await _checkinService.UndoAsync(scheduleId, date, User.GetUserId(), ServerTime(), ct));

    /// <summary>服务器北京时间（打卡时间判定唯一基准，US-CHK-06）。</summary>
    private static DateTimeOffset ServerTime() =>
        DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(8));
}
