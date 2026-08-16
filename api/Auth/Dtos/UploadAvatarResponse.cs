namespace Agenda.Api.Auth.Dtos;

public record UploadAvatarResponse
{
    public string Url { get; init; } = string.Empty;
}
