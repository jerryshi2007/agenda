using Agenda.Api.Auth;
using Agenda.Api.Auth.Dtos;
using Agenda.Api.Auth.Validators;
using Agenda.Api.Infrastructure.Auth;
using Agenda.Api.Infrastructure.Services;
using Agenda.Api.Infrastructure.Storage;
using FluentValidation;

namespace Agenda.Api.Shared.Extensions;

public static class AuthServiceCollectionExtensions
{
    public static IServiceCollection AddAuthModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<WeChatOptions>(configuration.GetSection("WeChat"));
        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));
        services.Configure<StorageOptions>(configuration.GetSection("Storage"));

        // 生产密钥通过环境变量 JWT_SECRET_KEY 注入，覆盖 appsettings 中的配置。
        // 通过 PostConfigure 确保 JwtService（IOptions<JwtOptions>）与 Program.cs 中
        // JwtBearer 的签名密钥使用同一份已解析密钥。
        var envSecretKey = configuration["JWT_SECRET_KEY"];
        if (!string.IsNullOrEmpty(envSecretKey))
            services.PostConfigure<JwtOptions>(options => options.SecretKey = envSecretKey);

        services.AddHttpClient<IWeChatService, WeChatService>(client =>
            client.Timeout = TimeSpan.FromSeconds(5));
        services.AddSingleton<IJwtService, JwtService>();

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IFamilyQueryService, EmptyFamilyQueryService>();
        services.AddSingleton<ISensitiveWordFilter, SensitiveWordFilter>();

        services.AddScoped<IValidator<LoginRequest>, LoginRequestValidator>();
        services.AddScoped<IValidator<UpdateProfileRequest>, UpdateProfileRequestValidator>();

        services.AddScoped<IAvatarStorageService, AvatarStorageService>();

        services.AddScoped<IAnonymizationService, AnonymizationService>();
        services.AddSingleton<DeletionCleanupService>();
        services.AddSingleton<IDeletionCleanupService>(sp => sp.GetRequiredService<DeletionCleanupService>());
        services.AddHostedService(sp => sp.GetRequiredService<DeletionCleanupService>());

        return services;
    }
}
