using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Interfaces;

/// <summary>
/// Schedule 模块对外暴露的查询接口（依赖反转：由 checkin-module 定义契约，Schedule 模块实现）。
/// checkin-module 通过此接口查询 Schedule 基础信息用于打卡窗口判定，无需直接依赖 Schedule 表结构。
/// </summary>
public interface IScheduleQueryService
{
    /// <summary>获取日程基本信息</summary>
    Task<ScheduleInfo?> GetScheduleAsync(Guid scheduleId, CancellationToken ct = default);

    /// <summary>获取指定日期的时间槽（根据 DayOfWeek 查询 TimeSlot 表）</summary>
    Task<(TimeOnly? StartTime, TimeOnly? EndTime)> GetTimeSlotAsync(Guid scheduleId, DateOnly date, CancellationToken ct = default);

    /// <summary>获取日程取消状态（查询 Cancellation 表）</summary>
    Task<bool> GetCancellationStatusAsync(Guid scheduleId, DateOnly date, CancellationToken ct = default);

    /// <summary>检查日期是否被排除（查询 ScheduleDateExclusion 表）</summary>
    Task<bool> IsDateExcludedAsync(Guid scheduleId, DateOnly date, CancellationToken ct = default);

    /// <summary>获取作业任务截止日期（仅作业任务返回非 null）</summary>
    Task<DateOnly?> GetDueDateAsync(Guid scheduleId, CancellationToken ct = default);
}

/// <summary>
/// Schedule 基础信息 DTO——字段名与 checkin-module 契约对齐。
/// </summary>
public class ScheduleInfo
{
    public Guid ScheduleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public ScheduleType ScheduleType { get; set; }
    public Guid FamilyId { get; set; }
    public Guid AssignedChildId { get; set; }
    public bool IsDeleted { get; set; }
}
