using System.Security.Claims;
using Agenda.Api.Infrastructure.Auth;
using Microsoft.Extensions.Options;
using Xunit;

namespace Agenda.Api.Infrastructure.Auth.Tests;

public class JwtServiceTests
{
    private const string SecretKey = "test-secret-key-that-is-at-least-thirty-two-bytes-long!!";
    private const string LegacyKey = "legacy-secret-key-also-at-least-thirty-two-bytes!!";

    private static JwtService CreateService(string? secret = null, string[]? legacy = null) =>
        new(Options.Create(new JwtOptions
        {
            SecretKey = secret ?? SecretKey,
            Issuer = "agenda-api",
            LegacySecretKeys = legacy ?? []
        }));

    [Fact]
    public void GenerateToken_ThenValidate_ReturnsPrincipalWithUserId()
    {
        var service = CreateService();
        var userId = Guid.NewGuid();

        var token = service.GenerateToken(userId);
        var principal = service.ValidateToken(token);

        Assert.NotNull(principal);
        Assert.Equal(userId.ToString(), principal!.FindFirst("userId")?.Value);
    }

    [Fact]
    public void ValidateToken_Expired_ReturnsNull()
    {
        var service = CreateService();

        var token = service.GenerateToken(Guid.NewGuid(), TimeSpan.FromSeconds(-60));

        Assert.Null(service.ValidateToken(token));
    }

    [Fact]
    public void ValidateToken_Tampered_ReturnsNull()
    {
        var service = CreateService();
        var token = service.GenerateToken(Guid.NewGuid());

        var tampered = token[..^2] + (token[^1] == 'a' ? 'b' : 'a');

        Assert.Null(service.ValidateToken(tampered));
    }

    [Fact]
    public void ValidateToken_ExpiredWithinClockSkew_ReturnsPrincipal()
    {
        var service = CreateService();

        var token = service.GenerateToken(Guid.NewGuid(), TimeSpan.FromSeconds(-20));

        Assert.NotNull(service.ValidateToken(token));
    }

    [Fact]
    public void ValidateToken_ExpiresWithinFiveMinutes_ReturnsNull()
    {
        var service = CreateService();

        var token = service.GenerateToken(Guid.NewGuid(), TimeSpan.FromMinutes(3));

        Assert.Null(service.ValidateToken(token));
    }

    [Fact]
    public void ValidateToken_SignedWithLegacyKey_ReturnsPrincipal()
    {
        var legacyService = CreateService(secret: LegacyKey);
        var userId = Guid.NewGuid();
        var token = legacyService.GenerateToken(userId);

        var currentService = CreateService(secret: SecretKey, legacy: [LegacyKey]);

        Assert.NotNull(currentService.ValidateToken(token));
    }

    [Fact]
    public void GetUserIdFromExpiredToken_ReturnsUserId()
    {
        var service = CreateService();
        var userId = Guid.NewGuid();
        var token = service.GenerateToken(userId, TimeSpan.FromSeconds(-60));

        var result = service.GetUserIdFromExpiredToken(token);

        Assert.Equal(userId, result);
    }
}
