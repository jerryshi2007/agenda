using Agenda.Api.Auth.Dtos;
using Agenda.Api.Shared.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Agenda.Api.Infrastructure.Storage;

[ApiController]
[Route("api/v1/upload")]
[Authorize]
public class UploadController : ControllerBase
{
    private readonly IAvatarStorageService _avatarStorage;

    public UploadController(IAvatarStorageService avatarStorage)
    {
        _avatarStorage = avatarStorage;
    }

    [HttpPost("avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file, CancellationToken ct)
    {
        var url = await _avatarStorage.UploadAsync(User.GetUserId(), file, ct);
        return Ok(new UploadAvatarResponse { Url = url });
    }
}
