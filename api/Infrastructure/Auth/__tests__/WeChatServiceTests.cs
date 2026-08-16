using System.Net;
using System.Text;
using Agenda.Api.Infrastructure.Auth;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Agenda.Api.Infrastructure.Auth.Tests;

public class WeChatServiceTests
{
    private static WeChatService CreateService(HttpMessageHandler handler)
    {
        var options = Options.Create(new WeChatOptions { AppId = "test-appid", AppSecret = "test-secret" });
        return new WeChatService(new HttpClient(handler), options, NullLogger<WeChatService>.Instance);
    }

    private static HttpResponseMessage JsonResponse(string json) =>
        new(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static StubHandler Stub(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler) => new(handler);

    [Fact]
    public async Task GetSessionAsync_ErrcodeZero_ReturnsSession()
    {
        var handler = Stub(_ => Task.FromResult(JsonResponse(
            """{"openid":"openid-abc","session_key":"session-key","unionid":"union-abc","errcode":0}""")));

        var session = await CreateService(handler).GetSessionAsync("code");

        Assert.Equal("openid-abc", session.OpenId);
        Assert.Equal("session-key", session.SessionKey);
        Assert.Equal("union-abc", session.UnionId);
    }

    [Fact]
    public async Task GetSessionAsync_ErrcodeNonZero_ThrowsWeChatApiException()
    {
        var handler = Stub(_ => Task.FromResult(JsonResponse(
            """{"errcode":40029,"errmsg":"invalid code"}""")));

        var ex = await Assert.ThrowsAsync<WeChatApiException>(
            () => CreateService(handler).GetSessionAsync("bad-code"));

        Assert.Equal(40029, ex.ErrCode);
    }

    [Fact]
    public async Task GetSessionAsync_FirstTimeout_RetriesAndSucceeds()
    {
        var attempts = 0;
        var handler = Stub(_ =>
        {
            attempts++;
            if (attempts == 1)
                return Task.FromException<HttpResponseMessage>(
                    new TaskCanceledException("timeout", new TimeoutException()));
            return Task.FromResult(JsonResponse(
                """{"openid":"openid-abc","session_key":"session-key","errcode":0}"""));
        });

        var session = await CreateService(handler).GetSessionAsync("code");

        Assert.Equal("openid-abc", session.OpenId);
        Assert.Equal(2, attempts);
    }

    [Fact]
    public async Task GetSessionAsync_TimeoutTwice_ThrowsWeChatTimeoutException()
    {
        var handler = Stub(_ => Task.FromException<HttpResponseMessage>(
            new TaskCanceledException("timeout", new TimeoutException())));

        await Assert.ThrowsAsync<WeChatTimeoutException>(
            () => CreateService(handler).GetSessionAsync("code"));
    }

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _handler;

        public StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => _handler(request);
    }
}
