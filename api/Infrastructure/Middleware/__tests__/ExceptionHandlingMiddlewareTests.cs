using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Auth;
using Agenda.Api.Infrastructure.Middleware;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Agenda.Api.Infrastructure.Middleware.Tests;

public class ExceptionHandlingMiddlewareTests
{
    private static DefaultHttpContext CreateContext()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static ExceptionHandlingMiddleware CreateMiddleware(RequestDelegate next)
        => new(next, NullLogger<ExceptionHandlingMiddleware>.Instance);

    private static async Task<string> ReadBodyAsync(DefaultHttpContext context)
    {
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        return await reader.ReadToEndAsync();
    }

    [Fact]
    public async Task InvokeAsync_WeChatApiException_Returns502()
    {
        var context = CreateContext();
        var middleware = CreateMiddleware(_ => throw new WeChatApiException(40029, "invalid code"));

        await middleware.InvokeAsync(context);

        Assert.Equal(502, context.Response.StatusCode);
        Assert.Contains("WECHAT_API_ERROR", await ReadBodyAsync(context));
    }

    [Fact]
    public async Task InvokeAsync_WeChatTimeoutException_Returns503()
    {
        var context = CreateContext();
        var middleware = CreateMiddleware(_ => throw new WeChatTimeoutException("timeout", new TimeoutException()));

        await middleware.InvokeAsync(context);

        Assert.Equal(503, context.Response.StatusCode);
        Assert.Contains("WECHAT_API_TIMEOUT", await ReadBodyAsync(context));
    }

    [Fact]
    public async Task InvokeAsync_ValidationException_Returns400()
    {
        var context = CreateContext();
        var failure = new ValidationFailure("Code", "code required") { ErrorCode = ErrorCodes.CodeInvalid };
        var middleware = CreateMiddleware(_ => throw new ValidationException(new[] { failure }));

        await middleware.InvokeAsync(context);

        Assert.Equal(400, context.Response.StatusCode);
        Assert.Contains("CODE_INVALID", await ReadBodyAsync(context));
    }

    [Fact]
    public async Task InvokeAsync_UnauthorizedAccess_Returns401()
    {
        var context = CreateContext();
        var middleware = CreateMiddleware(_ => throw new UnauthorizedAccessException());

        await middleware.InvokeAsync(context);

        Assert.Equal(401, context.Response.StatusCode);
        Assert.Contains("TOKEN_INVALID", await ReadBodyAsync(context));
    }

    [Fact]
    public async Task InvokeAsync_DomainException_ReturnsMappedStatus()
    {
        var context = CreateContext();
        var middleware = CreateMiddleware(_ => throw new DomainException(ErrorCodes.FamilyStillActive));

        await middleware.InvokeAsync(context);

        Assert.Equal(400, context.Response.StatusCode);
        Assert.Contains("FAMILY_STILL_ACTIVE", await ReadBodyAsync(context));
    }

    [Fact]
    public async Task InvokeAsync_GenericException_Returns500WithoutDetails()
    {
        var context = CreateContext();
        var middleware = CreateMiddleware(_ => throw new InvalidOperationException("secret internal detail"));

        await middleware.InvokeAsync(context);

        Assert.Equal(500, context.Response.StatusCode);
        var body = await ReadBodyAsync(context);
        Assert.Contains("INTERNAL_ERROR", body);
        Assert.DoesNotContain("secret internal detail", body);
    }

    [Fact]
    public async Task InvokeAsync_ErrorEnvelope_ContainsTraceId()
    {
        var context = CreateContext();
        var middleware = CreateMiddleware(_ => throw new DomainException(ErrorCodes.NotDeleted));

        await middleware.InvokeAsync(context);

        Assert.Contains("\"traceId\"", await ReadBodyAsync(context));
    }
}
