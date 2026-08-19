using Agenda.Api.Infrastructure;
using Agenda.Api.Template.Dtos;
using FluentValidation;

namespace Agenda.Api.Template.Validators;

/// <summary>
/// 从模板生成日程请求校验：
/// - ChildId: 非空
/// - StartDate: 不早于今天（服务器北京时间）
/// - 覆盖字段长度限制
/// - TimeSlots（若提供）：每项 StartTime 小于 EndTime
/// </summary>
public class ApplyTemplateRequestValidator : AbstractValidator<ApplyTemplateRequest>
{
    public ApplyTemplateRequestValidator()
    {
        RuleFor(x => x.ChildId)
            .NotEqual(Guid.Empty)
            .WithErrorCode(ErrorCodes.TemplateChildNotInFamily);

        RuleFor(x => x.StartDate)
            .GreaterThanOrEqualTo(DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8).Date))
            .WithErrorCode(ErrorCodes.TemplateStartDateInvalid);

        RuleFor(x => x.Name)
            .MaximumLength(50)
            .WithErrorCode(ErrorCodes.TemplateNameTooLong);

        RuleFor(x => x.Location)
            .MaximumLength(100)
            .WithErrorCode(ErrorCodes.TemplateLocationTooLong);

        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .WithErrorCode(ErrorCodes.TemplateNotesTooLong);

        RuleForEach(x => x.TimeSlots!)
            .Must(ts => ts.StartTime < ts.EndTime)
            .WithErrorCode(ErrorCodes.TemplateTimeslotTimeInvalid);
    }
}
