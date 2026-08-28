using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class FamilyMemberConfiguration : IEntityTypeConfiguration<DomainFamilyMember>
{
    public void Configure(EntityTypeBuilder<DomainFamilyMember> builder)
    {
        builder.HasKey(fm => fm.Id);
        builder.Property(fm => fm.FamilyId).IsRequired();
        builder.Property(fm => fm.UserId).IsRequired();
        builder.Property(fm => fm.Role).IsRequired().HasConversion<int>();
        builder.Property(fm => fm.JoinedAt).IsRequired();
        builder.Property(fm => fm.ChildName).HasMaxLength(20).IsRequired(false);
        builder.Property(fm => fm.DisplayMode)
            .IsRequired()
            .HasConversion<int>()
            .HasDefaultValue(DisplayMode.Primary);
        builder.Property(fm => fm.IsDeleted).IsRequired().HasDefaultValue(false);
        builder.Property(fm => fm.DeletedAt).IsRequired(false);

        builder.HasIndex(fm => new { fm.FamilyId, fm.UserId }).IsUnique();
        builder.HasIndex(fm => fm.UserId);

        builder.HasOne(fm => fm.Family)
            .WithMany(f => f.Members)
            .HasForeignKey(fm => fm.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(fm => fm.User)
            .WithMany()
            .HasForeignKey(fm => fm.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
