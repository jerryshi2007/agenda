using Agenda.Api.Auth.Dtos;
using Agenda.Api.Auth.Services;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Family.Dtos;
using Agenda.Api.Domain.Entities;
using Agenda.Api.Infrastructure;
using Agenda.Api.Infrastructure.Auth;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Agenda.Api.Auth.Tests;

public class AuthServiceTests
{
    private const string OpenId = "openid-123";

    private static int _dbCounter;

    private AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"AuthTest_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Mock<IWeChatService> CreateWeChatMock()
    {
        var mock = new Mock<IWeChatService>();
        mock.Setup(w => w.GetSessionAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeChatSession(OpenId, "session-key", null));
        return mock;
    }

    private static Mock<ITokenService> CreateTokenMock()
    {
        var mock = new Mock<ITokenService>();
        mock.Setup(t => t.GenerateTokenAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("test-jwt");
        return mock;
    }

    private static Mock<IFamilyQueryService> CreateFamilyMock(bool hasFamily = false)
    {
        var mock = new Mock<IFamilyQueryService>();
        var families = hasFamily
            ? new List<FamilyInfo>
            {
                new() { FamilyId = Guid.NewGuid(), FamilyName = "我家", Role = UserRole.Parent, MemberCount = 2 }
            }
            : new List<FamilyInfo>();
        mock.Setup(f => f.GetUserFamiliesAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(families);
        return mock;
    }

    private static AuthService CreateService(
        AppDbContext db,
        Mock<IWeChatService> weChat,
        Mock<IFamilyQueryService> family) =>
        new(db, weChat.Object, CreateTokenMock().Object, family.Object, NullLogger<AuthService>.Instance);

    private static async Task<User> SeedUserAsync(
        AppDbContext db,
        UserStatus status = UserStatus.Active,
        DateTimeOffset? deletedAt = null,
        string? nickname = null)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            OpenId = OpenId,
            Nickname = nickname ?? User.DefaultNickname,
            Status = status,
            DeletedAt = deletedAt,
            CreatedAt = DateTimeOffset.UtcNow,
            LastLoginAt = DateTimeOffset.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task LoginAsync_NewUser_CreatesUserAndReturnsNewUserFlag()
    {
        var db = CreateDbContext();
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.LoginAsync("code");

        Assert.True(result.IsNewUser);
        Assert.True(result.NeedsProfileCollection);
        Assert.Equal("test-jwt", result.Jwt);
        Assert.Single(db.Users);
        Assert.Equal(OpenId, db.Users.Single().OpenId);
    }

    [Fact]
    public async Task LoginAsync_ExistingActiveUser_ReturnsNotNewUser()
    {
        var db = CreateDbContext();
        await SeedUserAsync(db, nickname: "小明");
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.LoginAsync("code");

        Assert.False(result.IsNewUser);
        Assert.False(result.NeedsProfileCollection);
        Assert.False(result.IsDeleted);
    }

    [Fact]
    public async Task LoginAsync_InvalidCode_ThrowsCodeInvalid()
    {
        var db = CreateDbContext();
        var weChat = new Mock<IWeChatService>();
        weChat.Setup(w => w.GetSessionAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new WeChatApiException(40029, "invalid code"));
        var service = CreateService(db, weChat, CreateFamilyMock());

        var ex = await Assert.ThrowsAsync<DomainException>(() => service.LoginAsync("bad-code"));

        Assert.Equal(ErrorCodes.CodeInvalid, ex.ErrorCode);
    }

    [Fact]
    public async Task LoginAsync_ExpiredCode_ThrowsCodeExpired()
    {
        var db = CreateDbContext();
        var weChat = new Mock<IWeChatService>();
        weChat.Setup(w => w.GetSessionAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new WeChatApiException(40163, "code been used"));
        var service = CreateService(db, weChat, CreateFamilyMock());

        var ex = await Assert.ThrowsAsync<DomainException>(() => service.LoginAsync("used-code"));

        Assert.Equal(ErrorCodes.CodeExpired, ex.ErrorCode);
    }

    [Fact]
    public async Task LoginAsync_DeletedUserExpired_RecreatesUser()
    {
        var db = CreateDbContext();
        var old = await SeedUserAsync(db, UserStatus.Deleted, DateTimeOffset.UtcNow.AddDays(-31));
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.LoginAsync("code");

        Assert.True(result.IsNewUser);
        Assert.Single(db.Users);
        Assert.NotEqual(old.Id, db.Users.Single().Id);
    }

    [Fact]
    public async Task LoginAsync_DeletedUserNotExpired_ReturnsIsDeleted()
    {
        var db = CreateDbContext();
        await SeedUserAsync(db, UserStatus.Deleted, DateTimeOffset.UtcNow.AddDays(-10));
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.LoginAsync("code");

        Assert.True(result.IsDeleted);
        Assert.Equal(20, result.RemainingDays);
    }

    [Fact]
    public async Task RefreshAsync_ActiveUser_ReturnsJwt()
    {
        var db = CreateDbContext();
        await SeedUserAsync(db);
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.RefreshAsync("code");

        Assert.Equal("test-jwt", result.Jwt);
    }

    [Fact]
    public async Task RefreshAsync_NonActiveUser_ThrowsUnauthorized()
    {
        var db = CreateDbContext();
        await SeedUserAsync(db, UserStatus.Deleted);
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.RefreshAsync("code"));
    }

    [Fact]
    public async Task GetProfileAsync_ExistingUser_ReturnsProfile()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db, nickname: "小明");
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.GetProfileAsync(user.Id);

        Assert.Equal(user.Id, result.UserId);
        Assert.Equal("小明", result.Nickname);
    }

    [Fact]
    public async Task UpdateProfileAsync_UpdatesNicknameAndAvatar()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db, nickname: "小明");
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.UpdateProfileAsync(user.Id, new UpdateProfileRequest
        {
            Nickname = "小红",
            AvatarUrl = "https://example.com/a.png"
        });

        Assert.Equal("小红", result.Nickname);
        Assert.Equal("https://example.com/a.png", result.AvatarUrl);
    }

    [Fact]
    public async Task GetDeletionStatusAsync_ActiveNoFamily_CanDelete()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.GetDeletionStatusAsync(user.Id);

        Assert.False(result.IsDeleted);
        Assert.True(result.CanDelete);
        Assert.Null(result.BlockReason);
    }

    [Fact]
    public async Task GetDeletionStatusAsync_ActiveWithFamily_Blocked()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock(hasFamily: true));

        var result = await service.GetDeletionStatusAsync(user.Id);

        Assert.False(result.CanDelete);
        Assert.Equal(ErrorCodes.FamilyStillActive, result.BlockReason);
    }

    [Fact]
    public async Task GetDeletionStatusAsync_Deleted_IsDeleted()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db, UserStatus.Deleted, DateTimeOffset.UtcNow.AddDays(-5));
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.GetDeletionStatusAsync(user.Id);

        Assert.True(result.IsDeleted);
        Assert.Equal(25, result.RemainingDays);
    }

    [Fact]
    public async Task DeleteAccountAsync_NoFamily_MarksDeleted()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.DeleteAccountAsync(user.Id);

        Assert.Equal(30, result.RemainingDays);
        var persisted = await db.Users.SingleAsync();
        Assert.Equal(UserStatus.Deleted, persisted.Status);
        Assert.NotNull(persisted.DeletedAt);
    }

    [Fact]
    public async Task DeleteAccountAsync_WithFamily_ThrowsFamilyStillActive()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock(hasFamily: true));

        var ex = await Assert.ThrowsAsync<FamilyStillActiveException>(
            () => service.DeleteAccountAsync(user.Id));

        Assert.Equal(ErrorCodes.FamilyStillActive, ex.ErrorCode);
    }

    [Fact]
    public async Task DeleteAccountAsync_AlreadyDeleted_Idempotent()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db, UserStatus.Deleted, DateTimeOffset.UtcNow.AddDays(-5));
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.DeleteAccountAsync(user.Id);

        Assert.Equal(25, result.RemainingDays);
    }

    [Fact]
    public async Task RecoverAccountAsync_DeletedNotExpired_Restores()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db, UserStatus.Deleted, DateTimeOffset.UtcNow.AddDays(-5));
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var result = await service.RecoverAccountAsync(user.Id);

        Assert.Equal("test-jwt", result.Jwt);
        var persisted = await db.Users.SingleAsync();
        Assert.Equal(UserStatus.Active, persisted.Status);
        Assert.Null(persisted.DeletedAt);
    }

    [Fact]
    public async Task RecoverAccountAsync_Active_ThrowsNotDeleted()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db);
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var ex = await Assert.ThrowsAsync<DomainException>(() => service.RecoverAccountAsync(user.Id));

        Assert.Equal(ErrorCodes.NotDeleted, ex.ErrorCode);
    }

    [Fact]
    public async Task RecoverAccountAsync_Expired_ThrowsExpired()
    {
        var db = CreateDbContext();
        var user = await SeedUserAsync(db, UserStatus.Deleted, DateTimeOffset.UtcNow.AddDays(-31));
        var service = CreateService(db, CreateWeChatMock(), CreateFamilyMock());

        var ex = await Assert.ThrowsAsync<DomainException>(() => service.RecoverAccountAsync(user.Id));

        Assert.Equal(ErrorCodes.Expired, ex.ErrorCode);
    }
}
