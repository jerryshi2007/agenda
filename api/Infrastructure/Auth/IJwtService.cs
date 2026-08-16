using System.Security.Claims;

namespace Agenda.Api.Infrastructure.Auth;

public interface IJwtService
{
    string GenerateToken(Guid userId, TimeSpan? lifetime = null);
    ClaimsPrincipal? ValidateToken(string token);
    Guid? GetUserIdFromExpiredToken(string token);
}
