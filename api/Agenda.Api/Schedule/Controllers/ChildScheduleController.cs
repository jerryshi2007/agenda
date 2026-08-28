using Agenda.Api.Checkin.Services;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Shared.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Agenda.Api.Schedule.Controllers;

/// <summary>
/// 孩子端日程 Controller。提供今日/周/月只读视图 + 单日程详情 + 本周完成率统计。
/// 权限：仅 Child 角色可访问,自动按 AssignedChildId == CurrentUserId 过滤。
/// 设计依据：design.md ADR-001（孩子端页面独立于家长端）、ADR-003（复用查询逻辑）。
/// </summary>
[ApiController]
[Route("api/v1/child")]
[Authorize]
public class ChildScheduleController : ControllerBase
{
    private readonly IChildScheduleQueryService _childScheduleService;
    private readonly ICompletionStatsService _completionStats;
    private readonly IFamilyContextService _familyContext;

    public ChildScheduleController(
        IChildScheduleQueryService childScheduleService,
        ICompletionStatsService completionStats,
        IFamilyContextService familyContext)
    {
        _childScheduleService = childScheduleService;
        _completionStats = completionStats;
        _familyContext = familyContext;
    }

    /// <summary>获取孩子今日日程列表（含完成统计）。</summary>
    [HttpGet("schedule/today")]
    public async Task<IActionResult> GetToday(CancellationToken ct)
    {
        if (!await EnsureChildAsync(ct))
            return ForbidChild();

        var (familyId, _) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);
        var today = DateOnly.FromDateTime(DateTime.Today);
        var result = await _childScheduleService.GetDailyListAsync(User.GetUserId(), familyId, today, ct);
        return Ok(result);
    }

    /// <summary>获取孩子本周日程列表（含完成统计）。</summary>
    [HttpGet("schedule/week")]
    public async Task<IActionResult> GetWeek(CancellationToken ct)
    {
        if (!await EnsureChildAsync(ct))
            return ForbidChild();

        var (familyId, _) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);
        var weekStart = GetWeekStart(DateOnly.FromDateTime(DateTime.Today));
        var result = await _childScheduleService.GetWeeklyListAsync(User.GetUserId(), familyId, weekStart, ct);
        return Ok(result);
    }

    /// <summary>获取孩子本月日程列表（含完成统计）。</summary>
    [HttpGet("schedule/month")]
    public async Task<IActionResult> GetMonth(CancellationToken ct)
    {
        if (!await EnsureChildAsync(ct))
            return ForbidChild();

        var (familyId, _) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);
        var monthStart = new DateOnly(DateTime.Today.Year, DateTime.Today.Month, 1);
        var result = await _childScheduleService.GetMonthlyListAsync(User.GetUserId(), familyId, monthStart, ct);
        return Ok(result);
    }

    /// <summary>获取单个日程详情（只读）。</summary>
    [HttpGet("schedule/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        if (!await EnsureChildAsync(ct))
            return ForbidChild();

        var (familyId, _) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);
        try
        {
            var result = await _childScheduleService.GetByIdAsync(id, User.GetUserId(), familyId, ct);
            if (result == null)
                return NotFound(new { error = "SCHEDULE_NOT_FOUND" });
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ForbidJwt("CHILD_ACCESS_DENIED", ex.Message);
        }
    }

    /// <summary>获取孩子本周完成率统计。</summary>
    [HttpGet("stats/weekly-completion")]
    public async Task<IActionResult> GetWeeklyCompletion(CancellationToken ct)
    {
        if (!await EnsureChildAsync(ct))
            return ForbidChild();

        var (familyId, _) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);
        var weekStart = GetWeekStart(DateOnly.FromDateTime(DateTime.Today));
        var (percentage, completed, total) =
            await _completionStats.GetChildWeeklyCompletionRateAsync(User.GetUserId(), familyId, weekStart, ct);
        return Ok(new ChildWeeklyCompletionResponse
        {
            Percentage = percentage,
            Completed = completed,
            Total = total
        });
    }

    // ---- helpers ----

    /// <summary>校验当前用户角色为 Child。返回 true 表示放行,false 表示非 Child。</summary>
    private async Task<bool> EnsureChildAsync(CancellationToken ct)
    {
        try
        {
            var (_, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);
            return role == UserRole.Child;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }
    }

    private static DateOnly GetWeekStart(DateOnly date)
    {
        var dayOfWeek = (int)date.DayOfWeek;
        // 周一为一周开始:DayOfWeek.Sunday=0 → 减 6 天;其他 → 减 (dayOfWeek - 1) 天
        var daysFromMonday = dayOfWeek == 0 ? 6 : dayOfWeek - 1;
        return date.AddDays(-daysFromMonday);
    }

    private ObjectResult ForbidChild()
    {
        return StatusCode(403, new { error = "CHILD_ONLY_ENDPOINT", message = "仅孩子角色可访问" });
    }

    private ObjectResult ForbidJwt(string errorCode, string message)
    {
        return StatusCode(403, new { error = errorCode, message });
    }
}
