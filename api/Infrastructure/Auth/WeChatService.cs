using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Agenda.Api.Infrastructure.Auth;

public class WeChatService : IWeChatService
{
    private static readonly Uri SessionEndpoint = new("https://api.weixin.qq.com/sns/jscode2session");

    private readonly HttpClient _httpClient;
    private readonly WeChatOptions _options;
    private readonly ILogger<WeChatService> _logger;

    public WeChatService(HttpClient httpClient, IOptions<WeChatOptions> options, ILogger<WeChatService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<WeChatSession> GetSessionAsync(string code, CancellationToken ct = default)
    {
        try
        {
            return await RequestSessionAsync(code, ct);
        }
        catch (Exception ex) when (IsTimeout(ex))
        {
            _logger.LogWarning("WeChat jscode2session timed out, retrying once");
            try
            {
                return await RequestSessionAsync(code, ct);
            }
            catch (Exception retryEx) when (IsTimeout(retryEx))
            {
                throw new WeChatTimeoutException("WeChat jscode2session timed out after retry", retryEx);
            }
        }
    }

    private async Task<WeChatSession> RequestSessionAsync(string code, CancellationToken ct)
    {
        var url = $"{SessionEndpoint}?appid={Uri.EscapeDataString(_options.AppId)}" +
                  $"&secret={Uri.EscapeDataString(_options.AppSecret)}" +
                  $"&js_code={Uri.EscapeDataString(code)}&grant_type=authorization_code";

        using var response = await _httpClient.GetAsync(url, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        var payload = JsonSerializer.Deserialize<WeChatSessionResponse>(json);
        if (payload == null)
            throw new WeChatApiException(-1, "empty response");

        if (payload.ErrCode != 0)
            throw new WeChatApiException(payload.ErrCode, payload.ErrMsg ?? string.Empty);

        // 不记录 openid 明文。
        _logger.LogInformation("WeChat session resolved successfully");
        return new WeChatSession(payload.OpenId!, payload.SessionKey!, payload.UnionId);
    }

    private static bool IsTimeout(Exception ex)
    {
        if (ex is TimeoutException)
            return true;
        if (ex is OperationCanceledException oce)
            return oce.InnerException is TimeoutException;
        return false;
    }

    private sealed class WeChatSessionResponse
    {
        [JsonPropertyName("openid")]
        public string? OpenId { get; set; }

        [JsonPropertyName("session_key")]
        public string? SessionKey { get; set; }

        [JsonPropertyName("unionid")]
        public string? UnionId { get; set; }

        [JsonPropertyName("errcode")]
        public int ErrCode { get; set; }

        [JsonPropertyName("errmsg")]
        public string? ErrMsg { get; set; }
    }
}
