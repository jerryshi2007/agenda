namespace Agenda.Api.Infrastructure.Auth;

public interface IWeChatService
{
    Task<WeChatSession> GetSessionAsync(string code, CancellationToken ct = default);
}
