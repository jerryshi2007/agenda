using System.Security.Claims;
using Agenda.Api.Domain.Entities;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Shared.Extensions;

/// <summary>
/// Controller 扩展方法：从 HttpContext 中获取当前用户信息。
/// </summary>
public static class ControllerExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal user)
    {
        var claim = user.FindFirst(ClaimTypes.NameIdentifier)
                    ?? user.FindFirst("sub")
                    ?? user.FindFirst("userId");
        if (claim == null || !Guid.TryParse(claim.Value, out var userId))
            throw new UnauthorizedAccessException("无法从 JWT 中解析 userId");
        return userId;
    }

    public static async Task<(Guid FamilyId, Domain.Enums.UserRole Role)> GetFamilyContextAsync(
        this ClaimsPrincipal user, AppDbContext db, CancellationToken ct)
    {
        var userId = user.GetUserId();
        var membership = await db.FamilyMembers
            .AsNoTracking()
            .Include(fm => fm.Family)
            .FirstOrDefaultAsync(fm => fm.UserId == userId, ct);

        if (membership == null)
            throw new UnauthorizedAccessException("NOT_FAMILY_MEMBER");

        return (membership.FamilyId, membership.Role);
    }
}
