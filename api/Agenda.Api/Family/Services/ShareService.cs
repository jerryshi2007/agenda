using Agenda.Api.Domain.Entities;
using Agenda.Api.Family.Dtos;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Family.Services;

/// <summary>
/// 微信分享卡片服务。输入邀请码，返回家庭名称、邀请人、目标角色与有效性。
/// 公开接口（无需鉴权）但不做优惠/敏感信息泄露：邀请码不存在时返回 isValid=false 占位响应。
/// </summary>
public interface IShareService
{
    Task<GetShareInfoResponse> GetShareInfoAsync(string code, CancellationToken ct = default);
}

public class ShareService : IShareService
{
    private readonly AppDbContext _db;

    public ShareService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<GetShareInfoResponse> GetShareInfoAsync(string code, CancellationToken ct = default)
    {
        var record = await _db.InvitationCodes
            .Include(c => c.Family)
            .Include(c => c.Creator)
            .FirstOrDefaultAsync(c => c.Code == code, ct);

        if (record == null)
            return new GetShareInfoResponse { InviteCode = code, IsValid = false };

        var now = DateTimeOffset.UtcNow;
        var isValid = record.Status == Domain.Enums.InvitationCodeStatus.Pending
            && record.ExpiresAt > now
            && record.Family.Status == Domain.Enums.FamilyStatus.Normal;

        return new GetShareInfoResponse
        {
            FamilyName = record.Family.Name,
            InviterName = record.Creator.Nickname,
            TargetRole = record.TargetRole,
            InviteCode = code,
            IsValid = isValid
        };
    }
}
