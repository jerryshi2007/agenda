using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);
        builder.Property(u => u.OpenId).IsRequired().HasMaxLength(64);
        builder.HasIndex(u => u.OpenId).IsUnique();
        builder.Property(u => u.Nickname).IsRequired().HasMaxLength(20).HasDefaultValue(User.DefaultNickname);
        builder.Property(u => u.AvatarUrl).HasMaxLength(500);
        builder.Property(u => u.Status).IsRequired().HasConversion<int>().HasDefaultValue(UserStatus.Active);
        builder.Property(u => u.Role).IsRequired().HasConversion<int>();
    }
}
