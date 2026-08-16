using Agenda.Api.Checkin.Dtos;
using Agenda.Api.Infrastructure;
using FluentValidation;

namespace Agenda.Api.Checkin.Validators;

/// <summary>
/// 打卡请求校验：scheduleId 非空；date 非空且不能是未来日期。
/// </summary>
public class CheckinRequestValidator : AbstractValidator<CheckinRequest>
{
    public CheckinRequestValidator()
    {
        RuleFor(x => x.ScheduleId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.CheckinWindowClosed);

        RuleFor(x => x.Date)
            .Must(date => date != default && date <= ServerToday())
            .WithErrorCode(ErrorCodes.CheckinWindowClosed);
    }

    /// <summary>服务器北京时间「今天」，与 CheckinService 时间基准一致（US-CHK-06）。</summary>
    private static DateOnly ServerToday() =>
        DateOnly.FromDateTime(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(8)).Date);
}
