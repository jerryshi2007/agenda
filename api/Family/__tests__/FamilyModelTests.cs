using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Agenda.Api.Family.Tests;

/// <summary>
/// Task 1 模型层验证：实体字段、唯一索引、外键关系与 openspec/contracts/family 设计一致。
/// 测试位于 Agenda.Api.Family 命名空间内，必须通过 global alias 引用 Family / FamilyMember / InvitationCode 实体。
/// </summary>
public class FamilyModelTests
{
    private static int _dbCounter;

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"FamilyModel_{Interlocked.Increment(ref _dbCounter)}")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public void Model_Family_HasCreatorIdAndStatusColumns()
    {
        var db = CreateDbContext();
        var entity = db.Model.FindEntityType(typeof(DomainFamily))!;

        Assert.NotNull(entity.FindProperty(nameof(DomainFamily.CreatorId)));
        Assert.NotNull(entity.FindProperty(nameof(DomainFamily.Status)));
        Assert.NotNull(entity.FindProperty(nameof(DomainFamily.DissolvedAt)));
    }

    [Fact]
    public void Model_FamilyMember_HasChildNameDisplayModeSoftDeleteColumns()
    {
        var db = CreateDbContext();
        var entity = db.Model.FindEntityType(typeof(DomainFamilyMember))!;

        Assert.NotNull(entity.FindProperty(nameof(DomainFamilyMember.ChildName)));
        Assert.NotNull(entity.FindProperty(nameof(DomainFamilyMember.DisplayMode)));
        Assert.NotNull(entity.FindProperty(nameof(DomainFamilyMember.IsDeleted)));
        Assert.NotNull(entity.FindProperty(nameof(DomainFamilyMember.DeletedAt)));
    }

    [Fact]
    public void Model_InvitationCode_HasAllRequiredColumns()
    {
        var db = CreateDbContext();
        var entity = db.Model.FindEntityType(typeof(DomainInvitationCode))!;

        Assert.NotNull(entity.FindProperty(nameof(DomainInvitationCode.Code)));
        Assert.NotNull(entity.FindProperty(nameof(DomainInvitationCode.FamilyId)));
        Assert.NotNull(entity.FindProperty(nameof(DomainInvitationCode.TargetRole)));
        Assert.NotNull(entity.FindProperty(nameof(DomainInvitationCode.TargetChildName)));
        Assert.NotNull(entity.FindProperty(nameof(DomainInvitationCode.TargetDisplayMode)));
        Assert.NotNull(entity.FindProperty(nameof(DomainInvitationCode.CreatorId)));
        Assert.NotNull(entity.FindProperty(nameof(DomainInvitationCode.CreatedAt)));
        Assert.NotNull(entity.FindProperty(nameof(DomainInvitationCode.ExpiresAt)));
        Assert.NotNull(entity.FindProperty(nameof(DomainInvitationCode.Status)));
    }

    [Fact]
    public void Model_FamilyMember_HasUniqueIndexOnFamilyIdAndUserId()
    {
        var db = CreateDbContext();
        var entity = db.Model.FindEntityType(typeof(DomainFamilyMember))!;

        var uniqueIndex = entity.GetIndexes().SingleOrDefault(i => i.IsUnique
            && i.Properties.Count == 2
            && i.Properties.Any(p => p.Name == nameof(DomainFamilyMember.FamilyId))
            && i.Properties.Any(p => p.Name == nameof(DomainFamilyMember.UserId)));

        Assert.NotNull(uniqueIndex);
    }

    [Fact]
    public void Model_InvitationCode_HasUniqueIndexOnCode()
    {
        var db = CreateDbContext();
        var entity = db.Model.FindEntityType(typeof(DomainInvitationCode))!;

        var uniqueIndex = entity.GetIndexes().SingleOrDefault(i => i.IsUnique
            && i.Properties.Count == 1
            && i.Properties[0].Name == nameof(DomainInvitationCode.Code));

        Assert.NotNull(uniqueIndex);
    }

    [Fact]
    public void Model_InvitationCode_CodeIsFixedLength6()
    {
        var db = CreateDbContext();
        var entity = db.Model.FindEntityType(typeof(DomainInvitationCode))!;
        var codeProp = entity.FindProperty(nameof(DomainInvitationCode.Code))!;

        Assert.Equal(6, codeProp.GetMaxLength());
        Assert.True(codeProp.IsFixedLength());
    }
}
