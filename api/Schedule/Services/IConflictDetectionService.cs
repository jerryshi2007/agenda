using Agenda.Api.Schedule.Dtos;

namespace Agenda.Api.Schedule.Services;

public interface IConflictDetectionService
{
    Task<ScheduleConflictResponse> CheckConflictAsync(ScheduleConflictCheckRequest request, CancellationToken ct = default);
}
