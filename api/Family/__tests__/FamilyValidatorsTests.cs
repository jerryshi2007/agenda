using Agenda.Api.Family.Dtos;
using Agenda.Api.Family.Validators;
using Agenda.Api.Infrastructure;
using FluentValidation.TestHelper;
using Xunit;

namespace Agenda.Api.Family.Tests;

/// <summary>
/// 校验器单元测试。错误码一律从 ErrorCodes（contracts/family/errors.json）引用，禁止硬编码字符串。
/// </summary>
public class FamilyValidatorsTests
{
    [Fact]
    public void CreateFamilyRequest_ValidName_Passes()
    {
        var v = new CreateFamilyRequestValidator();
        var req = new CreateFamilyRequest { Name = "我们家", Role = Domain.Enums.UserRole.Parent };
        var result = v.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateFamilyRequest_NameTooShort_FailsWithFamilyNameInvalidLength()
    {
        var v = new CreateFamilyRequestValidator();
        var req = new CreateFamilyRequest { Name = "我", Role = Domain.Enums.UserRole.Parent };
        var result = v.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorCode(ErrorCodes.FamilyNameInvalidLength);
    }

    [Fact]
    public void CreateFamilyRequest_NameTooLong_FailsWithFamilyNameInvalidLength()
    {
        var v = new CreateFamilyRequestValidator();
        var req = new CreateFamilyRequest { Name = new string('a', 21), Role = Domain.Enums.UserRole.Parent };
        var result = v.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorCode(ErrorCodes.FamilyNameInvalidLength);
    }

    [Fact]
    public void CreateFamilyRequest_NameExactly20_Passes()
    {
        var v = new CreateFamilyRequestValidator();
        var req = new CreateFamilyRequest { Name = new string('a', 20), Role = Domain.Enums.UserRole.Parent };
        var result = v.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateFamilyNameRequest_ValidName_Passes()
    {
        var v = new UpdateFamilyNameRequestValidator();
        var req = new UpdateFamilyNameRequest { Name = "新家庭" };
        var result = v.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateFamilyNameRequest_NameTooShort_FailsWithFamilyNameInvalidLength()
    {
        var v = new UpdateFamilyNameRequestValidator();
        var req = new UpdateFamilyNameRequest { Name = "" };
        var result = v.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorCode(ErrorCodes.FamilyNameInvalidLength);
    }

    [Fact]
    public void GenerateInviteCodeRequest_ParentTarget_PassesWithoutChildName()
    {
        var v = new GenerateInviteCodeRequestValidator();
        var req = new GenerateInviteCodeRequest { TargetRole = Domain.Enums.UserRole.Parent };
        var result = v.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void GenerateInviteCodeRequest_ChildTarget_RequiresChildName()
    {
        var v = new GenerateInviteCodeRequestValidator();
        var req = new GenerateInviteCodeRequest
        {
            TargetRole = Domain.Enums.UserRole.Child,
            TargetDisplayMode = Domain.Enums.DisplayMode.Primary
            // TargetChildName missing
        };
        var result = v.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TargetChildName);
    }

    [Fact]
    public void GenerateInviteCodeRequest_ChildTarget_ChildNameTooLong_Fails()
    {
        var v = new GenerateInviteCodeRequestValidator();
        var req = new GenerateInviteCodeRequest
        {
            TargetRole = Domain.Enums.UserRole.Child,
            TargetChildName = new string('小', 21),
            TargetDisplayMode = Domain.Enums.DisplayMode.Primary
        };
        var result = v.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TargetChildName);
    }

    [Fact]
    public void GenerateInviteCodeRequest_ChildTarget_Valid_Passes()
    {
        var v = new GenerateInviteCodeRequestValidator();
        var req = new GenerateInviteCodeRequest
        {
            TargetRole = Domain.Enums.UserRole.Child,
            TargetChildName = "小明",
            TargetDisplayMode = Domain.Enums.DisplayMode.Primary
        };
        var result = v.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("234567")]   // 有效：2-9 六位
    [InlineData("999999")]
    [InlineData("222222")]
    public void JoinByCodeRequest_ValidCode_Passes(string code)
    {
        var v = new JoinByCodeRequestValidator();
        var req = new JoinByCodeRequest { Code = code };
        var result = v.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("012345")]   // 包含 0
    [InlineData("123456")]   // 包含 1
    [InlineData("23456")]    // 长度不足
    [InlineData("2345678")]  // 长度过长
    [InlineData("abcdef")]   // 字母
    [InlineData("")]
    public void JoinByCodeRequest_InvalidCode_FailsWithInvalidInvitationCode(string code)
    {
        var v = new JoinByCodeRequestValidator();
        var req = new JoinByCodeRequest { Code = code };
        var result = v.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Code)
            .WithErrorCode(ErrorCodes.InvalidInvitationCode);
    }

    [Fact]
    public void DissolveFamilyRequest_EmptyName_FailsWithFamilyNameMismatch()
    {
        var v = new DissolveFamilyRequestValidator();
        var req = new DissolveFamilyRequest { FamilyName = "" };
        var result = v.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.FamilyName)
            .WithErrorCode(ErrorCodes.FamilyNameMismatch);
    }

    [Fact]
    public void DissolveFamilyRequest_Valid_Passes()
    {
        var v = new DissolveFamilyRequestValidator();
        var req = new DissolveFamilyRequest { FamilyName = "我们家" };
        var result = v.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void SetDisplayModeRequest_Valid_Passes()
    {
        var v = new SetDisplayModeRequestValidator();
        var req = new SetDisplayModeRequest { DisplayMode = Domain.Enums.DisplayMode.Primary };
        var result = v.TestValidate(req);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
