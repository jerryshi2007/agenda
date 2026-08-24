namespace Agenda.Api.Schedule.Dtos;

public class CalendarQueryRequest
{
    public string View { get; set; } = "month";
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public Guid? MemberId { get; set; }

    /// <summary>deprecated 兼容字段（V+1 移除），语义同 MemberId。</summary>
    public Guid? ChildId { get; set; }

    public List<string>? ScheduleTypes { get; set; }

    /// <summary>归一化：两者都传以 MemberId 为准；仅传 ChildId 归一化为 MemberId；都空返回 null。</summary>
    public Guid? GetEffectiveMemberId() => MemberId ?? ChildId;
}

public class CalendarResponse
{
    public string View { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int TotalScheduleCount { get; set; }
    public List<CalendarDate> Dates { get; set; } = new();
}

public class CalendarDate
{
    public DateOnly Date { get; set; }
    public int ScheduleCount { get; set; }
    public List<CalendarDot> Dots { get; set; } = new();
    public List<CalendarSchedule> Schedules { get; set; } = new();
}

public class CalendarDot
{
    public string ScheduleType { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
}

public class CalendarSchedule
{
    public Guid ScheduleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ScheduleType { get; set; } = string.Empty;
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    public Guid AssignedMemberId { get; set; }

    /// <summary>deprecated 兼容字段（V+1 移除），值与 AssignedMemberId 相同。</summary>
    public Guid AssignedChildId { get; set; }

    /// <summary>关联成员角色（Parent/Child），用于前端双文案 label 渲染。</summary>
    public string AssignedMemberRole { get; set; } = string.Empty;

    public string? AssignedMemberName { get; set; }
    public string? ChildAvatarUrl { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Notes { get; set; }
    public DateOnly? DueDate { get; set; }
    public TimeOnly? SuggestedStartTime { get; set; }
    public TimeOnly? SuggestedEndTime { get; set; }
}
