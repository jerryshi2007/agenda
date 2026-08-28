using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Template.Dtos;
using FluentValidation;

namespace Agenda.Api.Template.Validators;

/// <summary>
/// 创建模板请求校验：
/// - Name: 1-50 字符
/// - ScheduleType: 必须是 AfterSchoolActivity / DailyRoutine / HomeworkTask
/// - TimeSlots: 非 HomeworkTask 至少 1 项；HomeworkTask 必须为空
/// - Location: 最大 100 字符
/// - Notes: 最大 500 字符
/// - TimeSlots 内每项 StartTime 小于 EndTime
/// </summary>
public class CreateTemplateRequestValidator : AbstractValidator<CreateTemplateRequest>
{
    public CreateTemplateRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.TemplateNameEmpty)
            .MaximumLength(50)
            .WithErrorCode(ErrorCodes.TemplateNameTooLong);

        RuleFor(x => x.ScheduleType)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.TemplateTypeInvalid)
            .Must(BeValidScheduleType)
            .WithErrorCode(ErrorCodes.TemplateTypeInvalid);

        RuleFor(x => x.Location)
            .MaximumLength(100)
            .WithErrorCode(ErrorCodes.TemplateLocationTooLong);

        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .WithErrorCode(ErrorCodes.TemplateNotesTooLong);

        // HomeworkTask 不允许配置 timeSlots
        RuleFor(x => x.TimeSlots)
            .Must((req, slots) => !IsHomework(req.ScheduleType) || (slots != null && slots.Count == 0))
            .WithErrorCode(ErrorCodes.TemplateTimeslotInvalid)
            .WithMessage("HomeworkTask 模板不能配置时间槽");

        // 非 HomeworkTask 必须有至少 1 个 timeSlot
        RuleFor(x => x.TimeSlots)
            .Must((req, slots) => IsHomework(req.ScheduleType) || (slots != null && slots.Count >= 1))
            .WithErrorCode(ErrorCodes.TemplateTimeslotRequired);

        // TimeSlots 内每项 StartTime < EndTime
        RuleForEach(x => x.TimeSlots)
            .Must(ts => ts.StartTime < ts.EndTime)
            .WithErrorCode(ErrorCodes.TemplateTimeslotTimeInvalid);
    }

    private static bool BeValidScheduleType(string value) =>
        Enum.TryParse<ScheduleType>(value, out _);

    private static bool IsHomework(string scheduleType) =>
        Enum.TryParse<ScheduleType>(scheduleType, out var t) && t == ScheduleType.HomeworkTask;
}
