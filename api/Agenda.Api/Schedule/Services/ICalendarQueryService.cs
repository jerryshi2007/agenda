using Agenda.Api.Schedule.Dtos;

namespace Agenda.Api.Schedule.Services;

public interface ICalendarQueryService
{
    Task<CalendarResponse> QueryAsync(CalendarQueryRequest request, Guid familyId, CancellationToken ct = default);
}
