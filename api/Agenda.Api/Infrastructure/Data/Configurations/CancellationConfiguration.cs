using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class CancellationConfiguration : IEntityTypeConfiguration<Cancellation>
{
    public void Configure(EntityTypeBuilder<Cancellation> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.ScheduleId).IsRequired();
        builder.Property(c => c.CancelDate).IsRequired();
        builder.Property(c => c.CancelledBy).IsRequired();
        builder.Property(c => c.CancelledAt).IsRequired();

        builder.HasIndex(c => new { c.ScheduleId, c.CancelDate }).IsUnique();
        builder.HasIndex(c => c.ScheduleId);
    }
}
