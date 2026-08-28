using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class FamilyConfiguration : IEntityTypeConfiguration<DomainFamily>
{
    public void Configure(EntityTypeBuilder<DomainFamily> builder)
    {
        builder.HasKey(f => f.Id);
        builder.Property(f => f.Name).IsRequired().HasMaxLength(50);
        builder.Property(f => f.CreatorId).IsRequired();
        builder.Property(f => f.Status)
            .IsRequired()
            .HasConversion<int>()
            .HasDefaultValue(FamilyStatus.Normal);
        builder.Property(f => f.DissolvedAt).IsRequired(false);

        builder.HasIndex(f => f.CreatorId);
    }
}
