using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Family.Dtos;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Family.Services;

/// <summary>
/// 家庭生命周期服务。负责家庭创建、改名、退出、解散、恢复，以及成员管理（列表/移除/转让/展示模式）。
/// 共享约束：所有变更操作均以「服务层校验 + DB 唯一索引兜底」双层防护。
/// </summary>
public interface IFamilyLifecycleService
{
    Task<CreateFamilyResponse> CreateAsync(Guid userId, CreateFamilyRequest request, DateTimeOffset now, CancellationToken ct = default);
    Task UpdateNameAsync(Guid familyId, Guid userId, UpdateFamilyNameRequest request, CancellationToken ct = default);
    Task<ExitFamilyResponse> ExitAsync(Guid familyId, Guid userId, CancellationToken ct = default);
    Task DissolveAsync(Guid familyId, Guid userId, DissolveFamilyRequest request, DateTimeOffset now, CancellationToken ct = default);
    Task<RestoreFamilyResponse> RestoreAsync(Guid familyId, Guid userId, DateTimeOffset now, CancellationToken ct = default);
    Task<GetMembersResponse> GetMembersAsync(Guid familyId, Guid userId, CancellationToken ct = default);
    Task RemoveMemberAsync(Guid familyId, Guid userId, Guid targetMemberId, CancellationToken ct = default);
    Task TransferCreatorAsync(Guid familyId, Guid userId, Guid newCreatorMemberId, CancellationToken ct = default);
    Task SetMemberDisplayModeAsync(Guid familyId, Guid userId, Guid targetMemberId, SetDisplayModeRequest request, CancellationToken ct = default);
    Task<GetMyFamiliesResponse> GetMyFamiliesAsync(Guid userId, CancellationToken ct = default);
}

public class FamilyLifecycleService : IFamilyLifecycleService
{
    /// <summary>家庭人数上限（产品硬约束 10）。</summary>
    public const int MaxMemberCount = 10;

    /// <summary>解散后保留可恢复的天数。</summary>
    public static readonly TimeSpan DissolveRetention = TimeSpan.FromDays(30);

    private readonly AppDbContext _db;

    public FamilyLifecycleService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<CreateFamilyResponse> CreateAsync(
        Guid userId, CreateFamilyRequest request, DateTimeOffset now, CancellationToken ct = default)
    {
        var family = new DomainFamily
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            CreatedAt = now,
            CreatorId = userId,
            Status = FamilyStatus.Normal
        };
        _db.Families.Add(family);

        var member = new DomainFamilyMember
        {
            Id = Guid.NewGuid(),
            FamilyId = family.Id,
            UserId = userId,
            Role = request.Role,
            DisplayMode = DisplayMode.Primary,
            JoinedAt = now
        };
        _db.FamilyMembers.Add(member);

        await _db.SaveChangesAsync(ct);
        return new CreateFamilyResponse { FamilyId = family.Id };
    }

    public async Task UpdateNameAsync(Guid familyId, Guid userId, UpdateFamilyNameRequest request, CancellationToken ct = default)
    {
        var family = await LoadFamilyAsync(familyId, ct);
        var member = await RequireMemberAsync(familyId, userId, ct);

        if (member.Role != UserRole.Parent)
            throw new DomainException(ErrorCodes.PermissionDenied);

        family.Name = request.Name;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<ExitFamilyResponse> ExitAsync(Guid familyId, Guid userId, CancellationToken ct = default)
    {
        var family = await LoadFamilyAsync(familyId, ct);
        var member = await RequireMemberAsync(familyId, userId, ct);

        if (family.CreatorId == userId)
            throw new DomainException(ErrorCodes.FamilyCreatorCannotExit);

        // 规则：仅当家庭还有未注销家长时禁止最后一个家长退出。
        // 但当前用户不是创建者，已在上面拦截。
        // 因此这里只需确保「最后家长」检查：用户是家长，且家庭除自己外没有其他家长，且还有未注销孩子。
        if (member.Role == UserRole.Parent)
        {
            var otherActiveParents = await _db.FamilyMembers
                .Where(m => m.FamilyId == familyId
                    && m.Role == UserRole.Parent
                    && m.IsDeleted == false
                    && m.UserId != userId)
                .CountAsync(ct);
            if (otherActiveParents == 0)
            {
                var activeChildren = await _db.FamilyMembers
                    .Where(m => m.FamilyId == familyId && m.Role == UserRole.Child && m.IsDeleted == false)
                    .CountAsync(ct);
                if (activeChildren > 0)
                    throw new DomainException(ErrorCodes.LastParentCannotExit);
            }
        }

        _db.FamilyMembers.Remove(member);
        await _db.SaveChangesAsync(ct);

        var hasOtherFamilies = await _db.FamilyMembers
            .AnyAsync(m => m.UserId == userId && m.IsDeleted == false, ct);
        return new ExitFamilyResponse { Exited = true, HasOtherFamilies = hasOtherFamilies };
    }

    public async Task DissolveAsync(
        Guid familyId, Guid userId, DissolveFamilyRequest request, DateTimeOffset now, CancellationToken ct = default)
    {
        var family = await LoadFamilyAsync(familyId, ct);
        var member = await RequireMemberAsync(familyId, userId, ct);

        if (family.Status == FamilyStatus.Dissolved)
            throw new DomainException(ErrorCodes.FamilyAlreadyDissolved);

        var activeMembers = await _db.FamilyMembers
            .Where(m => m.FamilyId == familyId && m.IsDeleted == false)
            .CountAsync(ct);
        var isLastMember = activeMembers == 1;

        // 规则：仅创建者或最后一人（任意角色）可解散。
        if (family.CreatorId != userId && !isLastMember)
            throw new DomainException(ErrorCodes.PermissionDenied);

        if (family.Name != request.FamilyName)
            throw new DomainException(ErrorCodes.FamilyNameMismatch);

        family.Status = FamilyStatus.Dissolved;
        family.DissolvedAt = now;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<RestoreFamilyResponse> RestoreAsync(Guid familyId, Guid userId, DateTimeOffset now, CancellationToken ct = default)
    {
        var family = await LoadFamilyAsync(familyId, ct);
        // 任何原成员（含已注销）可恢复。先看用户当前是否成员。
        var isCurrentMember = await _db.FamilyMembers
            .AnyAsync(m => m.FamilyId == familyId && m.UserId == userId && m.IsDeleted == false, ct);
        if (!isCurrentMember)
            throw new DomainException(ErrorCodes.NotFamilyMember);

        if (family.Status != FamilyStatus.Dissolved)
            throw new DomainException(ErrorCodes.FamilyNotDissolved);

        var dissolvedAt = family.DissolvedAt ?? now;
        if (now - dissolvedAt > DissolveRetention)
            throw new DomainException(ErrorCodes.DissolvedExpired);

        family.Status = FamilyStatus.Normal;
        family.DissolvedAt = null;
        await _db.SaveChangesAsync(ct);
        return new RestoreFamilyResponse { Restored = true };
    }

    public async Task<GetMembersResponse> GetMembersAsync(Guid familyId, Guid userId, CancellationToken ct = default)
    {
        var family = await LoadFamilyAsync(familyId, ct);
        await RequireMemberAsync(familyId, userId, ct);

        var members = await _db.FamilyMembers
            .Include(m => m.User)
            .Where(m => m.FamilyId == familyId)
            .ToListAsync(ct);

        var parents = members
            .Where(m => m.Role == UserRole.Parent)
            .OrderBy(m => m.JoinedAt)
            .Select(m => ToMemberInfo(m, family.CreatorId))
            .ToList();
        var children = members
            .Where(m => m.Role == UserRole.Child)
            .OrderBy(m => m.JoinedAt)
            .Select(m => ToMemberInfo(m, family.CreatorId))
            .ToList();

        var active = members.Count(m => !m.IsDeleted);

        return new GetMembersResponse
        {
            FamilyName = family.Name,
            CreatorId = family.CreatorId,
            Parents = parents,
            Children = children,
            ActiveMemberCount = active,
            MaxMemberCount = MaxMemberCount
        };
    }

    public async Task RemoveMemberAsync(Guid familyId, Guid userId, Guid targetMemberId, CancellationToken ct = default)
    {
        var family = await LoadFamilyAsync(familyId, ct);
        var operatorMember = await RequireMemberAsync(familyId, userId, ct);
        if (operatorMember.Role != UserRole.Parent)
            throw new DomainException(ErrorCodes.PermissionDenied);

        var target = await _db.FamilyMembers
            .FirstOrDefaultAsync(m => m.Id == targetMemberId && m.FamilyId == familyId, ct)
            ?? throw new DomainException(ErrorCodes.MemberNotFound);

        if (target.UserId == userId)
            throw new DomainException(ErrorCodes.CannotRemoveSelf);

        _db.FamilyMembers.Remove(target);
        await _db.SaveChangesAsync(ct);
    }

    public async Task TransferCreatorAsync(Guid familyId, Guid userId, Guid newCreatorMemberId, CancellationToken ct = default)
    {
        if (newCreatorMemberId == Guid.Empty)
            throw new DomainException(ErrorCodes.MemberNotFound);

        var family = await LoadFamilyAsync(familyId, ct);
        var operatorMember = await RequireMemberAsync(familyId, userId, ct);
        if (operatorMember.Role != UserRole.Parent || family.CreatorId != userId)
            throw new DomainException(ErrorCodes.PermissionDenied);

        var target = await _db.FamilyMembers
            .FirstOrDefaultAsync(m => m.Id == newCreatorMemberId && m.FamilyId == familyId, ct)
            ?? throw new DomainException(ErrorCodes.MemberNotFound);

        if (target.Role != UserRole.Parent)
            throw new DomainException(ErrorCodes.InvalidTransferTarget);

        family.CreatorId = target.UserId;
        await _db.SaveChangesAsync(ct);
    }

    public async Task SetMemberDisplayModeAsync(
        Guid familyId, Guid userId, Guid targetMemberId, SetDisplayModeRequest request, CancellationToken ct = default)
    {
        var family = await LoadFamilyAsync(familyId, ct);
        var operatorMember = await RequireMemberAsync(familyId, userId, ct);
        if (operatorMember.Role != UserRole.Parent)
            throw new DomainException(ErrorCodes.PermissionDenied);

        var target = await _db.FamilyMembers
            .FirstOrDefaultAsync(m => m.Id == targetMemberId && m.FamilyId == familyId, ct)
            ?? throw new DomainException(ErrorCodes.MemberNotFound);

        if (target.Role != UserRole.Child)
            throw new DomainException(ErrorCodes.PermissionDenied);

        target.DisplayMode = request.DisplayMode;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<GetMyFamiliesResponse> GetMyFamiliesAsync(Guid userId, CancellationToken ct = default)
    {
        // 一次性取出用户当前所有未解散家庭的成员关系（带已注销过滤）。
        var memberships = await _db.FamilyMembers.AsNoTracking()
            .Where(m => m.UserId == userId && m.IsDeleted == false)
            .Join(_db.Families.AsNoTracking().Where(f => f.Status == FamilyStatus.Normal),
                m => m.FamilyId, f => f.Id, (m, f) => new { m, f })
            .OrderBy(x => x.m.JoinedAt)
            .ToListAsync(ct);

        if (memberships.Count == 0)
            return new GetMyFamiliesResponse { Families = new List<FamilyInfo>() };

        // 单次 GroupBy 取每个家庭活跃成员数，避免 N+1。
        var familyIds = memberships.Select(x => x.f.Id).Distinct().ToList();
        var memberCounts = await _db.FamilyMembers.AsNoTracking()
            .Where(m => familyIds.Contains(m.FamilyId) && m.IsDeleted == false)
            .GroupBy(m => m.FamilyId)
            .Select(g => new { FamilyId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.FamilyId, x => x.Count, ct);

        var items = memberships.Select(row => new FamilyInfo
        {
            FamilyId = row.f.Id,
            FamilyName = row.f.Name,
            Role = row.m.Role,
            MemberCount = memberCounts.TryGetValue(row.f.Id, out var c) ? c : 0,
            LastActiveAt = row.f.CreatedAt
        }).ToList();

        return new GetMyFamiliesResponse { Families = items };
    }

    private async Task<DomainFamily> LoadFamilyAsync(Guid familyId, CancellationToken ct)
        => await _db.Families.FirstOrDefaultAsync(f => f.Id == familyId, ct)
            ?? throw new DomainException(ErrorCodes.FamilyNotFound);

    private async Task<DomainFamilyMember> RequireMemberAsync(Guid familyId, Guid userId, CancellationToken ct)
        => await _db.FamilyMembers
            .FirstOrDefaultAsync(m => m.FamilyId == familyId && m.UserId == userId && m.IsDeleted == false, ct)
            ?? throw new DomainException(ErrorCodes.NotFamilyMember);

    private static FamilyMemberInfo ToMemberInfo(DomainFamilyMember m, Guid familyCreatorId) => new()
    {
        MemberId = m.Id,
        UserId = m.UserId,
        Role = m.Role,
        ChildName = m.ChildName,
        DisplayMode = m.DisplayMode,
        IsDeleted = m.IsDeleted,
        JoinedAt = m.JoinedAt,
        AvatarUrl = m.User?.AvatarUrl,
        Nickname = m.ChildName ?? m.User?.Nickname ?? string.Empty,
        IsCreator = m.UserId == familyCreatorId
    };
}
