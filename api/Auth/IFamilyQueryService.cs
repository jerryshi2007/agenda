using Agenda.Api.Family.Dtos;

namespace Agenda.Api.Auth;

/// <summary>
/// Auth -> Family 跨上下文契约。由 Family 模块提供真实实现。
/// 返回统一的 Family.Dtos.FamilyInfo（含 UserRole 枚举 + LastActiveAt），
/// 与 /api/v1/families/me 共用同一序列化形态。
/// </summary>
public interface IFamilyQueryService
{
    Task<List<FamilyInfo>> GetUserFamiliesAsync(Guid userId, CancellationToken ct = default);
}
