using Agenda.Api.Schedule.Dtos;
using FluentValidation;

namespace Agenda.Api.Schedule.Validators;

public class CalendarQueryValidator : AbstractValidator<CalendarQueryRequest>
{
    private static readonly HashSet<string> ValidViews = new() { "month", "week", "day" };

    public CalendarQueryValidator()
    {
        RuleFor(x => x.View)
            .Must(v => ValidViews.Contains(v.ToLowerInvariant()))
            .WithMessage("INVALID_VIEW");

        RuleFor(x => x.EndDate)
            .GreaterThan(x => x.StartDate)
            .WithMessage("DATE_RANGE_INVALID");

        RuleFor(x => x)
            .Must(x => (x.EndDate.DayNumber - x.StartDate.DayNumber) <= 90)
            .WithMessage("DATE_RANGE_TOO_LARGE");
    }
}
