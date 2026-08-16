using Agenda.Api.Infrastructure.Jobs;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Agenda.Api.Checkin.Tests;

public class TestCheckinControllerTests
{
    [Fact]
    public async Task Settle_WhenInvoked_ExecutesSettlementJobAndReturnsOk()
    {
        var job = new Mock<ISettlementJob>();
        var controller = new TestCheckinController(job.Object);

        var result = await controller.Settle(CancellationToken.None);

        job.Verify(x => x.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Once);
        Assert.IsType<OkObjectResult>(result);
    }
}
