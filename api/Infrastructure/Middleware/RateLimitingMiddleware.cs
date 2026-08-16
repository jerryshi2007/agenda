using System.Collections.Concurrent;
using System.Security.Claims;
using Agenda.Api.Infrastructure;

namespace Agenda.Api.Infrastructure.Middleware;

/// <summary>
/// 登录/续期接口限流：每个来源（IP 或已认证 userId）每分钟 10 次，超出返回 429 RATE_LIMITED。
/// </summary>
public class RateLimitingMiddleware
{
    private const int PermitLimit = 10;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    private readonly RequestDelegate _next;
    private readonly Func<DateTimeOffset> _utcNow;
    private readonly ConcurrentDictionary<string, RateWindow> _counters = new();

    public RateLimitingMiddleware(RequestDelegate next, Func<DateTimeOffset>? utcNow = null)
    {
        _next = next;
        _utcNow = utcNow ?? (() => DateTimeOffset.UtcNow);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!IsRateLimitedEndpoint(context))
        {
            await _next(context);
            return;
        }

        var key = GetClientKey(context);
        var now = _utcNow();

        var window = _counters.GetOrAdd(key, _ => new RateWindow(now));
        if (now - window.WindowStart >= Window)
        {
            _counters.TryRemove(key, out _);
            window = _counters.GetOrAdd(key, _ => new RateWindow(now));
        }

        if (window.Increment() > PermitLimit)
        {
            context.Response.StatusCode = ErrorCodes.HttpStatus(ErrorCodes.RateLimited);
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(ErrorResponse.From(ErrorCodes.RateLimited));
            return;
        }

        await _next(context);
    }

    private static bool IsRateLimitedEndpoint(HttpContext context) =>
        context.Request.Method == HttpMethods.Post &&
        (context.Request.Path.StartsWithSegments("/api/v1/auth/login") ||
         context.Request.Path.StartsWithSegments("/api/v1/auth/refresh"));

    private static string GetClientKey(HttpContext context)
    {
        var userId = context.User.FindFirstValue("userId");
        if (!string.IsNullOrEmpty(userId))
            return $"user:{userId}";

        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return $"ip:{ip}";
    }

    private sealed class RateWindow
    {
        private int _count;

        public DateTimeOffset WindowStart { get; }

        public RateWindow(DateTimeOffset start)
        {
            WindowStart = start;
        }

        public int Increment() => Interlocked.Increment(ref _count);
    }
}
