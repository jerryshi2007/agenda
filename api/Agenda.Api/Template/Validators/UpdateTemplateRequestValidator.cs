using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Template.Dtos;
using FluentValidation;

namespace Agenda.Api.Template.Validators;

/// <summary>
/// 更新模板请求校验。UpdateTemplateRequest 不含 scheduleType，故无 scheduleType 校验。
/// TimeSlots 必填（可能为空数组表示 HomeworkTask）。
/// </summary>
public class UpdateTemplateRequestValidator : AbstractValidator<UpdateTemplateRequest>
{
    public UpdateTemplateRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.TemplateNameEmpty)
            .MaximumLength(50)
            .WithErrorCode(ErrorCodes.TemplateNameTooLong);

        RuleFor(x => x.Location)
            .MaximumLength(100)
            .WithErrorCode(ErrorCodes.TemplateLocationTooLong);

        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .WithErrorCode(ErrorCodes.TemplateNotesTooLong);

        // TimeSlots 必填（即使 HomeworkTask 也需传空数组明确表达"无时间槽"）
        RuleFor(x => x.TimeSlots)
            .NotNull()
            .WithErrorCode(ErrorCodes.TemplateTimeslotRequired);

        // TimeSlots 内每项 StartTime < EndTime
        RuleForEach(x => x.TimeSlots)
            .Must(ts => ts.StartTime < ts.EndTime)
            .WithErrorCode(ErrorCodes.TemplateTimeslotTimeInvalid);
    }
}
