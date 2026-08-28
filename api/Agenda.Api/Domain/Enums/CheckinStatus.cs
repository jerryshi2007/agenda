namespace Agenda.Api.Domain.Enums;

/// <summary>
/// 打卡实例状态（窗口查询/撤销响应的 status 字段，小写字符串，非 C# 枚举）。
/// 值从 openspec/contracts/checkin/enums.json CheckinStatus 生成，禁止在业务代码中硬编码。
/// excluded（已排除）与 cancelled（已取消）合并，统一返回 cancelled，不单独暴露 excluded。
/// </summary>
public static class CheckinStatus
{
    public const string Incomplete = "incomplete";
    public const string Completed = "completed";
    public const string Cancelled = "cancelled";
    public const string Ended = "ended";
    public const string Overdue = "overdue";

    public static string Label(string status) => status switch
    {
        Incomplete => "未完成",
        Completed => "已完成",
        Cancelled => "已取消",
        Ended => "已结束",
        Overdue => "逾期未完成",
        _ => "未完成"
    };
}
