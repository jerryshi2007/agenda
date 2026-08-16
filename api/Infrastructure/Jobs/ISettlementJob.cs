namespace Agenda.Api.Infrastructure.Jobs;

/// <summary>
/// 每日结算任务的执行契约。供测试专用端点依赖注入，便于单元测试用 Moq 隔离。
/// </summary>
public interface ISettlementJob
{
    Task ExecuteAsync(CancellationToken ct);
}
