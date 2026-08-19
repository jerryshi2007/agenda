using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Template.Services;

/// <summary>
/// 模板种子 HostedService：应用启动时检查并幂等插入 3 个预设模板。
/// 失败不阻塞应用启动，仅记录日志。
/// </summary>
public class TemplateSeedHostedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TemplateSeedHostedService> _logger;

    public TemplateSeedHostedService(
        IServiceProvider serviceProvider,
        ILogger<TemplateSeedHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var existing = await db.Templates
                .Where(t => t.IsPreset)
                .Select(t => new { t.Name, t.ScheduleType })
                .ToListAsync(cancellationToken);

            var existingSet = existing
                .Select(x => (x.Name, x.ScheduleType))
                .ToHashSet();

            var presets = new[]
            {
                ("课后班模板", ScheduleType.AfterSchoolActivity, new[]
                {
                    (DayOfWeek.Wednesday, new TimeOnly(16, 0), new TimeOnly(17, 0))
                }),
                ("日常作息模板", ScheduleType.DailyRoutine, new[]
                {
                    (DayOfWeek.Monday, new TimeOnly(18, 0), new TimeOnly(18, 30)),
                    (DayOfWeek.Tuesday, new TimeOnly(18, 0), new TimeOnly(18, 30)),
                    (DayOfWeek.Wednesday, new TimeOnly(18, 0), new TimeOnly(18, 30)),
                    (DayOfWeek.Thursday, new TimeOnly(18, 0), new TimeOnly(18, 30)),
                    (DayOfWeek.Friday, new TimeOnly(18, 0), new TimeOnly(18, 30)),
                    (DayOfWeek.Saturday, new TimeOnly(18, 0), new TimeOnly(18, 30)),
                    (DayOfWeek.Sunday, new TimeOnly(18, 0), new TimeOnly(18, 30))
                }),
                ("作业模板", ScheduleType.HomeworkTask, Array.Empty<(DayOfWeek, TimeOnly, TimeOnly)>())
            };

            var now = DateTimeOffset.UtcNow;
            var added = 0;

            foreach (var (name, type, slots) in presets)
            {
                if (existingSet.Contains((name, type)))
                    continue;

                var template = new DomainTemplate
                {
                    Id = Guid.NewGuid(),
                    Name = name,
                    ScheduleType = type,
                    IsPreset = true,
                    FamilyId = null,
                    CreatedBy = Guid.Empty,
                    IsDeleted = false,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                foreach (var (day, start, end) in slots)
                {
                    template.TimeSlots.Add(new DomainTemplateTimeSlot
                    {
                        TemplateId = template.Id,
                        DayOfWeek = day,
                        StartTime = start,
                        EndTime = end
                    });
                }

                db.Templates.Add(template);
                added++;
            }

            if (added > 0)
            {
                await db.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("模板种子完成：插入 {Count} 条预设模板", added);
            }
            else
            {
                _logger.LogInformation("模板种子已存在，跳过");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "模板种子失败");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
