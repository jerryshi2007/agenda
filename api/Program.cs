using System.Text;
using System.Text.Json.Serialization;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Auth;
using Agenda.Api.Infrastructure.Data;
using Agenda.Api.Infrastructure.Hangfire;
using Agenda.Api.Infrastructure.Middleware;
using Agenda.Api.Shared.Extensions;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// ---- Database ----
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ---- Auth Module (WeChat / JWT / Profile / Deletion / Storage) ----
builder.Services.AddAuthModule(builder.Configuration);

// ---- Authentication (JWT Bearer, consistent with JwtService) ----
var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
// 生产密钥通过环境变量 JWT_SECRET_KEY 注入。此处解析逻辑与
// AuthServiceCollectionExtensions.AddAuthModule 中的 PostConfigure 保持一致，
// 确保 JwtBearer 签名密钥与 JwtService 签发密钥同源。
var envSecretKey = builder.Configuration["JWT_SECRET_KEY"];
if (!string.IsNullOrEmpty(envSecretKey))
    jwt.SecretKey = envSecretKey;
if (string.IsNullOrEmpty(jwt.SecretKey))
    throw new InvalidOperationException("Jwt:SecretKey configuration is required. Set via environment variable JWT_SECRET_KEY or user secrets.");

var signingKeys = new List<SecurityKey>
{
    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SecretKey))
};
signingKeys.AddRange(jwt.LegacySecretKeys
    .Where(k => !string.IsNullOrEmpty(k))
    .Select(k => new SymmetricSecurityKey(Encoding.UTF8.GetBytes(k))));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = signingKeys,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "userId"
        };
        options.Events = new JwtBearerEvents
        {
            // 尚未过期但剩余有效期不足 PreExpiryWindow 时拒绝，触发客户端提前续期。
            // 语义与 JwtService.ValidateToken 保持一致。
            OnTokenValidated = context =>
            {
                var remaining = context.SecurityToken.ValidTo - DateTime.UtcNow;
                if (remaining >= TimeSpan.Zero && remaining < jwt.PreExpiryWindow)
                    context.Fail("token expiring soon");
                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = 401;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsJsonAsync(
                    ErrorResponse.From(ErrorCodes.TokenInvalid, context.HttpContext.TraceIdentifier));
            }
        };
    });

builder.Services.AddAuthorization();

// ---- Controllers + Swagger ----
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    })
    .ConfigureApplicationPartManager(manager =>
    {
        // 测试专用控制器仅在 Development 环境注册（生产环境路由表不可达）。
        if (!builder.Environment.IsDevelopment())
        {
            manager.FeatureProviders.Add(new DevelopmentOnlyControllerFeatureProvider(
                typeof(Agenda.Api.Checkin.TestCheckinController)));
        }
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Agenda API", Version = "v1" });
});

// ---- Schedule Module ----
builder.Services.AddScheduleModule();

// ---- Checkin Module ----
builder.Services.AddCheckinModule();

// ---- Family Module ----
builder.Services.AddFamilyModule();

// ---- Checkin Settlement (Hangfire) ----
builder.Services.AddHangfireModule(builder.Configuration);

// ---- CORS ----
var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

// ---- Middleware Pipeline ----
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<RateLimitingMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTimeOffset.UtcNow }));

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ---- Auto-migrate (Development only) ----
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        await db.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogWarning(ex, "Database migration failed. This is expected if PostgreSQL is not running.");
    }
}

// ---- Hangfire (checkin settlement) ----
// Dashboard 仅在 Development 环境启用（R9 缓解：生产环境不开放）。
if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard();
}

try
{
    HangfireConfiguration.ScheduleRecurringJobs();
}
catch (Exception ex)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogWarning(ex, "Hangfire recurring job registration failed. This is expected if PostgreSQL is not running.");
}

app.Run();
