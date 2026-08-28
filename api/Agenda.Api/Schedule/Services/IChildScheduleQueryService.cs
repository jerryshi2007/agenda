using Agenda.Api.Domain.Interfaces;
using Agenda.Api.Schedule.Dtos;

namespace Agenda.Api.Schedule.Services;

/// <summary>
/// 孩子端日程查询服务接口。供 ChildScheduleController 使用，
/// 所有查询自动按 AssignedChildId 过滤当前用户并只读（AsNoTracking）。
/// </summary>
public interface IChildScheduleQueryService
{
    /// <summary>获取某日孩子日程列表 + 完成统计（仅返回今日应执行的实例）</summary>
    Task<ChildScheduleListResponse> GetDailyListAsync(
        Guid userId, Guid familyId, DateOnly date, CancellationToken ct = default);

    /// <summary>获取本周孩子日程列表 + 完成统计。weekStart 必须是周一。</summary>
    Task<ChildScheduleListResponse> GetWeeklyListAsync(
        Guid userId, Guid familyId, DateOnly weekStart, CancellationToken ct = default);

    /// <summary>获取本月孩子日程列表 + 完成统计。monthStart 必须是 1 号。</summary>
    Task<ChildScheduleListResponse> GetMonthlyListAsync(
        Guid userId, Guid familyId, DateOnly monthStart, CancellationToken ct = default);

    /// <summary>按 id 获取单个日程。返回 null 表示不存在；非本人日程抛 UnauthorizedAccessException("CHILD_ACCESS_DENIED")。</summary>
    Task<ScheduleInfo?> GetByIdAsync(
        Guid scheduleId, Guid userId, Guid familyId, CancellationToken ct = default);
}
