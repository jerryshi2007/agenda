namespace Agenda.Api.Infrastructure.Auth;

public record WeChatSession(string OpenId, string SessionKey, string? UnionId);
