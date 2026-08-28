using System.Security.Claims;
using Agenda.Api.Infrastructure.Auth;
using FluentValidation;

namespace Agenda.Api.Infrastructure.Middleware;

/// <summary>
/// 全局异常处理：统一错误信封、traceId 关联、不泄露堆栈与敏感信息。
/// </summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            context.Response.StatusCode = 499; // Client Closed Request
        }
        catch (WeChatApiException ex)
        {
            _logger.LogWarning(ex, "WeChat API error {ErrCode}", ex.ErrCode);
            await WriteErrorAsync(context, ErrorCodes.WeChatApiError);
        }
        catch (WeChatTimeoutException ex)
        {
            _logger.LogWarning(ex, "WeChat API timeout");
            await WriteErrorAsync(context, ErrorCodes.WeChatApiTimeout);
        }
        catch (ValidationException ex)
        {
            var code = ex.Errors.FirstOrDefault()?.ErrorCode ?? ErrorCodes.InternalError;
            await WriteErrorAsync(context, code);
        }
        catch (UnauthorizedAccessException)
        {
            await WriteErrorAsync(context, ErrorCodes.TokenInvalid);
        }
        catch (DomainException ex)
        {
            await WriteErrorAsync(context, ex.ErrorCode);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            await WriteErrorAsync(context, ErrorCodes.InternalError);
        }
    }

    private async Task WriteErrorAsync(HttpContext context, string errorCode)
    {
        context.Response.StatusCode = ErrorCodes.HttpStatus(errorCode);
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(ErrorResponse.From(errorCode, context.TraceIdentifier));
    }
}
