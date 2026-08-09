using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class ScheduleConfiguration : IEntityTypeConfiguration<Domain.Entities.Schedule>
{
    public void Configure(EntityTypeBuilder<Domain.Entities.Schedule> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Name).IsRequired().HasMaxLength(50);
        builder.Property(e => e.ScheduleType).IsRequired().HasConversion<int>();
        builder.Property(e => e.FamilyId).IsRequired();
        builder.Property(e => e.AssignedChildId).IsRequired();
        builder.Property(e => e.CreatedBy).IsRequired();
        builder.Property(e => e.GroupKey).IsRequired();
        builder.Property(e => e.Notes).HasMaxLength(500);
        builder.Property(e => e.Location).HasMaxLength(100);
        builder.Property(e => e.RowVersion).IsRowVersion();
        builder.Property(e => e.IsDeleted).IsRequired().HasDefaultValue(false);
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();

        builder.HasIndex(e => e.FamilyId);
        builder.HasIndex(e => e.AssignedChildId);
        builder.HasIndex(e => new { e.FamilyId, e.AssignedChildId });
        builder.HasIndex(e => e.GroupKey);

        builder.HasMany(e => e.TimeSlots)
            .WithOne(t => t.Schedule)
            .HasForeignKey(t => t.ScheduleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.Cancellations)
            .WithOne(c => c.Schedule)
            .HasForeignKey(c => c.ScheduleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.DateExclusions)
            .WithOne(d => d.Schedule)
            .HasForeignKey(d => d.ScheduleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.SourceSchedule)
            .WithMany(e => e.DerivativeEvents)
            .HasForeignKey(e => e.SourceScheduleId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
