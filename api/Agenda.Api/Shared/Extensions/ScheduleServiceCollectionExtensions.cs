using Agenda.Api.Checkin.Services;
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
        services.AddScoped<IChildScheduleQueryService, ChildScheduleQueryService>();

        // Cross-module interface (ADR-017: Schedule module implements checkin module's interface)
        services.AddScoped<IScheduleQueryService, ScheduleQueryService>();

        // Child completion stats (lives in Checkin module, registered here so the controller can resolve it)
        services.AddScoped<ICompletionStatsService, CompletionStatsService>();

        return services;
    }
}
