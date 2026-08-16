using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class StreakConfiguration : IEntityTypeConfiguration<Streak>
{
    public void Configure(EntityTypeBuilder<Streak> builder)
    {
        builder.ToTable("Streaks");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Scope).IsRequired().HasConversion<int>();
        builder.Property(s => s.SubjectId).IsRequired();
        builder.Property(s => s.CurrentStreak).IsRequired().HasDefaultValue(0);
        builder.Property(s => s.UpdatedAt).IsRequired();

        // UNIQUE(Scope, SubjectId)：每个聚合主体一条 streak 记录。
        builder.HasIndex(s => new { s.Scope, s.SubjectId }).IsUnique();
    }
}
