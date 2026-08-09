using Agenda.Api.Domain.Enums;
using Agenda.Api.Schedule.Dtos;
using FluentValidation;

namespace Agenda.Api.Schedule.Validators;

public class CreateScheduleRequestValidator : AbstractValidator<CreateScheduleRequest>
{
    public CreateScheduleRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("SCHEDULE_NAME_EMPTY")
            .MaximumLength(50).WithMessage("SCHEDULE_NAME_TOO_LONG")
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithMessage("SCHEDULE_NAME_EMPTY");

        RuleFor(x => x.ScheduleType)
            .NotEmpty().WithMessage("SCHEDULE_TYPE_REQUIRED")
            .Must(BeValidScheduleType).WithMessage("SCHEDULE_TYPE_INVALID");

        RuleFor(x => x.ChildIds)
            .NotEmpty().WithMessage("CHILD_NOT_SELECTED");

        RuleFor(x => x.TimeSlots)
            .NotEmpty().WithMessage("NO_DAY_SELECTED")
            .When(x => x.ScheduleType != nameof(ScheduleType.HomeworkTask));

        RuleForEach(x => x.TimeSlots).ChildRules(slot =>
        {
            slot.RuleFor(s => s.StartTime)
                .Must((slot, start) => start < slot.EndTime)
                .WithMessage("TIME_SLOT_INVALID");
        });

        RuleFor(x => x.Notes)
            .MaximumLength(500).WithMessage("NOTES_TOO_LONG");

        RuleFor(x => x.Location)
            .MaximumLength(100).WithMessage("LOCATION_TOO_LONG");

        RuleFor(x => x.RepeatEndDate)
            .Must(date => date == null || date.Value >= DateOnly.FromDateTime(DateTime.Today))
            .WithMessage("REPEAT_END_DATE_INVALID");

        RuleFor(x => x.DueDate)
            .Must(date => date == null || date.Value >= DateOnly.FromDateTime(DateTime.Today))
            .WithMessage("DUE_DATE_INVALID");
    }

    private static bool BeValidScheduleType(string eventType) =>
        Enum.TryParse<ScheduleType>(eventType, out _);
}
