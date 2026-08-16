using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 连续完成天数。Scope 多态：Schedule→单日程（SubjectId=ScheduleId）；Child→孩子整体（SubjectId=AssignedChildId）。
/// 连续天数仅对日常作息（DailyRoutine）计算。LastSettledDate 为幂等锚点（同日重复结算跳过）。
/// </summary>
public class Streak
{
    public long Id { get; set; }
    public StreakScope Scope { get; set; }
    public Guid SubjectId { get; set; }
    public int CurrentStreak { get; set; }
    public DateOnly? LastSettledDate { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
