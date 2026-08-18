using System.Security.Cryptography;
using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Family.Dtos;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Family.Services;

/// <summary>
/// 邀请码服务。负责生成、撤销、列出与通过邀请码加入。
/// 邀请码规则：6 位数字，仅 2-9 八个数字（排除 0/1 避免孩子输入混淆），
/// 24h 有效，碰撞最多重试 10 次，全局唯一。
/// </summary>
public interface IInvitationCodeService
{
    Task<GenerateInviteCodeResponse> GenerateAsync(
        Guid familyId, Guid creatorId, GenerateInviteCodeRequest request, DateTimeOffset now, CancellationToken ct = default);
    Task RevokeAsync(Guid familyId, Guid userId, Guid codeId, CancellationToken ct = default);
    Task<List<InvitationCodeInfo>> ListAsync(Guid familyId, Guid userId, CancellationToken ct = default);
    Task<JoinFamilyResponse> JoinByCodeAsync(JoinByCodeRequest request, Guid userId, DateTimeOffset now, CancellationToken ct = default);
    Task<InvitationCodeInfo> GetShareInfoAsync(string code, CancellationToken ct = default);
}

public class InvitationCodeService : IInvitationCodeService
{
    /// <summary>邀请码字符集（2-9，排除 0/1）。</summary>
    private const string CodeCharset = "23456789";

    /// <summary>邀请码有效期。</summary>
    public static readonly TimeSpan CodeLifetime = TimeSpan.FromHours(24);

    /// <summary>碰撞重试上限。8^6 = 262144 码空间，实际碰撞概率极低，10 次足以覆盖。</summary>
    public const int MaxCollisionRetries = 10;

    private readonly AppDbContext _db;

    public InvitationCodeService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<GenerateInviteCodeResponse> GenerateAsync(
        Guid familyId, Guid creatorId, GenerateInviteCodeRequest request, DateTimeOffset now, CancellationToken ct = default)
    {
        var family = await _db.Families
            .FirstOrDefaultAsync(f => f.Id == familyId, ct)
            ?? throw new DomainException(ErrorCodes.FamilyNotFound);

        if (family.Status == FamilyStatus.Dissolved)
            throw new DomainException(ErrorCodes.FamilyAlreadyDissolved);

        var isMember = await _db.FamilyMembers
            .AnyAsync(m => m.FamilyId == familyId && m.UserId == creatorId && m.IsDeleted == false, ct);
        if (!isMember)
            throw new DomainException(ErrorCodes.NotFamilyMember);

        var creatorMember = await _db.FamilyMembers
            .FirstAsync(m => m.FamilyId == familyId && m.UserId == creatorId, ct);
        if (creatorMember.Role != UserRole.Parent)
            throw new DomainException(ErrorCodes.PermissionDenied);

        var activeCount = await _db.FamilyMembers
            .CountAsync(m => m.FamilyId == familyId && m.IsDeleted == false, ct);
        if (activeCount >= FamilyLifecycleService.MaxMemberCount)
            throw new DomainException(ErrorCodes.FamilyMemberLimitExceeded);

        var code = await GenerateUniqueCodeAsync(ct);
        var record = new DomainInvitationCode
        {
            Id = Guid.NewGuid(),
            Code = code,
            FamilyId = familyId,
            TargetRole = request.TargetRole,
            TargetChildName = request.TargetChildName,
            TargetDisplayMode = request.TargetDisplayMode,
            CreatorId = creatorId,
            CreatedAt = now,
            ExpiresAt = now.Add(CodeLifetime),
            Status = InvitationCodeStatus.Pending
        };
        _db.InvitationCodes.Add(record);
        await _db.SaveChangesAsync(ct);
        return new GenerateInviteCodeResponse { Code = code, ExpiresAt = record.ExpiresAt };
    }

    public async Task RevokeAsync(Guid familyId, Guid userId, Guid codeId, CancellationToken ct = default)
    {
        var code = await _db.InvitationCodes
            .FirstOrDefaultAsync(c => c.Id == codeId && c.FamilyId == familyId, ct)
            ?? throw new DomainException(ErrorCodes.InvalidInvitationCode);

        if (code.CreatorId != userId)
            throw new DomainException(ErrorCodes.PermissionDenied);

        if (code.Status != InvitationCodeStatus.Pending)
            throw new DomainException(ErrorCodes.InvitationCannotRevoke);

        code.Status = InvitationCodeStatus.Redeemed;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<List<InvitationCodeInfo>> ListAsync(Guid familyId, Guid userId, CancellationToken ct = default)
    {
        await RequireParentAsync(familyId, userId, ct);
        var codes = await _db.InvitationCodes
            .Where(c => c.FamilyId == familyId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);
        return codes.Select(ToInfo).ToList();
    }

    public async Task<JoinFamilyResponse> JoinByCodeAsync(
        JoinByCodeRequest request, Guid userId, DateTimeOffset now, CancellationToken ct = default)
    {
        var code = await _db.InvitationCodes
            .FirstOrDefaultAsync(c => c.Code == request.Code, ct)
            ?? throw new DomainException(ErrorCodes.InvalidInvitationCode);

        if (code.Status == InvitationCodeStatus.Used)
            throw new DomainException(ErrorCodes.InvitationCodeUsed);
        if (code.Status == InvitationCodeStatus.Redeemed)
            throw new DomainException(ErrorCodes.InvitationCodeRedeemed);
        if (code.ExpiresAt <= now)
            throw new DomainException(ErrorCodes.InvitationCodeExpired);

        var family = await _db.Families.FirstOrDefaultAsync(f => f.Id == code.FamilyId, ct)
            ?? throw new DomainException(ErrorCodes.InvalidInvitationCode);
        if (family.Status == FamilyStatus.Dissolved)
            throw new DomainException(ErrorCodes.FamilyAlreadyDissolved);

        // 用户已经在任意家庭（active）则不能加入。
        var alreadyInFamily = await _db.FamilyMembers
            .AnyAsync(m => m.UserId == userId && m.IsDeleted == false, ct);
        if (alreadyInFamily)
            throw new DomainException(ErrorCodes.UserAlreadyInFamily);

        var activeCount = await _db.FamilyMembers
            .CountAsync(m => m.FamilyId == family.Id && m.IsDeleted == false, ct);
        if (activeCount >= FamilyLifecycleService.MaxMemberCount)
            throw new DomainException(ErrorCodes.FamilyMemberLimitExceeded);

        // 标记已使用 + 创建成员
        code.Status = InvitationCodeStatus.Used;
        var member = new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            UserId = userId,
            Role = code.TargetRole,
            DisplayMode = code.TargetDisplayMode ?? DisplayMode.Primary,
            ChildName = code.TargetChildName,
            JoinedAt = now
        };
        _db.FamilyMembers.Add(member);
        await _db.SaveChangesAsync(ct);
        return new JoinFamilyResponse { FamilyId = family.Id };
    }

    public async Task<InvitationCodeInfo> GetShareInfoAsync(string code, CancellationToken ct = default)
    {
        var record = await _db.InvitationCodes
            .Include(c => c.Family)
            .Include(c => c.Creator)
            .FirstOrDefaultAsync(c => c.Code == code, ct);

        if (record == null)
        {
            // 不暴露码不存在；用无效占位返回 isValid=false。
            return new InvitationCodeInfo
            {
                Code = code,
                Status = InvitationCodeStatus.Expired,
                CanRevoke = false
            };
        }

        return ToInfo(record, record.Family.Name, record.Creator.Nickname);
    }

    private async Task<string> GenerateUniqueCodeAsync(CancellationToken ct)
    {
        for (int attempt = 0; attempt < MaxCollisionRetries; attempt++)
        {
            var candidate = NewCode();
            var exists = await _db.InvitationCodes.AnyAsync(c => c.Code == candidate, ct);
            if (!exists) return candidate;
        }
        // 10 次重试仍全部碰撞：返回可重试错误（503）而非 500，让前端展示稍后重试。
        throw new DomainException(ErrorCodes.InvitationCodeGenerationFailed);
    }

    private static string NewCode()
    {
        // 使用密码学随机数生成邀请码，避免可预测码导致撞库/枚举。
        Span<char> buffer = stackalloc char[6];
        for (int i = 0; i < buffer.Length; i++)
            buffer[i] = CodeCharset[RandomNumberGenerator.GetInt32(CodeCharset.Length)];
        return new string(buffer);
    }

    private async Task RequireParentAsync(Guid familyId, Guid userId, CancellationToken ct)
    {
        var m = await _db.FamilyMembers
            .FirstOrDefaultAsync(x => x.FamilyId == familyId && x.UserId == userId && x.IsDeleted == false, ct)
            ?? throw new DomainException(ErrorCodes.NotFamilyMember);
        if (m.Role != UserRole.Parent)
            throw new DomainException(ErrorCodes.PermissionDenied);
    }

    private static InvitationCodeInfo ToInfo(DomainInvitationCode c) => new()
    {
        Id = c.Id,
        Code = c.Code,
        TargetRole = c.TargetRole,
        TargetChildName = c.TargetChildName,
        Status = c.Status,
        CreatedAt = c.CreatedAt,
        ExpiresAt = c.ExpiresAt,
        CanRevoke = c.Status == InvitationCodeStatus.Pending
    };

    private static InvitationCodeInfo ToInfo(DomainInvitationCode c, string familyName, string inviterName) => new()
    {
        Id = c.Id,
        Code = c.Code,
        TargetRole = c.TargetRole,
        TargetChildName = c.TargetChildName,
        Status = c.Status,
        CreatedAt = c.CreatedAt,
        ExpiresAt = c.ExpiresAt,
        CanRevoke = c.Status == InvitationCodeStatus.Pending
    };
}
