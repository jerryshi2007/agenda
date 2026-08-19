using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class TemplateTimeSlotConfiguration : IEntityTypeConfiguration<TemplateTimeSlot>
{
    public void Configure(EntityTypeBuilder<TemplateTimeSlot> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.TemplateId).IsRequired();
        builder.Property(e => e.DayOfWeek).IsRequired().HasConversion<int>();
        builder.Property(e => e.StartTime).IsRequired();
        builder.Property(e => e.EndTime).IsRequired();

        builder.HasIndex(e => new { e.TemplateId, e.DayOfWeek }).IsUnique();
        builder.HasIndex(e => e.TemplateId);
    }
}
