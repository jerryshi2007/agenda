namespace Agenda.Api.Domain.Enums;

/// <summary>
/// 日程类型枚举。Schedule 模块直接引用此枚举。
/// 若此枚举在代码库中已存在（如 checkin-module 先落地），请删除本文件避免重复定义。
/// </summary>
public enum ScheduleType
{
    AfterSchoolActivity = 1,
    DailyRoutine = 2,
    HomeworkTask = 3
}
