using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class InvitationCodeConfiguration : IEntityTypeConfiguration<DomainInvitationCode>
{
    public void Configure(EntityTypeBuilder<DomainInvitationCode> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Code)
            .IsRequired()
            .HasMaxLength(6)
            .IsFixedLength();
        builder.Property(c => c.FamilyId).IsRequired();
        builder.Property(c => c.TargetRole).IsRequired().HasConversion<int>();
        builder.Property(c => c.TargetChildName).HasMaxLength(20).IsRequired(false);
        builder.Property(c => c.TargetDisplayMode).IsRequired(false);
        builder.Property(c => c.CreatorId).IsRequired();
        builder.Property(c => c.CreatedAt).IsRequired();
        builder.Property(c => c.ExpiresAt).IsRequired();
        builder.Property(c => c.Status).IsRequired().HasConversion<int>();

        // 邀请码全局唯一。
        builder.HasIndex(c => c.Code).IsUnique();
        builder.HasIndex(c => c.FamilyId);
        builder.HasIndex(c => c.CreatorId);

        builder.HasOne(c => c.Family)
            .WithMany(f => f.InvitationCodes)
            .HasForeignKey(c => c.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Creator)
            .WithMany()
            .HasForeignKey(c => c.CreatorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
