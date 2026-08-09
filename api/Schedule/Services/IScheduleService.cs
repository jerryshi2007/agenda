using Agenda.Api.Schedule.Dtos;

namespace Agenda.Api.Schedule.Services;

public interface IScheduleService
{
    Task<CreateScheduleResponse> CreateAsync(Guid familyId, Guid createdBy, CreateScheduleRequest request, CancellationToken ct = default);
    Task<ScheduleResponse?> GetByIdAsync(Guid scheduleId, DateOnly? date, Guid userId, Guid familyId, Domain.Enums.UserRole role, CancellationToken ct = default);
    Task<UpdateScheduleResponse> UpdateAsync(Guid scheduleId, UpdateScheduleRequest request, Guid userId, Guid familyId, CancellationToken ct = default);
    Task<DeleteScheduleResponse> DeleteAsync(Guid scheduleId, string scope, DateOnly? date, Guid userId, Guid familyId, bool force = false, CancellationToken ct = default);
    Task<CancelScheduleInstanceResponse> CancelInstanceAsync(Guid scheduleId, DateOnly date, Guid cancelledBy, Guid familyId, CancellationToken ct = default);
    Task<RestoreScheduleInstanceResponse> RestoreInstanceAsync(Guid scheduleId, DateOnly date, Guid userId, Guid familyId, CancellationToken ct = default);
}
