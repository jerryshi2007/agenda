using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Agenda.Api.Infrastructure.Auth;

public class JwtService : IJwtService
{
    private static readonly TimeSpan DefaultLifetime = TimeSpan.FromDays(7);
    private static readonly TimeSpan ClockSkew = TimeSpan.FromSeconds(30);

    private readonly JwtOptions _options;
    private readonly JwtSecurityTokenHandler _handler = new();

    public JwtService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    public string GenerateToken(Guid userId, TimeSpan? lifetime = null)
    {
        return GenerateToken(userId, displayMode: null, lifetime);
    }

    public string GenerateToken(Guid userId, string? displayMode, TimeSpan? lifetime = null)
    {
        var now = DateTimeOffset.UtcNow;
        var lifetimeValue = lifetime ?? DefaultLifetime;
        var expires = now.Add(lifetimeValue);

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SecretKey)),
            SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new("userId", userId.ToString())
        };

        // 仅当 displayMode 非空时追加 claim（家长 token 不含此 claim）。
        if (!string.IsNullOrEmpty(displayMode))
            claims.Add(new Claim("displayMode", displayMode));

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            claims: claims,
            notBefore: lifetimeValue < TimeSpan.Zero ? null : now.UtcDateTime,
            expires: expires.UtcDateTime,
            signingCredentials: credentials);

        return _handler.WriteToken(token);
    }

    public ClaimsPrincipal? ValidateToken(string token)
    {
        foreach (var key in EnumerateKeys())
        {
            var parameters = BuildValidationParameters(key);
            try
            {
                var principal = _handler.ValidateToken(token, parameters, out var validatedToken);
                // 尚未过期但剩余有效期不足 5 分钟时视为过期，触发客户端提前续期。
                // 已过期但在 ClockSkew 容忍范围内的 token 不受此规则影响。
                var remaining = validatedToken.ValidTo - DateTimeOffset.UtcNow;
                if (remaining >= TimeSpan.Zero && remaining < _options.PreExpiryWindow)
                    return null;
                return principal;
            }
            catch (SecurityTokenException)
            {
                // 尝试下一个密钥（旧密钥宽限）。
            }
            catch (ArgumentException)
            {
                return null;
            }
        }

        return null;
    }

    public Guid? GetUserIdFromExpiredToken(string token)
    {
        var parameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SecretKey)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = false,
            ClockSkew = ClockSkew
        };

        try
        {
            var principal = _handler.ValidateToken(token, parameters, out _);
            var claim = principal.FindFirst("userId") ?? principal.FindFirst(ClaimTypes.NameIdentifier);
            return claim != null && Guid.TryParse(claim.Value, out var id) ? id : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private IEnumerable<SecurityKey> EnumerateKeys()
    {
        yield return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SecretKey));
        foreach (var legacy in _options.LegacySecretKeys)
        {
            if (!string.IsNullOrEmpty(legacy))
                yield return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(legacy));
        }
    }

    private TokenValidationParameters BuildValidationParameters(SecurityKey key) => new()
    {
        ValidateIssuer = true,
        ValidIssuer = _options.Issuer,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = key,
        ClockSkew = ClockSkew,
        NameClaimType = "userId",
        RoleClaimType = ClaimTypes.Role
    };
}
