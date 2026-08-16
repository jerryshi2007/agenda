using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Agenda.Api.Infrastructure.Storage.Tests;

public class AvatarStorageServiceTests : IDisposable
{
    private readonly string _rootPath;
    private readonly AvatarStorageService _service;

    public AvatarStorageServiceTests()
    {
        _rootPath = Path.Combine(Path.GetTempPath(), $"avatar-test-{Guid.NewGuid():N}");
        var options = Options.Create(new StorageOptions
        {
            AvatarRootPath = _rootPath,
            AvatarBaseUrl = "https://cdn.example.com/avatars"
        });
        _service = new AvatarStorageService(options, NullLogger<AvatarStorageService>.Instance);
    }

    public void Dispose()
    {
        if (Directory.Exists(_rootPath))
            Directory.Delete(_rootPath, recursive: true);
    }

    private static IFormFile CreateFile(string fileName, int length)
    {
        var content = new byte[length];
        return new FormFile(new MemoryStream(content), 0, length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/octet-stream"
        };
    }

    [Fact]
    public async Task UploadAsync_ValidPng_SavesFileAndReturnsUrl()
    {
        var userId = Guid.NewGuid();

        var url = await _service.UploadAsync(userId, CreateFile("avatar.png", 100));

        Assert.Equal($"https://cdn.example.com/avatars/{userId}.png", url);
        Assert.True(File.Exists(Path.Combine(_rootPath, $"{userId}.png")));
    }

    [Fact]
    public async Task UploadAsync_InvalidFormat_ThrowsFileFormatInvalid()
    {
        var ex = await Assert.ThrowsAsync<DomainException>(
            () => _service.UploadAsync(Guid.NewGuid(), CreateFile("avatar.txt", 100)));

        Assert.Equal(ErrorCodes.FileFormatInvalid, ex.ErrorCode);
    }

    [Fact]
    public async Task UploadAsync_TooLarge_ThrowsFileTooLarge()
    {
        var ex = await Assert.ThrowsAsync<DomainException>(
            () => _service.UploadAsync(Guid.NewGuid(), CreateFile("avatar.png", 2 * 1024 * 1024 + 1)));

        Assert.Equal(ErrorCodes.FileTooLarge, ex.ErrorCode);
    }

    [Fact]
    public async Task DeleteAsync_RemovesFile()
    {
        var userId = Guid.NewGuid();
        await _service.UploadAsync(userId, CreateFile("avatar.png", 100));
        var path = Path.Combine(_rootPath, $"{userId}.png");
        Assert.True(File.Exists(path));

        await _service.DeleteAsync(userId);

        Assert.False(File.Exists(path));
    }
}
