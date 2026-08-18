namespace Agenda.Api.Family.Dtos;

// ===== Request DTOs（与 openspec/contracts/family/dto.json 对齐）=====

/// <summary>创建家庭请求。name 2-20 字符，role 必填。</summary>
public class CreateFamilyRequest
{
    public string Name { get; set; } = string.Empty;
    public Domain.Enums.UserRole Role { get; set; }
}

/// <summary>修改家庭名称请求。name 2-20 字符。</summary>
public class UpdateFamilyNameRequest
{
    public string Name { get; set; } = string.Empty;
}

/// <summary>生成邀请码请求。targetRole 必填；邀请孩子时 targetChildName + targetDisplayMode 必填。</summary>
public class GenerateInviteCodeRequest
{
    public Domain.Enums.UserRole TargetRole { get; set; }
    public string? TargetChildName { get; set; }
    public Domain.Enums.DisplayMode? TargetDisplayMode { get; set; }
}

/// <summary>通过邀请码加入家庭请求。code 必须 6 位、仅 2-9。</summary>
public class JoinByCodeRequest
{
    public string Code { get; set; } = string.Empty;
}

/// <summary>设置孩子展示模式请求。displayMode 必填。</summary>
public class SetDisplayModeRequest
{
    public Domain.Enums.DisplayMode DisplayMode { get; set; }
}

/// <summary>解散家庭请求。需要输入家庭名称二次确认。</summary>
public class DissolveFamilyRequest
{
    public string FamilyName { get; set; } = string.Empty;
}
