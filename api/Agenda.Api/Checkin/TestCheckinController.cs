using Agenda.Api.Infrastructure.Jobs;
using Microsoft.AspNetCore.Mvc;

namespace Agenda.Api.Checkin;

/// <summary>
/// Development-only 测试专用端点：同步触发每日结算（无 Hangfire 调度入口）。
/// 仅在 Development 环境注册（见 Program.cs），生产环境不可达。
/// </summary>
[ApiController]
[Route("api/v1/test/checkin")]
public class TestCheckinController : ControllerBase
{
    private readonly ISettlementJob _settlementJob;

    public TestCheckinController(ISettlementJob settlementJob)
    {
        _settlementJob = settlementJob;
    }

    /// <summary>同步执行结算。成功返回 200，异常由全局异常中间件转为 500。</summary>
    [HttpPost("settle")]
    public async Task<IActionResult> Settle(CancellationToken ct)
    {
        await _settlementJob.ExecuteAsync(ct);
        return Ok(new { settled = true });
    }
}
