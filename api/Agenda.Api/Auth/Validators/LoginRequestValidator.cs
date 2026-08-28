using Agenda.Api.Auth.Dtos;
using Agenda.Api.Infrastructure;
using FluentValidation;

namespace Agenda.Api.Auth.Validators;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.CodeInvalid);
    }
}
