using Agenda.Api.Checkin.Dtos;
using Agenda.Api.Checkin.Validators;
using Agenda.Api.Infrastructure;
using Xunit;

namespace Agenda.Api.Checkin.Tests;

public class CheckinRequestValidatorTests
{
    private readonly CheckinRequestValidator _validator = new();

    [Fact]
    public void Validate_ValidRequest_Passes()
    {
        var request = new CheckinRequest { ScheduleId = Guid.NewGuid(), Date = new DateOnly(2000, 1, 1) };

        var result = _validator.Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_EmptyScheduleId_FailsWithCheckinWindowClosed()
    {
        var request = new CheckinRequest { ScheduleId = Guid.Empty, Date = new DateOnly(2000, 1, 1) };

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.CheckinWindowClosed);
    }

    [Fact]
    public void Validate_DefaultDate_FailsWithCheckinWindowClosed()
    {
        var request = new CheckinRequest { ScheduleId = Guid.NewGuid(), Date = default };

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.CheckinWindowClosed);
    }

    [Fact]
    public void Validate_FutureDate_FailsWithCheckinWindowClosed()
    {
        var request = new CheckinRequest { ScheduleId = Guid.NewGuid(), Date = new DateOnly(2100, 1, 1) };

        var result = _validator.Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.CheckinWindowClosed);
    }
}
