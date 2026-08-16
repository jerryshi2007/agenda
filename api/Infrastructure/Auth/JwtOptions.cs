namespace Agenda.Api.Infrastructure.Auth;

public class JwtOptions
{
    public string SecretKey { get; set; } = string.Empty;
    public string Issuer { get; set; } = "agenda-api";
    public string Audience { get; set; } = "agenda-app";
    public string[] LegacySecretKeys { get; set; } = [];
    public TimeSpan PreExpiryWindow { get; set; } = TimeSpan.FromMinutes(5);
}
