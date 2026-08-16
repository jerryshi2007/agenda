namespace Agenda.Api.Infrastructure;

/// <summary>
/// 错误码与中文提示、HTTP 状态码映射。
/// 从 openspec/contracts/auth/errors.json 生成，禁止在 Controller/Service 中硬编码字符串字面量。
/// </summary>
public static class ErrorCodes
{
    public const string CodeInvalid = "CODE_INVALID";
    public const string CodeExpired = "CODE_EXPIRED";
    public const string NicknameEmpty = "NICKNAME_EMPTY";
    public const string NicknameTooLong = "NICKNAME_TOO_LONG";
    public const string NicknameSensitive = "NICKNAME_SENSITIVE";
    public const string FileFormatInvalid = "FILE_FORMAT_INVALID";
    public const string FamilyStillActive = "FAMILY_STILL_ACTIVE";
    public const string NotDeleted = "NOT_DELETED";
    public const string Expired = "EXPIRED";
    public const string TokenInvalid = "TOKEN_INVALID";
    public const string FileTooLarge = "FILE_TOO_LARGE";
    public const string RateLimited = "RATE_LIMITED";
    public const string WeChatApiError = "WECHAT_API_ERROR";
    public const string WeChatApiTimeout = "WECHAT_API_TIMEOUT";
    public const string InternalError = "INTERNAL_ERROR";

    // ---- Checkin module（从 openspec/contracts/checkin/errors.json 生成）----
    public const string CheckinWindowClosed = "CHECKIN_WINDOW_CLOSED";
    public const string TerminalState = "TERMINAL_STATE";
    public const string NotCheckedIn = "NOT_CHECKED_IN";
    public const string WindowClosed = "WINDOW_CLOSED";
    public const string ScheduleCancelled = "SCHEDULE_CANCELLED";
    public const string NotFamilyMember = "NOT_FAMILY_MEMBER";
    public const string ScheduleNotFound = "SCHEDULE_NOT_FOUND";

    private static readonly IReadOnlyDictionary<string, string> Messages = new Dictionary<string, string>
    {
        [CodeInvalid] = "微信登录凭证无效，请重试",
        [CodeExpired] = "微信登录凭证已过期，请重试",
        [NicknameEmpty] = "昵称不能为空",
        [NicknameTooLong] = "昵称不能超过 20 个字符",
        [NicknameSensitive] = "昵称包含不允许的词汇",
        [FileFormatInvalid] = "头像文件格式不支持",
        [FamilyStillActive] = "请先退出所有家庭后再注销",
        [NotDeleted] = "账户未处于注销状态，无法恢复",
        [Expired] = "注销已超过 30 天，无法恢复",
        [TokenInvalid] = "登录已过期，请重新登录",
        [FileTooLarge] = "头像文件过大，请重新选择",
        [RateLimited] = "操作过于频繁，请稍后再试",
        [WeChatApiError] = "微信服务异常，请稍后重试",
        [WeChatApiTimeout] = "服务繁忙，请稍后重试",
        [InternalError] = "服务异常，请稍后重试",
        [CheckinWindowClosed] = "打卡时间窗口已关闭",
        [TerminalState] = "该日程已结算，不可打卡或撤销",
        [NotCheckedIn] = "该日程尚未打卡，无法撤销",
        [WindowClosed] = "撤销窗口已关闭，无法撤销",
        [ScheduleCancelled] = "该日程已取消或排除，无法打卡",
        [NotFamilyMember] = "你不是该日程所属家庭的成员，无权操作",
        [ScheduleNotFound] = "日程不存在"
    };

    private static readonly IReadOnlyDictionary<string, int> HttpStatuses = new Dictionary<string, int>
    {
        [CodeInvalid] = 400,
        [CodeExpired] = 400,
        [NicknameEmpty] = 400,
        [NicknameTooLong] = 400,
        [NicknameSensitive] = 400,
        [FileFormatInvalid] = 400,
        [FamilyStillActive] = 400,
        [NotDeleted] = 400,
        [Expired] = 400,
        [TokenInvalid] = 401,
        [FileTooLarge] = 413,
        [RateLimited] = 429,
        [WeChatApiError] = 502,
        [WeChatApiTimeout] = 503,
        [InternalError] = 500,
        [CheckinWindowClosed] = 400,
        [TerminalState] = 400,
        [NotCheckedIn] = 400,
        [WindowClosed] = 400,
        [ScheduleCancelled] = 400,
        [NotFamilyMember] = 403,
        [ScheduleNotFound] = 404
    };

    public static string Message(string code) =>
        Messages.TryGetValue(code, out var message) ? message : Messages[InternalError];

    public static int HttpStatus(string code) =>
        HttpStatuses.TryGetValue(code, out var status) ? status : 500;
}
