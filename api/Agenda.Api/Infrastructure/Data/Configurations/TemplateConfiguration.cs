using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class TemplateConfiguration : IEntityTypeConfiguration<DomainTemplate>
{
    public void Configure(EntityTypeBuilder<DomainTemplate> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Name).IsRequired().HasMaxLength(50);
        builder.Property(e => e.ScheduleType).IsRequired().HasConversion<int>();
        builder.Property(e => e.FamilyId).IsRequired(false);
        builder.Property(e => e.CreatedBy).IsRequired();
        builder.Property(e => e.IsPreset).IsRequired().HasDefaultValue(false);
        builder.Property(e => e.IsDeleted).IsRequired().HasDefaultValue(false);
        builder.Property(e => e.RepeatEndDate);
        builder.Property(e => e.Location).HasMaxLength(100);
        builder.Property(e => e.Notes).HasMaxLength(500);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();

        builder.HasIndex(e => e.FamilyId);
        builder.HasIndex(e => e.CreatedBy);
        builder.HasIndex(e => e.IsPreset);
        builder.HasIndex(e => new { e.FamilyId, e.Name })
            .IsUnique()
            .HasFilter("\"IsPreset\" = false AND \"IsDeleted\" = false");

        builder.HasMany(e => e.TimeSlots)
            .WithOne(ts => ts.Template)
            .HasForeignKey(ts => ts.TemplateId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
