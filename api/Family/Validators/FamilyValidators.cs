using Agenda.Api.Family.Dtos;
using FluentValidation;

namespace Agenda.Api.Family.Validators;

/// <summary>创建家庭请求校验。name 长度 2-20，role 必填。</summary>
public class CreateFamilyRequestValidator : AbstractValidator<CreateFamilyRequest>
{
    public CreateFamilyRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(Infrastructure.ErrorCodes.FamilyNameInvalidLength)
            .Length(2, 20).WithErrorCode(Infrastructure.ErrorCodes.FamilyNameInvalidLength);
        RuleFor(x => x.Role)
            .IsInEnum().WithErrorCode(Infrastructure.ErrorCodes.FamilyNameInvalidLength);
    }
}

/// <summary>修改家庭名称请求校验。name 长度 2-20。</summary>
public class UpdateFamilyNameRequestValidator : AbstractValidator<UpdateFamilyNameRequest>
{
    public UpdateFamilyNameRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(Infrastructure.ErrorCodes.FamilyNameInvalidLength)
            .Length(2, 20).WithErrorCode(Infrastructure.ErrorCodes.FamilyNameInvalidLength);
    }
}

/// <summary>生成邀请码请求校验。targetRole 必填；邀请孩子时 targetChildName + targetDisplayMode 必填。</summary>
public class GenerateInviteCodeRequestValidator : AbstractValidator<GenerateInviteCodeRequest>
{
    public GenerateInviteCodeRequestValidator()
    {
        RuleFor(x => x.TargetRole)
            .IsInEnum().WithErrorCode(Infrastructure.ErrorCodes.PermissionDenied);

        When(x => x.TargetRole == Domain.Enums.UserRole.Child, () =>
        {
            RuleFor(x => x.TargetChildName)
                .NotEmpty().WithErrorCode(Infrastructure.ErrorCodes.PermissionDenied)
                .MaximumLength(20).WithErrorCode(Infrastructure.ErrorCodes.PermissionDenied);
            RuleFor(x => x.TargetDisplayMode)
                .NotNull().WithErrorCode(Infrastructure.ErrorCodes.PermissionDenied);
        });
    }
}

/// <summary>加入家庭请求校验。code 必须 6 位，仅 2-9 数字。</summary>
public class JoinByCodeRequestValidator : AbstractValidator<JoinByCodeRequest>
{
    public JoinByCodeRequestValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty()
            .Length(6).WithErrorCode(Infrastructure.ErrorCodes.InvalidInvitationCode)
            .Matches("^[2-9]{6}$").WithErrorCode(Infrastructure.ErrorCodes.InvalidInvitationCode);
    }
}

/// <summary>设置孩子展示模式请求校验。displayMode 必填。</summary>
public class SetDisplayModeRequestValidator : AbstractValidator<SetDisplayModeRequest>
{
    public SetDisplayModeRequestValidator()
    {
        RuleFor(x => x.DisplayMode)
            .IsInEnum().WithErrorCode(Infrastructure.ErrorCodes.PermissionDenied);
    }
}

/// <summary>解散家庭请求校验。familyName 必填（与现有家庭名称匹配由 Service 层校验）。</summary>
public class DissolveFamilyRequestValidator : AbstractValidator<DissolveFamilyRequest>
{
    public DissolveFamilyRequestValidator()
    {
        RuleFor(x => x.FamilyName)
            .NotEmpty().WithErrorCode(Infrastructure.ErrorCodes.FamilyNameMismatch);
    }
}
