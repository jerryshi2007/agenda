namespace Agenda.Api.Infrastructure.Auth;

/// <summary>
/// 微信 jscode2session 超时（含一次重试后仍超时）时抛出。
/// 与通用 TimeoutException 区分，避免数据库/IO 超时被误映射为微信错误码。
/// </summary>
public class WeChatTimeoutException : Exception
{
    public WeChatTimeoutException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
