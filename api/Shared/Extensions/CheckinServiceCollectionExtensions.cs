using Agenda.Api.Checkin;
using Agenda.Api.Checkin.Dtos;
using Agenda.Api.Checkin.Validators;
using FluentValidation;

namespace Agenda.Api.Shared.Extensions;

public static class CheckinServiceCollectionExtensions
{
    public static IServiceCollection AddCheckinModule(this IServiceCollection services)
    {
        services.AddScoped<ICheckinService, CheckinService>();
        services.AddScoped<IValidator<CheckinRequest>, CheckinRequestValidator>();

        // IScheduleQueryService -> ScheduleQueryService 已在 AddScheduleModule 注册（ADR-017 依赖反转），
        // 此处无需重复注册。

        return services;
    }
}
