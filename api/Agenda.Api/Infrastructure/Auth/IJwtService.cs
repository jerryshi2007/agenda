using System.Security.Claims;

namespace Agenda.Api.Infrastructure.Auth;

public interface IJwtService
{
    string GenerateToken(Guid userId, TimeSpan? lifetime = null);

    /// <summary>
    /// 生成包含额外 displayMode claim 的 JWT（仅当 displayMode 不为 null 时追加）。
    /// 供 TokenService 调用：家长不传、孩子传当前 DisplayMode。
    /// </summary>
    string GenerateToken(Guid userId, string? displayMode, TimeSpan? lifetime = null);

    ClaimsPrincipal? ValidateToken(string token);
    Guid? GetUserIdFromExpiredToken(string token);
}
