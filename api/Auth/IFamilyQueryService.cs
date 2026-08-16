using Agenda.Api.Auth.Dtos;

namespace Agenda.Api.Auth;

/// <summary>
/// Auth -> Family 跨上下文契约。由 Family 模块提供真实实现。
/// </summary>
public interface IFamilyQueryService
{
    Task<List<FamilyInfo>> GetUserFamiliesAsync(Guid userId, CancellationToken ct = default);
}
