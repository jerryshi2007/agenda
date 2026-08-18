using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Family.Dtos;

// ===== Response DTOs（与 openspec/contracts/family/dto.json 对齐）=====

/// <summary>用户所属家庭信息（用于我的家庭列表与切换）。</summary>
public class FamilyInfo
{
    public Guid FamilyId { get; set; }
    public string FamilyName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public int MemberCount { get; set; }
    public DateTimeOffset LastActiveAt { get; set; }
}

/// <summary>家庭成员信息（含创建者标记与展示模式）。</summary>
public class FamilyMemberInfo
{
    public Guid MemberId { get; set; }
    public Guid UserId { get; set; }
    public UserRole Role { get; set; }
    public string? ChildName { get; set; }
    public DisplayMode DisplayMode { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset JoinedAt { get; set; }
    public string? AvatarUrl { get; set; }
    public string Nickname { get; set; } = string.Empty;
    public bool IsCreator { get; set; }
}

/// <summary>邀请码信息（含动态过期判定后的状态）。</summary>
public class InvitationCodeInfo
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public UserRole TargetRole { get; set; }
    public string? TargetChildName { get; set; }
    public InvitationCodeStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public bool CanRevoke { get; set; }
}

/// <summary>获取我的家庭列表响应。</summary>
public class GetMyFamiliesResponse
{
    public List<FamilyInfo> Families { get; set; } = new();
}

/// <summary>获取家庭成员列表响应。分家长/孩子两组，显示人数。</summary>
public class GetMembersResponse
{
    public string FamilyName { get; set; } = string.Empty;
    public Guid CreatorId { get; set; }
    public List<FamilyMemberInfo> Parents { get; set; } = new();
    public List<FamilyMemberInfo> Children { get; set; } = new();
    public int ActiveMemberCount { get; set; }
    public int MaxMemberCount { get; set; } = 10;
}

/// <summary>创建家庭响应。</summary>
public class CreateFamilyResponse
{
    public Guid FamilyId { get; set; }
}

/// <summary>生成邀请码响应。</summary>
public class GenerateInviteCodeResponse
{
    public string Code { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
}

/// <summary>微信分享卡片信息响应。isValid=false 时前端应展示"邀请码已失效"。</summary>
public class GetShareInfoResponse
{
    public string FamilyName { get; set; } = string.Empty;
    public string InviterName { get; set; } = string.Empty;
    public UserRole TargetRole { get; set; }
    public string InviteCode { get; set; } = string.Empty;
    public bool IsValid { get; set; }
}

/// <summary>恢复家庭响应。</summary>
public class RestoreFamilyResponse
{
    public bool Restored { get; set; }
}

/// <summary>退出家庭响应。hasOtherFamilies 提示前端是否要跳转引导页。</summary>
public class ExitFamilyResponse
{
    public bool Exited { get; set; }
    public bool HasOtherFamilies { get; set; }
}

/// <summary>通过邀请码加入家庭响应。</summary>
public class JoinFamilyResponse
{
    public Guid FamilyId { get; set; }
}
