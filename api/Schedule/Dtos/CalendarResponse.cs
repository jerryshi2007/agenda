namespace Agenda.Api.Schedule.Dtos;

public class CalendarQueryRequest
{
    public string View { get; set; } = "month";
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public Guid? ChildId { get; set; }
    public List<string>? ScheduleTypes { get; set; }
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
    public string? ChildName { get; set; }
    public string? ChildAvatarUrl { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Notes { get; set; }
    public DateOnly? DueDate { get; set; }
    public TimeOnly? SuggestedStartTime { get; set; }
    public TimeOnly? SuggestedEndTime { get; set; }
}
