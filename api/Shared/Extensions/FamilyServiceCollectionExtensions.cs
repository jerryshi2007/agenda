using Agenda.Api.Family;
using Agenda.Api.Family.Dtos;
using Agenda.Api.Family.Services;
using Agenda.Api.Family.Validators;
using Agenda.Api.Infrastructure;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Agenda.Api.Shared.Extensions;

/// <summary>
/// Family 模块 DI 扩展：
/// - 注册 Services
/// - 注册 Validators
/// - 注册 Auth -> Family 真实实现（替换 EmptyFamilyQueryService）
/// - 兼容开发环境匿名访问 share 端点（已在 Controller 上 [AllowAnonymous]）
/// </summary>
public static class FamilyServiceCollectionExtensions
{
    public static IServiceCollection AddFamilyModule(this IServiceCollection services)
    {
        services.AddScoped<IFamilyLifecycleService, FamilyLifecycleService>();
        services.AddScoped<IInvitationCodeService, InvitationCodeService>();
        services.AddScoped<IShareService, ShareService>();

        // 替换 Auth 模块的占位 FamilyQueryService
        services.RemoveAll<Agenda.Api.Auth.IFamilyQueryService>();
        services.AddScoped<Agenda.Api.Auth.IFamilyQueryService, FamilyQueryServiceAdapter>();

        services.AddScoped<IValidator<CreateFamilyRequest>, CreateFamilyRequestValidator>();
        services.AddScoped<IValidator<UpdateFamilyNameRequest>, UpdateFamilyNameRequestValidator>();
        services.AddScoped<IValidator<GenerateInviteCodeRequest>, GenerateInviteCodeRequestValidator>();
        services.AddScoped<IValidator<JoinByCodeRequest>, JoinByCodeRequestValidator>();
        services.AddScoped<IValidator<SetDisplayModeRequest>, SetDisplayModeRequestValidator>();
        services.AddScoped<IValidator<DissolveFamilyRequest>, DissolveFamilyRequestValidator>();

        return services;
    }
}
