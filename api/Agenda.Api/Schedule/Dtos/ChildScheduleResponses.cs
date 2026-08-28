using Agenda.Api.Domain.Interfaces;

namespace Agenda.Api.Schedule.Dtos;

// ===== 孩子端响应 DTO（与 openspec/contracts/family/dto.json 对齐）=====

/// <summary>
/// 孩子端日程列表响应。包含列表 + 当日完成统计，供今日/周/月视图共用。
/// 字段名与 contracts/family/dto.json 的 ChildScheduleListResponse 一致。
/// </summary>
public class ChildScheduleListResponse
{
    /// <summary>日程列表（按时间顺序）</summary>
    public List<ScheduleInfo> Items { get; set; } = new();

    /// <summary>已完成数量（按 query 当天/当周/当月内的 Checkin 记录统计）</summary>
    public int CompletedCount { get; set; }

    /// <summary>总日程数（仅计入未取消、未排除且按对应日期范围过滤后的日程实例）</summary>
    public int TotalCount { get; set; }

    /// <summary>完成百分比（0-100，保留两位小数）。当 totalCount == 0 时为 0。</summary>
    public double CompletionPercentage { get; set; }
}

/// <summary>
/// 孩子本周完成率响应。返回 (percentage, completed, total) 三元组。
/// 字段名与 contracts/family/dto.json 的 ChildWeeklyCompletionResponse 一致。
/// </summary>
public class ChildWeeklyCompletionResponse
{
    /// <summary>完成百分比（0-100，保留两位小数）</summary>
    public double Percentage { get; set; }

    /// <summary>本周已完成数量</summary>
    public int Completed { get; set; }

    /// <summary>本周总日程数</summary>
    public int Total { get; set; }
}
