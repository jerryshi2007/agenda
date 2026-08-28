using Agenda.Api.Template.Dtos;
using Agenda.Api.Template.Services;
using Agenda.Api.Template.Validators;
using FluentValidation;

namespace Agenda.Api.Shared.Extensions;

public static class TemplateServiceCollectionExtensions
{
    public static IServiceCollection AddTemplateModule(this IServiceCollection services)
    {
        services.AddScoped<ITemplateService, TemplateService>();

        services.AddScoped<IValidator<CreateTemplateRequest>, CreateTemplateRequestValidator>();
        services.AddScoped<IValidator<UpdateTemplateRequest>, UpdateTemplateRequestValidator>();
        services.AddScoped<IValidator<ApplyTemplateRequest>, ApplyTemplateRequestValidator>();

        // Preset template seed — runs at app start, idempotent.
        services.AddHostedService<TemplateSeedHostedService>();

        return services;
    }
}
