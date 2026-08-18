using Agenda.Api.Infrastructure.Auth;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Auth.Services;

/// <summary>
/// 业务侧 token 生成服务。封装"按用户角色加载额外 claim"逻辑：
/// - 孩子用户 + 有有效 FamilyMember 记录 → 加载 displayMode claim
/// - 家长用户 / 无 FamilyMember / 已注销的 FamilyMember → 不加载 displayMode claim
/// </summary>
public interface ITokenService
{
    /// <summary>生成当前用户的 JWT 字符串（已按角色注入额外 claim）。</summary>
    Task<string> GenerateTokenAsync(Guid userId, CancellationToken ct = default);
}

public class TokenService : ITokenService
{
    private readonly AppDbContext _db;
    private readonly IJwtService _jwtService;

    public TokenService(AppDbContext db, IJwtService jwtService)
    {
        _db = db;
        _jwtService = jwtService;
    }

    public async Task<string> GenerateTokenAsync(Guid userId, CancellationToken ct = default)
    {
        // 查找用户的 FamilyMember 记录（仅当未注销）
        var membership = await _db.FamilyMembers
            .AsNoTracking()
            .Where(fm => fm.UserId == userId && !fm.IsDeleted)
            .Select(fm => new { fm.Role, fm.DisplayMode })
            .FirstOrDefaultAsync(ct);

        // 孩子 + 有有效 FamilyMember → 注入 displayMode claim；其他情况不注入。
        string? displayMode = null;
        if (membership != null && membership.Role == Domain.Enums.UserRole.Child)
            displayMode = membership.DisplayMode.ToString();

        return _jwtService.GenerateToken(userId, displayMode);
    }
}
