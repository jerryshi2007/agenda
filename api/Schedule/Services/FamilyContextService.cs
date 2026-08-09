using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Schedule.Services;

/// <summary>
/// Family context service — encapsulates family membership lookup.
/// Controllers depend on this instead of AppDbContext directly.
/// </summary>
public interface IFamilyContextService
{
    Task<(Guid FamilyId, UserRole Role)> GetFamilyContextAsync(Guid userId, CancellationToken ct = default);
}

public class FamilyContextService : IFamilyContextService
{
    private readonly AppDbContext _db;

    public FamilyContextService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(Guid FamilyId, UserRole Role)> GetFamilyContextAsync(Guid userId, CancellationToken ct = default)
    {
        var membership = await _db.FamilyMembers
            .AsNoTracking()
            .Include(fm => fm.Family)
            .Where(fm => fm.UserId == userId && !fm.User.IsDeleted)
            .FirstOrDefaultAsync(ct);

        if (membership == null)
            throw new UnauthorizedAccessException("NOT_FAMILY_MEMBER");

        return (membership.FamilyId, membership.Role);
    }
}
