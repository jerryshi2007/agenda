using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Family.Services;

/// <summary>
/// 家庭清理报告：单次清理任务的统计。
/// </summary>
public sealed record FamilyCleanupReport(
    int RemovedMembers,
    int TransferredCreators,
    int DissolvedFamilies,
    int RemovedFamilies);

/// <summary>
/// 家庭清理后台任务：
/// 1) 已注销超过 30 天的成员：若其是创建者 → 转让给加入最早的其他活跃家长；无其他家长则家庭自动解散；最后物理删除该成员行
/// 2) 已解散超过 30 天的家庭：物理删除（级联删除关联 FamilyMember/InvitationCode）
/// 每日凌晨 4 点执行（与 DeletionCleanupService 的 3 点错开，减少单点数据库压力）。
/// </summary>
public interface IFamilyCleanupService
{
    Task<FamilyCleanupReport> CleanupExpiredAsync(DateTimeOffset now, CancellationToken ct = default);
}

public class FamilyCleanupService : BackgroundService, IFamilyCleanupService
{
    /// <summary>30 天缓冲期与 FamilyLifecycleService.DissolveRetention 保持一致。</summary>
    public static readonly TimeSpan GracePeriod = TimeSpan.FromDays(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<FamilyCleanupService> _logger;

    public FamilyCleanupService(IServiceScopeFactory scopeFactory, ILogger<FamilyCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeUntilNextRun(), stoppingToken);
            try
            {
                var report = await CleanupExpiredAsync(DateTimeOffset.UtcNow, stoppingToken);
                _logger.LogInformation(
                    "Family cleanup: removed {RemovedMembers} members, transferred {TransferredCreators} creators, dissolved {DissolvedFamilies} families, removed {RemovedFamilies} families",
                    report.RemovedMembers, report.TransferredCreators, report.DissolvedFamilies, report.RemovedFamilies);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Family cleanup failed");
            }
        }
    }

    public async Task<FamilyCleanupReport> CleanupExpiredAsync(DateTimeOffset now, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = now - GracePeriod;

        // 阶段 1：处理「创建者是已注销 > 30 天的成员」的家庭
        //   - 有其他活跃家长：转让给加入最早的家长
        //   - 无其他活跃家长：家庭自动解散（DissolvedAt = now，30 天后再次清理时被物理删除）
        var expiredCreatorMembers = await db.FamilyMembers
            .Where(m => m.IsDeleted == true && m.DeletedAt != null && m.DeletedAt < cutoff)
            .ToListAsync(ct);

        var familiesToUpdate = new HashSet<Guid>();
        var transferredCount = 0;
        var dissolvedCount = 0;

        foreach (var expiredCreator in expiredCreatorMembers)
        {
            // 仅当该成员是其家庭创建者时介入；非创建者跳过（其 FamilyMember 行将在阶段 3 删除）
            var family = await db.Families.FirstOrDefaultAsync(f => f.Id == expiredCreator.FamilyId, ct);
            if (family == null) continue;
            if (family.CreatorId != expiredCreator.UserId) continue;
            if (family.Status == FamilyStatus.Dissolved) continue; // 已解散家庭不重复处理
            if (!familiesToUpdate.Add(family.Id)) continue;        // 同一家庭只处理一次

            // 找加入最早的活跃家长
            var earliestActiveParent = await db.FamilyMembers
                .Where(m => m.FamilyId == family.Id
                    && m.Role == UserRole.Parent
                    && m.IsDeleted == false
                    && m.Id != expiredCreator.Id)
                .OrderBy(m => m.JoinedAt)
                .FirstOrDefaultAsync(ct);

            if (earliestActiveParent != null)
            {
                family.CreatorId = earliestActiveParent.UserId;
                transferredCount++;
            }
            else
            {
                family.Status = FamilyStatus.Dissolved;
                family.DissolvedAt = now;
                dissolvedCount++;
            }
        }

        // 阶段 2：物理删除已注销 > 30 天的成员行（包括已处理过的过期创建者）
        var removedMembersCount = 0;
        if (expiredCreatorMembers.Count > 0)
        {
            var ids = expiredCreatorMembers.Select(m => m.Id).ToList();
            var toRemove = await db.FamilyMembers.Where(m => ids.Contains(m.Id)).ToListAsync(ct);
            db.FamilyMembers.RemoveRange(toRemove);
            removedMembersCount = toRemove.Count;
        }

        await db.SaveChangesAsync(ct);

        // 阶段 3：物理删除已解散 > 30 天的家庭（级联删除 FamilyMember / InvitationCode）
        var expiredFamilies = await db.Families
            .Where(f => f.Status == FamilyStatus.Dissolved && f.DissolvedAt != null && f.DissolvedAt < cutoff)
            .ToListAsync(ct);
        if (expiredFamilies.Count > 0)
        {
            db.Families.RemoveRange(expiredFamilies);
            await db.SaveChangesAsync(ct);
        }

        return new FamilyCleanupReport(
            RemovedMembers: removedMembersCount,
            TransferredCreators: transferredCount,
            DissolvedFamilies: dissolvedCount,
            RemovedFamilies: expiredFamilies.Count);
    }

    private static TimeSpan TimeUntilNextRun()
    {
        var now = DateTimeOffset.UtcNow;
        var next = now.Date.AddHours(4);
        if (next <= now) next = next.AddDays(1);
        return next - now;
    }
}
