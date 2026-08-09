using Agenda.Api.Schedule.Dtos;
using FluentValidation;

namespace Agenda.Api.Schedule.Validators;

public class UpdateScheduleRequestValidator : AbstractValidator<UpdateScheduleRequest>
{
    public UpdateScheduleRequestValidator()
    {
        RuleFor(x => x.Name)
            .MaximumLength(50).WithMessage("SCHEDULE_NAME_TOO_LONG")
            .Must(name => name == null || !string.IsNullOrWhiteSpace(name)).WithMessage("SCHEDULE_NAME_EMPTY")
            .When(x => x.Name != null);

        RuleFor(x => x.TimeSlots)
            .NotEmpty().WithMessage("NO_DAY_SELECTED")
            .When(x => x.TimeSlots != null);

        When(x => x.TimeSlots != null, () =>
        {
            RuleForEach(x => x.TimeSlots!).ChildRules(slot =>
            {
                slot.RuleFor(s => s.StartTime)
                    .Must((slot, start) => start < slot.EndTime)
                    .WithMessage("TIME_SLOT_INVALID");
            });
        });

        RuleFor(x => x.Notes)
            .MaximumLength(500).WithMessage("NOTES_TOO_LONG");

        RuleFor(x => x.Location)
            .MaximumLength(100).WithMessage("LOCATION_TOO_LONG");

        RuleFor(x => x.Scope)
            .Must(scope => scope == "ThisOnly" || scope == "ThisAndFuture")
            .WithMessage("INVALID_SCOPE")
            .When(x => x.Scope != null);
    }
}
