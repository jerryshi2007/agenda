using System.Security.Claims;
using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Infrastructure.Middleware;

/// <summary>
/// 最小化 JWT 认证中间件骨架。从 JWT Bearer token 中解析 userId。
/// 待 auth-module 完整实现后替换。
/// </summary>
public class FamilyContextMiddleware
{
    private readonly RequestDelegate _next;

    public FamilyContextMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            // JWT 中间件已完成认证，Claims 已填充
        }
        await _next(context);
    }
}
