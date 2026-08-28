namespace Agenda.Api.Domain.Enums;

/// <summary>
/// 连续天数聚合范围。Schedule=单日程连续打卡天数（SubjectId=ScheduleId）；
/// Child=孩子整体连续打卡天数（SubjectId=AssignedChildId）。
/// 值从 openspec/contracts/checkin/enums.json 生成，禁止在业务代码中硬编码。
/// </summary>
public enum StreakScope
{
    Schedule = 1,
    Child = 2
}
