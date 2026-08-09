using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class TimeSlotConfiguration : IEntityTypeConfiguration<TimeSlot>
{
    public void Configure(EntityTypeBuilder<TimeSlot> builder)
    {
        builder.HasKey(t => t.Id);
        builder.Property(t => t.ScheduleId).IsRequired();
        builder.Property(t => t.DayOfWeek).IsRequired().HasConversion<int>();
        builder.Property(t => t.StartTime).IsRequired();
        builder.Property(t => t.EndTime).IsRequired();

        builder.HasIndex(t => new { t.ScheduleId, t.DayOfWeek }).IsUnique();
        builder.HasIndex(t => t.ScheduleId);
    }
}
