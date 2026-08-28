namespace Agenda.Api.Infrastructure.Storage;

public interface IAvatarStorageService
{
    Task<string> UploadAsync(Guid userId, IFormFile file, CancellationToken ct = default);
    Task DeleteAsync(Guid userId, CancellationToken ct = default);
}
