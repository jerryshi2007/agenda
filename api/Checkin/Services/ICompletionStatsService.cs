namespace Agenda.Api.Checkin.Services;

/// <summary>
/// 完成率统计服务接口。供 ChildScheduleController 调用孩子端本周完成率统计。
/// </summary>
public interface ICompletionStatsService
{
    /// <summary>
    /// 获取孩子本周完成率统计。只统计 AssignedChildId == userId 的日程,
    /// 排除已取消、已排除日期、跨家庭访问。
    /// </summary>
    /// <param name="userId">孩子用户 Id</param>
    /// <param name="familyId">家庭 Id(用于限定 familyId 范围)</param>
    /// <param name="weekStart">本周周一</param>
    /// <param name="ct">取消令牌</param>
    /// <returns>(percentage, completed, total)</returns>
    Task<(double Percentage, int Completed, int Total)> GetChildWeeklyCompletionRateAsync(
        Guid userId, Guid familyId, DateOnly weekStart, CancellationToken ct = default);
}
