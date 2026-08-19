namespace Agenda.Api.Infrastructure;

/// <summary>
/// 错误码与中文提示、HTTP 状态码映射。
/// 从 openspec/contracts/{auth,checkin,family}/errors.json 生成，禁止在 Controller/Service 中硬编码字符串字面量。
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

    // ---- Family module（从 openspec/contracts/family/errors.json 生成）----
    public const string FamilyNotFound = "FAMILY_NOT_FOUND";
    public const string FamilyAlreadyDissolved = "FAMILY_ALREADY_DISSOLVED";
    public const string FamilyNotDissolved = "FAMILY_NOT_DISSOLVED";
    public const string DissolvedExpired = "DISSOLVED_EXPIRED";
    public const string FamilyNameMismatch = "FAMILY_NAME_MISMATCH";
    public const string FamilyNameInvalidLength = "FAMILY_NAME_INVALID_LENGTH";
    public const string FamilyMemberLimitExceeded = "FAMILY_MEMBER_LIMIT_EXCEEDED";
    public const string FamilyCreatorCannotExit = "FAMILY_CREATOR_CANNOT_EXIT";
    public const string LastParentCannotExit = "LAST_PARENT_CANNOT_EXIT";
    public const string CannotRemoveSelf = "CANNOT_REMOVE_SELF";
    public const string MemberNotFound = "MEMBER_NOT_FOUND";
    public const string UserAlreadyInFamily = "USER_ALREADY_IN_FAMILY";
    public const string PermissionDenied = "PERMISSION_DENIED";
    public const string InvalidTransferTarget = "INVALID_TRANSFER_TARGET";
    public const string InvalidInvitationCode = "INVALID_INVITATION_CODE";
    public const string InvitationCodeExpired = "INVITATION_CODE_EXPIRED";
    public const string InvitationCodeUsed = "INVITATION_CODE_USED";
    public const string InvitationCodeRedeemed = "INVITATION_CODE_REDEEMED";
    public const string InvitationCannotRevoke = "INVITATION_CANNOT_REVOKE";
    public const string InvitationCodeGenerationFailed = "INVITATION_CODE_GENERATION_FAILED";

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
        [ScheduleNotFound] = "日程不存在",
        [FamilyNotFound] = "家庭不存在",
        [FamilyAlreadyDissolved] = "家庭已解散",
        [FamilyNotDissolved] = "家庭未解散",
        [DissolvedExpired] = "数据已过期删除，无法恢复",
        [FamilyNameMismatch] = "家庭名称不匹配，请重新输入",
        [FamilyNameInvalidLength] = "家庭名称需要 2-20 个字符",
        [FamilyMemberLimitExceeded] = "家庭已满（10 人），无法加入",
        [FamilyCreatorCannotExit] = "创建者无法退出，请先解散家庭",
        [LastParentCannotExit] = "请先将孩子移除或转让家庭给其他家长，才能退出",
        [CannotRemoveSelf] = "不能移除自己，请使用退出功能",
        [MemberNotFound] = "成员不存在",
        [UserAlreadyInFamily] = "你已是该家庭成员",
        [PermissionDenied] = "无权限执行此操作",
        [InvalidTransferTarget] = "只能转让给家长角色成员",
        [InvalidInvitationCode] = "邀请码无效，请检查后重试",
        [InvitationCodeExpired] = "邀请码已失效，请联系家长重新获取",
        [InvitationCodeUsed] = "邀请码已被使用",
        [InvitationCodeRedeemed] = "邀请码已被撤销",
        [InvitationCannotRevoke] = "邀请码已使用，无法撤销",
        [InvitationCodeGenerationFailed] = "邀请码生成冲突，请稍后重试",
        [TemplateNameEmpty] = "模板名称不能为空",
        [TemplateNameTooLong] = "模板名称不能超过 50 个字符",
        [TemplateNotesTooLong] = "备注不能超过 500 个字符",
        [TemplateLocationTooLong] = "地点不能超过 100 个字符",
        [TemplateTimeslotInvalid] = "作业任务模板不能配置时间槽",
        [TemplateTimeslotRequired] = "课后活动/日常作息模板至少需要一个时间槽",
        [TemplateTimeslotTimeInvalid] = "时间槽开始时间不能晚于或等于结束时间",
        [TemplateDuplicateName] = "当前家庭已存在同名模板",
        [TemplateNotFound] = "模板不存在",
        [TemplatePresetReadonly] = "预设模板不可编辑或删除",
        [TemplateNotOwner] = "仅创建者可编辑或删除此模板",
        [TemplateChildAccessDenied] = "孩子角色无权访问模板",
        [TemplateChildNotInFamily] = "所选孩子不属于当前家庭",
        [TemplateStartDateInvalid] = "起始日期不能早于今天",
        [TemplateTypeInvalid] = "模板类型无效"
    };

    // Template module constants
    public const string TemplateNameEmpty = "TEMPLATE_NAME_EMPTY";
    public const string TemplateNameTooLong = "TEMPLATE_NAME_TOO_LONG";
    public const string TemplateNotesTooLong = "TEMPLATE_NOTES_TOO_LONG";
    public const string TemplateLocationTooLong = "TEMPLATE_LOCATION_TOO_LONG";
    public const string TemplateTimeslotInvalid = "TEMPLATE_TIMESLOT_INVALID";
    public const string TemplateTimeslotRequired = "TEMPLATE_TIMESLOT_REQUIRED";
    public const string TemplateTimeslotTimeInvalid = "TEMPLATE_TIMESLOT_TIME_INVALID";
    public const string TemplateDuplicateName = "TEMPLATE_DUPLICATE_NAME";
    public const string TemplateNotFound = "TEMPLATE_NOT_FOUND";
    public const string TemplatePresetReadonly = "TEMPLATE_PRESET_READONLY";
    public const string TemplateNotOwner = "TEMPLATE_NOT_OWNER";
    public const string TemplateChildAccessDenied = "CHILD_ACCESS_DENIED";
    public const string TemplateChildNotInFamily = "CHILD_NOT_IN_FAMILY";
    public const string TemplateStartDateInvalid = "START_DATE_INVALID";
    public const string TemplateTypeInvalid = "TEMPLATE_TYPE_INVALID";

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
        [ScheduleNotFound] = 404,
        [FamilyNotFound] = 404,
        [FamilyAlreadyDissolved] = 400,
        [FamilyNotDissolved] = 400,
        [DissolvedExpired] = 410,
        [FamilyNameMismatch] = 400,
        [FamilyNameInvalidLength] = 400,
        [FamilyMemberLimitExceeded] = 403,
        [FamilyCreatorCannotExit] = 403,
        [LastParentCannotExit] = 403,
        [CannotRemoveSelf] = 400,
        [MemberNotFound] = 404,
        [UserAlreadyInFamily] = 400,
        [PermissionDenied] = 403,
        [InvalidTransferTarget] = 400,
        [InvalidInvitationCode] = 400,
        [InvitationCodeExpired] = 400,
        [InvitationCodeUsed] = 400,
        [InvitationCodeRedeemed] = 400,
        [InvitationCannotRevoke] = 400,
        [InvitationCodeGenerationFailed] = 503,
        [TemplateNameEmpty] = 400,
        [TemplateNameTooLong] = 400,
        [TemplateNotesTooLong] = 400,
        [TemplateLocationTooLong] = 400,
        [TemplateTimeslotInvalid] = 400,
        [TemplateTimeslotRequired] = 400,
        [TemplateTimeslotTimeInvalid] = 400,
        [TemplateDuplicateName] = 409,
        [TemplateNotFound] = 404,
        [TemplatePresetReadonly] = 403,
        [TemplateNotOwner] = 403,
        [TemplateChildAccessDenied] = 403,
        [TemplateChildNotInFamily] = 400,
        [TemplateStartDateInvalid] = 400,
        [TemplateTypeInvalid] = 400
    };

    public static string Message(string code) =>
        Messages.TryGetValue(code, out var message) ? message : Messages[InternalError];

    public static int HttpStatus(string code) =>
        HttpStatuses.TryGetValue(code, out var status) ? status : 500;
}
