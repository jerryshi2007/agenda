using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Infrastructure.Services;

/// <summary>
/// 注销用户打卡记录匿名化。打卡表由打卡模块建立，当前以原始 SQL 引用，建表后生效；
/// 表不存在时降级跳过，不阻断删除流程。
/// </summary>
public class AnonymizationService : IAnonymizationService
{
    private readonly AppDbContext _db;
    private readonly ILogger<AnonymizationService> _logger;

    public AnonymizationService(AppDbContext db, ILogger<AnonymizationService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task AnonymizeCheckinRecordsAsync(Guid userId, CancellationToken ct = default)
    {
        var anonymousValue = $"deleted_user_{Guid.NewGuid():N}";
        try
        {
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE \"CheckinRecords\" SET \"UserId\" = {0} WHERE \"UserId\" = {1}",
                anonymousValue,
                userId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Checkin anonymization skipped for user {UserId} (checkin table unavailable)", userId);
        }
    }
}
