using Agenda.Api.Auth.Dtos;
using Agenda.Api.Infrastructure;
using FluentValidation;

namespace Agenda.Api.Auth.Validators;

public class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator(ISensitiveWordFilter sensitiveWordFilter)
    {
        RuleFor(x => x.Nickname)
            .NotEmpty().WithErrorCode(ErrorCodes.NicknameEmpty)
            .MaximumLength(20).WithErrorCode(ErrorCodes.NicknameTooLong)
            .Must(nickname => !sensitiveWordFilter.ContainsSensitiveWord(nickname))
            .WithErrorCode(ErrorCodes.NicknameSensitive);
    }
}
