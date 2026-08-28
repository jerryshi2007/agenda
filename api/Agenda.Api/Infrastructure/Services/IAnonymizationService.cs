namespace Agenda.Api.Infrastructure.Services;

public interface IAnonymizationService
{
    Task AnonymizeCheckinRecordsAsync(Guid userId, CancellationToken ct = default);
}
