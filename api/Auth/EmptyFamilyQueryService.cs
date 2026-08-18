using Agenda.Api.Family.Dtos;

namespace Agenda.Api.Auth;

/// <summary>
/// Family 模块尚未实现前的空实现，始终返回空列表。
/// </summary>
public class EmptyFamilyQueryService : IFamilyQueryService
{
    public Task<List<FamilyInfo>> GetUserFamiliesAsync(Guid userId, CancellationToken ct = default)
        => Task.FromResult(new List<FamilyInfo>());
}
