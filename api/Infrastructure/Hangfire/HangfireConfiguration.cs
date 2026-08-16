using Agenda.Api.Infrastructure.Jobs;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Agenda.Api.Infrastructure.Hangfire;

/// <summary>
/// Hangfire 调度配置：PostgreSQL 存储 + 单 worker（防并发）+ 每日结算任务注册。
/// Dashboard 仅在 Development 环境启用（见 Program.cs）。
/// </summary>
public static class HangfireConfiguration
{
    public static IServiceCollection AddHangfireModule(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("ConnectionString DefaultConnection is required for Hangfire.");

        services.AddHangfire(config =>
            config.UsePostgreSqlStorage(options => options.UseNpgsqlConnection(connectionString)));

        // 单 worker 防并发（spec Settlement Concurrent Safety）。
        services.AddHangfireServer(options => options.WorkerCount = 1);

        // 结算任务依赖 Scoped AppDbContext / IScheduleQueryService，注册为 Scoped，
        // 由 Hangfire AspNetCoreJobActivator 每次执行时解析（自动开 scope）。
        services.AddScoped<SettlementJob>();
        services.AddScoped<ISettlementJob>(sp => sp.GetRequiredService<SettlementJob>());

        return services;
    }

    /// <summary>注册每日结算 Recurring Job（每天 00:05 北京时间）。</summary>
    public static void ScheduleRecurringJobs()
    {
        RecurringJob.AddOrUpdate<SettlementJob>(
            "daily-settlement",
            job => job.ExecuteAsync(default),
            "5 0 * * *",
            new RecurringJobOptions
            {
                TimeZone = TimeZoneInfo.FindSystemTimeZoneById("China Standard Time")
            });
    }
}
