using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class ScheduleDateExclusionConfiguration : IEntityTypeConfiguration<ScheduleDateExclusion>
{
    public void Configure(EntityTypeBuilder<ScheduleDateExclusion> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.ScheduleId).IsRequired();
        builder.Property(e => e.ExcludedDate).IsRequired();
        builder.Property(e => e.ExcludedBy).IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();

        builder.HasIndex(e => new { e.ScheduleId, e.ExcludedDate }).IsUnique();
        builder.HasIndex(e => e.ScheduleId);
    }
}
