using System.Net;
using System.Security.Claims;
using Agenda.Api.Infrastructure.Middleware;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Agenda.Api.Infrastructure.Middleware.Tests;

public class RateLimitingMiddlewareTests
{
    private static DefaultHttpContext CreateContext(string method, string path, string? userId = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();
        if (userId != null)
        {
            context.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("userId", userId)], "test"));
        }
        else
        {
            context.Connection.RemoteIpAddress = IPAddress.Parse("127.0.0.1");
        }

        return context;
    }

    private static RateLimitingMiddleware CreateMiddleware(RequestDelegate next, Func<DateTimeOffset>? clock = null)
        => new(next, clock);

    [Fact]
    public async Task InvokeAsync_UnderLimit_PassesThrough()
    {
        var calls = 0;
        RequestDelegate next = _ => { calls++; return Task.CompletedTask; };
        var middleware = CreateMiddleware(next);

        for (var i = 0; i < 10; i++)
            await middleware.InvokeAsync(CreateContext("POST", "/api/v1/auth/login"));

        Assert.Equal(10, calls);
    }

    [Fact]
    public async Task InvokeAsync_OverLimit_Returns429()
    {
        var calls = 0;
        RequestDelegate next = _ => { calls++; return Task.CompletedTask; };
        var middleware = CreateMiddleware(next);

        for (var i = 0; i < 10; i++)
            await middleware.InvokeAsync(CreateContext("POST", "/api/v1/auth/login"));

        var eleventh = CreateContext("POST", "/api/v1/auth/login");
        await middleware.InvokeAsync(eleventh);

        Assert.Equal(10, calls);
        Assert.Equal(429, eleventh.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_NonLoginEndpoint_NotRateLimited()
    {
        var calls = 0;
        RequestDelegate next = _ => { calls++; return Task.CompletedTask; };
        var middleware = CreateMiddleware(next);

        for (var i = 0; i < 20; i++)
            await middleware.InvokeAsync(CreateContext("GET", "/api/v1/auth/profile"));

        Assert.Equal(20, calls);
    }

    [Fact]
    public async Task InvokeAsync_WindowElapsed_ResetsCounter()
    {
        var calls = 0;
        RequestDelegate next = _ => { calls++; return Task.CompletedTask; };
        DateTimeOffset current = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var middleware = CreateMiddleware(next, () => current);

        for (var i = 0; i < 10; i++)
            await middleware.InvokeAsync(CreateContext("POST", "/api/v1/auth/login"));

        current = current.AddMinutes(1);

        var context = CreateContext("POST", "/api/v1/auth/login");
        await middleware.InvokeAsync(context);

        Assert.Equal(11, calls);
        Assert.Equal(200, context.Response.StatusCode);
    }
}
