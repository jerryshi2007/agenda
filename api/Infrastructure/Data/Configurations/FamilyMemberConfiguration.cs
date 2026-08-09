using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class FamilyMemberConfiguration : IEntityTypeConfiguration<FamilyMember>
{
    public void Configure(EntityTypeBuilder<FamilyMember> builder)
    {
        builder.HasKey(fm => fm.Id);
        builder.Property(fm => fm.FamilyId).IsRequired();
        builder.Property(fm => fm.UserId).IsRequired();
        builder.Property(fm => fm.Role).IsRequired().HasConversion<int>();

        builder.HasIndex(fm => new { fm.FamilyId, fm.UserId }).IsUnique();
        builder.HasIndex(fm => fm.UserId);

        builder.HasOne(fm => fm.Family)
            .WithMany()
            .HasForeignKey(fm => fm.FamilyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(fm => fm.User)
            .WithMany()
            .HasForeignKey(fm => fm.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
