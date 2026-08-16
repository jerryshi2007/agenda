using Agenda.Api.Checkin.Dtos;

namespace Agenda.Api.Checkin;

/// <summary>
/// 打卡模块服务契约：打卡窗口查询、执行打卡、撤销打卡。
/// 时间判定以 serverTime（服务器北京时间）为准，由调用方（Controller）注入。
/// </summary>
public interface ICheckinService
{
    Task<CheckinWindowResponse> GetCheckinWindowAsync(
        Guid scheduleId, DateOnly date, Guid userId, DateTimeOffset serverTime, CancellationToken ct = default);

    Task<CheckinResponse> CheckinAsync(
        Guid scheduleId, DateOnly date, Guid userId, DateTimeOffset serverTime, CancellationToken ct = default);

    Task<UndoCheckinResponse> UndoAsync(
        Guid scheduleId, DateOnly date, Guid userId, DateTimeOffset serverTime, CancellationToken ct = default);
}
