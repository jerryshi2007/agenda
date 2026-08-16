using Agenda.Api.Auth.Dtos;
using Agenda.Api.Auth.Validators;
using Agenda.Api.Shared.Extensions;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Agenda.Api.Auth;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IFamilyQueryService _familyQueryService;
    private readonly IValidator<LoginRequest> _loginValidator;
    private readonly IValidator<UpdateProfileRequest> _updateProfileValidator;

    public AuthController(
        IAuthService authService,
        IFamilyQueryService familyQueryService,
        IValidator<LoginRequest> loginValidator,
        IValidator<UpdateProfileRequest> updateProfileValidator)
    {
        _authService = authService;
        _familyQueryService = familyQueryService;
        _loginValidator = loginValidator;
        _updateProfileValidator = updateProfileValidator;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        await _loginValidator.ValidateAndThrowAsync(request, ct);
        return Ok(await _authService.LoginAsync(request.Code, ct));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request, CancellationToken ct)
    {
        await _loginValidator.ValidateAndThrowAsync(new LoginRequest { Code = request.Code }, ct);
        return Ok(await _authService.RefreshAsync(request.Code, ct));
    }

    [HttpGet("profile")]
    [Authorize]
    public async Task<IActionResult> GetProfile(CancellationToken ct)
        => Ok(await _authService.GetProfileAsync(User.GetUserId(), ct));

    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken ct)
    {
        await _updateProfileValidator.ValidateAndThrowAsync(request, ct);
        return Ok(await _authService.UpdateProfileAsync(User.GetUserId(), request, ct));
    }

    [HttpGet("deletion-status")]
    [Authorize]
    public async Task<IActionResult> GetDeletionStatus(CancellationToken ct)
        => Ok(await _authService.GetDeletionStatusAsync(User.GetUserId(), ct));

    [HttpPost("deletion")]
    [Authorize]
    public async Task<IActionResult> DeleteAccount(CancellationToken ct)
        => Ok(await _authService.DeleteAccountAsync(User.GetUserId(), ct));

    [HttpPost("deletion/recover")]
    [Authorize]
    public async Task<IActionResult> RecoverAccount(CancellationToken ct)
        => Ok(await _authService.RecoverAccountAsync(User.GetUserId(), ct));

    [HttpGet("/api/v1/users/me/families")]
    [Authorize]
    public async Task<IActionResult> GetMyFamilies(CancellationToken ct)
    {
        var families = await _familyQueryService.GetUserFamiliesAsync(User.GetUserId(), ct);
        return Ok(new UserFamiliesResponse { Families = families });
    }
}
