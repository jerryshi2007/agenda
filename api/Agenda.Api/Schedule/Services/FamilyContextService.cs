using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Schedule.Services;

/// <summary>
/// Family context service — encapsulates family membership lookup.
/// Controllers depend on this instead of AppDbContext directly.
/// </summary>
public interface IFamilyContextService
{
    Task<(Guid FamilyId, UserRole Role)> GetFamilyContextAsync(Guid userId, Guid? familyId, CancellationToken ct = default);
}

public class FamilyContextService : IFamilyContextService
{
    private readonly AppDbContext _db;

    public FamilyContextService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(Guid FamilyId, UserRole Role)> GetFamilyContextAsync(Guid userId, Guid? familyId, CancellationToken ct = default)
    {
        // 指定家庭：校验该用户确为该家庭的有效成员；非成员不泄露存在性 → 404 FAMILY_NOT_FOUND
        if (familyId.HasValue)
        {
            var membership = await _db.FamilyMembers
                .AsNoTracking()
                .Include(fm => fm.Family)
                .Where(fm => fm.UserId == userId && fm.FamilyId == familyId.Value && fm.User.Status == UserStatus.Active)
                .FirstOrDefaultAsync(ct);

            if (membership == null)
                throw new DomainException(ErrorCodes.FamilyNotFound);

            return (membership.FamilyId, membership.Role);
        }

        // 未指定家庭：按有效成员记录数量决定回退或拒绝
        var memberships = await _db.FamilyMembers
            .AsNoTracking()
            .Include(fm => fm.Family)
            .Where(fm => fm.UserId == userId && fm.User.Status == UserStatus.Active)
            .ToListAsync(ct);

        return memberships.Count switch
        {
            0 => throw new DomainException(ErrorCodes.NotFamilyMember),
            1 => (memberships[0].FamilyId, memberships[0].Role),
            _ => throw new DomainException(ErrorCodes.FamilyContextRequired)
        };
    }
}
