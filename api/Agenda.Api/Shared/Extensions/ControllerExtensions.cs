using System.Security.Claims;
using Microsoft.AspNetCore.Http;

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

    /// <summary>
    /// 解析 X-Family-Id 请求头。未携带或解析失败返回 null（由调用方决定是否必填）。
    /// </summary>
    public static Guid? GetFamilyIdFromHeader(this HttpRequest request)
    {
        if (!request.Headers.TryGetValue("X-Family-Id", out var values)) return null;
        var raw = values.ToString();
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
