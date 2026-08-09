using Agenda.Api.Domain.Interfaces;
using Agenda.Api.Schedule.Services;

namespace Agenda.Api.Shared.Extensions;

public static class ScheduleServiceCollectionExtensions
{
    public static IServiceCollection AddScheduleModule(this IServiceCollection services)
    {
        // Family context
        services.AddScoped<IFamilyContextService, FamilyContextService>();

        // Schedule module services
        services.AddScoped<IScheduleService, ScheduleService>();
        services.AddScoped<IConflictDetectionService, ConflictDetectionService>();
        services.AddScoped<ICalendarQueryService, CalendarQueryService>();

        // Cross-module interface (ADR-017: Schedule module implements checkin module's interface)
        services.AddScoped<IScheduleQueryService, ScheduleQueryService>();

        return services;
    }
}
