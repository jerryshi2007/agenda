using Agenda.Api.Family.Dtos;
using Agenda.Api.Family.Services;
using Agenda.Api.Family.Validators;
using Agenda.Api.Infrastructure;
using Agenda.Api.Shared.Extensions;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Agenda.Api.Family.Controllers;

[ApiController]
[Route("api/v1/families")]
[Authorize]
public class FamilyController : ControllerBase
{
    private readonly IFamilyLifecycleService _lifecycle;
    private readonly IInvitationCodeService _inviteCodes;
    private readonly IShareService _share;
    private readonly IValidator<CreateFamilyRequest> _createValidator;
    private readonly IValidator<UpdateFamilyNameRequest> _updateNameValidator;
    private readonly IValidator<GenerateInviteCodeRequest> _generateValidator;
    private readonly IValidator<JoinByCodeRequest> _joinValidator;
    private readonly IValidator<DissolveFamilyRequest> _dissolveValidator;
    private readonly IValidator<SetDisplayModeRequest> _displayModeValidator;

    public FamilyController(
        IFamilyLifecycleService lifecycle,
        IInvitationCodeService inviteCodes,
        IShareService share,
        IValidator<CreateFamilyRequest> createValidator,
        IValidator<UpdateFamilyNameRequest> updateNameValidator,
        IValidator<GenerateInviteCodeRequest> generateValidator,
        IValidator<JoinByCodeRequest> joinValidator,
        IValidator<DissolveFamilyRequest> dissolveValidator,
        IValidator<SetDisplayModeRequest> displayModeValidator)
    {
        _lifecycle = lifecycle;
        _inviteCodes = inviteCodes;
        _share = share;
        _createValidator = createValidator;
        _updateNameValidator = updateNameValidator;
        _generateValidator = generateValidator;
        _joinValidator = joinValidator;
        _dissolveValidator = dissolveValidator;
        _displayModeValidator = displayModeValidator;
    }

    /// <summary>服务器当前时间（UTC），数据库 timestamp with time zone 仅接受 UTC offset。</summary>
    private static DateTimeOffset ServerTime() => DateTimeOffset.UtcNow;

    /// <summary>
    /// 解析 X-Family-Id Header。未携带或解析失败返回 null（具体端点决定是否必填）。
    /// </summary>
    private Guid? GetFamilyIdFromHeader()
    {
        if (!Request.Headers.TryGetValue("X-Family-Id", out var values)) return null;
        var raw = values.ToString();
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    // ---------- 我的家庭（无 X-Family-Id）----------

    /// <summary>获取当前用户所有家庭列表（用于多家庭切换）。</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyFamilies(CancellationToken ct)
        => Ok(await _lifecycle.GetMyFamiliesAsync(User.GetUserId(), ct));

    // ---------- 创建 / 加入 / 恢复（无 X-Family-Id）----------

    /// <summary>创建家庭。首个成员即为创建者。</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFamilyRequest request, CancellationToken ct)
    {
        await _createValidator.ValidateAndThrowAsync(request, ct);
        var resp = await _lifecycle.CreateAsync(User.GetUserId(), request, ServerTime(), ct);
        return CreatedAtAction(nameof(GetMembers), new { id = resp.FamilyId }, resp);
    }

    /// <summary>通过 6 位邀请码加入家庭。</summary>
    [HttpPost("join-by-code")]
    public async Task<IActionResult> JoinByCode([FromBody] JoinByCodeRequest request, CancellationToken ct)
    {
        await _joinValidator.ValidateAndThrowAsync(request, ct);
        return Ok(await _inviteCodes.JoinByCodeAsync(request, User.GetUserId(), ServerTime(), ct));
    }

    /// <summary>恢复已解散家庭（30 天保留期内）。</summary>
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
        => Ok(await _lifecycle.RestoreAsync(id, User.GetUserId(), ServerTime(), ct));

    // ---------- 需要 X-Family-Id 的端点 ----------

    /// <summary>修改家庭名称（家长权限）。</summary>
    [HttpPut("{id:guid}/name")]
    public async Task<IActionResult> UpdateName(Guid id, [FromBody] UpdateFamilyNameRequest request, CancellationToken ct)
    {
        await _updateNameValidator.ValidateAndThrowAsync(request, ct);
        EnsureFamilyContext(id);
        await _lifecycle.UpdateNameAsync(id, User.GetUserId(), request, ct);
        return Ok(new { familyId = id });
    }

    /// <summary>获取家庭成员列表（家长 + 孩子分组）。</summary>
    [HttpGet("{id:guid}/members")]
    public async Task<IActionResult> GetMembers(Guid id, CancellationToken ct)
    {
        EnsureFamilyContext(id);
        return Ok(await _lifecycle.GetMembersAsync(id, User.GetUserId(), ct));
    }

    /// <summary>生成邀请码（家长权限）。</summary>
    [HttpPost("{id:guid}/invite-code")]
    public async Task<IActionResult> GenerateInviteCode(Guid id, [FromBody] GenerateInviteCodeRequest request, CancellationToken ct)
    {
        await _generateValidator.ValidateAndThrowAsync(request, ct);
        EnsureFamilyContext(id);
        return Ok(await _inviteCodes.GenerateAsync(id, User.GetUserId(), request, ServerTime(), ct));
    }

    /// <summary>获取家庭邀请记录列表（家长权限）。</summary>
    [HttpGet("{id:guid}/invites")]
    public async Task<IActionResult> ListInvites(Guid id, CancellationToken ct)
    {
        EnsureFamilyContext(id);
        return Ok(await _inviteCodes.ListAsync(id, User.GetUserId(), ct));
    }

    /// <summary>撤销邀请码（仅邀请人本人）。</summary>
    [HttpDelete("{id:guid}/invites/{codeId:guid}")]
    public async Task<IActionResult> RevokeInviteCode(Guid id, Guid codeId, CancellationToken ct)
    {
        EnsureFamilyContext(id);
        await _inviteCodes.RevokeAsync(id, User.GetUserId(), codeId, ct);
        return Ok(new { codeId });
    }

    /// <summary>移除家庭成员（家长权限，不能移除自己）。</summary>
    [HttpDelete("{id:guid}/members/{memberId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid memberId, CancellationToken ct)
    {
        EnsureFamilyContext(id);
        await _lifecycle.RemoveMemberAsync(id, User.GetUserId(), memberId, ct);
        return Ok(new { memberId });
    }

    /// <summary>转让创建者（创建者本人，目标必须是家长）。</summary>
    [HttpPost("{id:guid}/transfer-creator/{newCreatorMemberId:guid}")]
    public async Task<IActionResult> TransferCreator(Guid id, Guid newCreatorMemberId, CancellationToken ct)
    {
        EnsureFamilyContext(id);
        await _lifecycle.TransferCreatorAsync(id, User.GetUserId(), newCreatorMemberId, ct);
        return Ok(new { familyId = id, newCreatorMemberId });
    }

    /// <summary>设置孩子展示模式（家长权限）。</summary>
    [HttpPut("members/{memberId:guid}/display-mode")]
    public async Task<IActionResult> SetDisplayMode(Guid memberId, [FromBody] SetDisplayModeRequest request, CancellationToken ct)
    {
        await _displayModeValidator.ValidateAndThrowAsync(request, ct);
        var familyId = GetFamilyIdFromHeader()
            ?? throw new DomainException(Infrastructure.ErrorCodes.FamilyNotFound);
        await _lifecycle.SetMemberDisplayModeAsync(familyId, User.GetUserId(), memberId, request, ct);
        return Ok(new { memberId, displayMode = request.DisplayMode });
    }

    /// <summary>退出家庭（非创建者；非最后家长）。</summary>
    [HttpPost("{id:guid}/exit")]
    public async Task<IActionResult> Exit(Guid id, CancellationToken ct)
    {
        EnsureFamilyContext(id);
        return Ok(await _lifecycle.ExitAsync(id, User.GetUserId(), ct));
    }

    /// <summary>解散家庭（创建者或最后一人；需输入名称确认）。</summary>
    [HttpPost("{id:guid}/dissolve")]
    public async Task<IActionResult> Dissolve(Guid id, [FromBody] DissolveFamilyRequest request, CancellationToken ct)
    {
        await _dissolveValidator.ValidateAndThrowAsync(request, ct);
        EnsureFamilyContext(id);
        await _lifecycle.DissolveAsync(id, User.GetUserId(), request, ServerTime(), ct);
        return Ok(new { familyId = id, dissolved = true });
    }

    // ---------- 公开端点（无需 X-Family-Id）----------

    /// <summary>获取微信分享卡片信息（无需鉴权）。</summary>
    [HttpGet("get-share-info/{code}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetShareInfo(string code, CancellationToken ct)
        => Ok(await _share.GetShareInfoAsync(code, ct));

    /// <summary>
    /// 校验请求的 familyId 与 X-Family-Id Header 一致，防止路径参数串号。
    /// X-Family-Id 缺失或不一致返回 404 FamilyNotFound（避免暴露家庭存在性）。
    /// </summary>
    private void EnsureFamilyContext(Guid id)
    {
        var headerId = GetFamilyIdFromHeader();
        if (headerId == null || headerId != id)
            throw new DomainException(Infrastructure.ErrorCodes.FamilyNotFound);
    }
}
