using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Family.Dtos;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Family.Services;

/// <summary>
/// 实现 Auth -> Family 跨上下文契约（IFamilyQueryService.GetUserFamiliesAsync）。
/// 返回 Family.Dtos.FamilyInfo（统一 DTO，含 UserRole 枚举 + LastActiveAt），
/// 与 /api/v1/families/me 共用同一序列化形态。
/// </summary>
public class FamilyQueryServiceAdapter : Agenda.Api.Auth.IFamilyQueryService
{
    private readonly AppDbContext _db;

    public FamilyQueryServiceAdapter(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<FamilyInfo>> GetUserFamiliesAsync(Guid userId, CancellationToken ct = default)
    {
        // 单次查询取成员关系 + 家庭（仅 Normal 状态），并按家庭分组计算成员数。
        var memberships = await _db.FamilyMembers.AsNoTracking()
            .Where(m => m.UserId == userId && m.IsDeleted == false)
            .Join(_db.Families.AsNoTracking().Where(f => f.Status == FamilyStatus.Normal),
                m => m.FamilyId, f => f.Id, (m, f) => new { m, f })
            .OrderBy(x => x.m.JoinedAt)
            .ToListAsync(ct);

        if (memberships.Count == 0) return new List<FamilyInfo>();

        var familyIds = memberships.Select(x => x.f.Id).Distinct().ToList();
        var memberCounts = await _db.FamilyMembers.AsNoTracking()
            .Where(m => familyIds.Contains(m.FamilyId) && m.IsDeleted == false)
            .GroupBy(m => m.FamilyId)
            .Select(g => new { FamilyId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.FamilyId, x => x.Count, ct);

        return memberships.Select(row => new FamilyInfo
        {
            FamilyId = row.f.Id,
            FamilyName = row.f.Name,
            Role = row.m.Role,
            MemberCount = memberCounts.TryGetValue(row.f.Id, out var c) ? c : 0,
            LastActiveAt = row.f.CreatedAt
        }).ToList();
    }
}
