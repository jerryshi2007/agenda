using Agenda.Api.Auth.Dtos;
using Agenda.Api.Auth.Services;
using Agenda.Api.Domain;
using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Auth;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Auth;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IWeChatService _weChatService;
    private readonly ITokenService _tokenService;
    private readonly IFamilyQueryService _familyQueryService;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        AppDbContext db,
        IWeChatService weChatService,
        ITokenService tokenService,
        IFamilyQueryService familyQueryService,
        ILogger<AuthService> logger)
    {
        _db = db;
        _weChatService = weChatService;
        _tokenService = tokenService;
        _familyQueryService = familyQueryService;
        _logger = logger;
    }

    public async Task<LoginResponse> LoginAsync(string code, CancellationToken ct = default)
    {
        var session = await GetSessionAsync(code, ct);
        var now = DateTimeOffset.UtcNow;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.OpenId == session.OpenId, ct);

        if (user == null)
            return await CreateNewUserAsync(session.OpenId, now, ct);

        if (user.Status == UserStatus.Deleted)
        {
            var expiresAt = (user.DeletedAt ?? now).Add(DeletionPolicy.GracePeriod);
            if (expiresAt <= now)
            {
                // 注销 30 天已到期：物理删除旧账户，按新用户重建。
                _db.Users.Remove(user);
                await _db.SaveChangesAsync(ct);
                return await CreateNewUserAsync(session.OpenId, now, ct);
            }

            return new LoginResponse
            {
                Jwt = await _tokenService.GenerateTokenAsync(user.Id, ct),
                UserId = user.Id,
                IsNewUser = false,
                NeedsProfileCollection = false,
                IsDeleted = true,
                RemainingDays = ComputeRemainingDays(expiresAt, now)
            };
        }

        user.LastLoginAt = now;
        await _db.SaveChangesAsync(ct);

        return new LoginResponse
        {
            Jwt = await _tokenService.GenerateTokenAsync(user.Id, ct),
            UserId = user.Id,
            IsNewUser = false,
            NeedsProfileCollection = user.Nickname == User.DefaultNickname,
            IsDeleted = false,
            RemainingDays = null
        };
    }

    public async Task<RefreshResponse> RefreshAsync(string code, CancellationToken ct = default)
    {
        var session = await GetSessionAsync(code, ct);

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.OpenId == session.OpenId && u.Status == UserStatus.Active, ct)
            ?? throw new UnauthorizedAccessException(ErrorCodes.TokenInvalid);

        return new RefreshResponse
        {
            Jwt = await _tokenService.GenerateTokenAsync(user.Id, ct),
            UserId = user.Id
        };
    }

    public async Task<ProfileResponse> GetProfileAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new UnauthorizedAccessException(ErrorCodes.TokenInvalid);

        return ToProfileResponse(user);
    }

    public async Task<ProfileResponse> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new UnauthorizedAccessException(ErrorCodes.TokenInvalid);

        user.Nickname = request.Nickname;
        user.AvatarUrl = request.AvatarUrl;
        await _db.SaveChangesAsync(ct);

        return ToProfileResponse(user);
    }

    public async Task<DeletionStatusResponse> GetDeletionStatusAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new UnauthorizedAccessException(ErrorCodes.TokenInvalid);

        if (user.Status == UserStatus.Deleted)
        {
            var expiresAt = (user.DeletedAt ?? DateTimeOffset.UtcNow).Add(DeletionPolicy.GracePeriod);
            return new DeletionStatusResponse
            {
                IsDeleted = true,
                CanDelete = false,
                BlockReason = null,
                ExpiresAt = expiresAt,
                RemainingDays = ComputeRemainingDays(expiresAt, DateTimeOffset.UtcNow)
            };
        }

        var families = await _familyQueryService.GetUserFamiliesAsync(userId, ct);
        var hasFamily = families.Count > 0;
        return new DeletionStatusResponse
        {
            IsDeleted = false,
            CanDelete = !hasFamily,
            BlockReason = hasFamily ? ErrorCodes.FamilyStillActive : null,
            ExpiresAt = null,
            RemainingDays = null
        };
    }

    public async Task<DeletionResponse> DeleteAccountAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new UnauthorizedAccessException(ErrorCodes.TokenInvalid);

        var now = DateTimeOffset.UtcNow;

        if (user.Status == UserStatus.Deleted)
        {
            var existingExpiresAt = (user.DeletedAt ?? now).Add(DeletionPolicy.GracePeriod);
            return new DeletionResponse
            {
                ExpiresAt = existingExpiresAt,
                RemainingDays = ComputeRemainingDays(existingExpiresAt, now)
            };
        }

        var families = await _familyQueryService.GetUserFamiliesAsync(userId, ct);
        if (families.Count > 0)
            throw new FamilyStillActiveException();

        user.Status = UserStatus.Deleted;
        user.DeletedAt = now;
        await _db.SaveChangesAsync(ct);

        return new DeletionResponse
        {
            ExpiresAt = now.Add(DeletionPolicy.GracePeriod),
            RemainingDays = 30
        };
    }

    public async Task<RecoverResponse> RecoverAccountAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new UnauthorizedAccessException(ErrorCodes.TokenInvalid);

        if (user.Status == UserStatus.Active)
            throw new DomainException(ErrorCodes.NotDeleted);

        var now = DateTimeOffset.UtcNow;
        var expiresAt = (user.DeletedAt ?? now).Add(DeletionPolicy.GracePeriod);
        if (expiresAt <= now)
            throw new DomainException(ErrorCodes.Expired);

        user.Status = UserStatus.Active;
        user.DeletedAt = null;
        user.LastLoginAt = now;
        await _db.SaveChangesAsync(ct);

        return new RecoverResponse
        {
            Jwt = await _tokenService.GenerateTokenAsync(user.Id, ct),
            UserId = user.Id
        };
    }

    private async Task<LoginResponse> CreateNewUserAsync(string openId, DateTimeOffset now, CancellationToken ct)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            OpenId = openId,
            Nickname = User.DefaultNickname,
            Status = UserStatus.Active,
            CreatedAt = now,
            LastLoginAt = now
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("New user created: {UserId}", user.Id);

        return new LoginResponse
        {
            Jwt = await _tokenService.GenerateTokenAsync(user.Id, ct),
            UserId = user.Id,
            IsNewUser = true,
            NeedsProfileCollection = true,
            IsDeleted = false,
            RemainingDays = null
        };
    }

    private async Task<WeChatSession> GetSessionAsync(string code, CancellationToken ct)
    {
        try
        {
            return await _weChatService.GetSessionAsync(code, ct);
        }
        catch (WeChatApiException ex) when (ex.ErrCode is 40029 or 41008)
        {
            throw new DomainException(ErrorCodes.CodeInvalid);
        }
        catch (WeChatApiException ex) when (ex.ErrCode is 40163)
        {
            throw new DomainException(ErrorCodes.CodeExpired);
        }
    }

    private static ProfileResponse ToProfileResponse(User user) => new()
    {
        UserId = user.Id,
        Nickname = user.Nickname,
        AvatarUrl = user.AvatarUrl,
        CreatedAt = user.CreatedAt
    };

    private static int ComputeRemainingDays(DateTimeOffset expiresAt, DateTimeOffset now) =>
        Math.Max(0, (int)Math.Ceiling((expiresAt - now).TotalDays));
}
