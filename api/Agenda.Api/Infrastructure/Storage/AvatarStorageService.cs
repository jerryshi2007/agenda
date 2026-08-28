using Agenda.Api.Infrastructure;
using Microsoft.Extensions.Options;

namespace Agenda.Api.Infrastructure.Storage;

public class AvatarStorageService : IAvatarStorageService
{
    private const long MaxFileSize = 2 * 1024 * 1024;
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".gif"];

    private readonly StorageOptions _options;
    private readonly ILogger<AvatarStorageService> _logger;

    public AvatarStorageService(IOptions<StorageOptions> options, ILogger<AvatarStorageService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> UploadAsync(Guid userId, IFormFile file, CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
            throw new DomainException(ErrorCodes.FileFormatInvalid);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            throw new DomainException(ErrorCodes.FileFormatInvalid);

        if (file.Length > MaxFileSize)
            throw new DomainException(ErrorCodes.FileTooLarge);

        // 清理旧头像（扩展名可能不同），避免残留孤儿文件。
        await DeleteAsync(userId, ct);

        Directory.CreateDirectory(_options.AvatarRootPath);

        var fileName = $"{userId}{ext}";
        var path = Path.Combine(_options.AvatarRootPath, fileName);

        await using var stream = new FileStream(path, FileMode.Create, FileAccess.Write);
        await file.CopyToAsync(stream, ct);

        return $"{_options.AvatarBaseUrl.TrimEnd('/')}/{fileName}";
    }

    public Task DeleteAsync(Guid userId, CancellationToken ct = default)
    {
        foreach (var ext in AllowedExtensions)
        {
            var path = Path.Combine(_options.AvatarRootPath, $"{userId}{ext}");
            if (File.Exists(path))
            {
                File.Delete(path);
                _logger.LogInformation("Deleted avatar file {FileName}", $"{userId}{ext}");
            }
        }

        return Task.CompletedTask;
    }
}
