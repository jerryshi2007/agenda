using Agenda.Api.Auth.Dtos;

namespace Agenda.Api.Auth;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(string code, CancellationToken ct = default);
    Task<RefreshResponse> RefreshAsync(string code, CancellationToken ct = default);
    Task<ProfileResponse> GetProfileAsync(Guid userId, CancellationToken ct = default);
    Task<ProfileResponse> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default);
    Task<DeletionStatusResponse> GetDeletionStatusAsync(Guid userId, CancellationToken ct = default);
    Task<DeletionResponse> DeleteAccountAsync(Guid userId, CancellationToken ct = default);
    Task<RecoverResponse> RecoverAccountAsync(Guid userId, CancellationToken ct = default);
}
