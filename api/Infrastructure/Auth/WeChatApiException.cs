namespace Agenda.Api.Infrastructure.Auth;

/// <summary>
/// 微信 jscode2session 返回 errcode != 0 时抛出。
/// </summary>
public class WeChatApiException : Exception
{
    public int ErrCode { get; }

    public WeChatApiException(int errCode, string errMsg)
        : base($"WeChat API error {errCode}: {errMsg}")
    {
        ErrCode = errCode;
    }
}
