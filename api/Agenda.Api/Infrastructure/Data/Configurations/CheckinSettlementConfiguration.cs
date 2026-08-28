using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class CheckinSettlementConfiguration : IEntityTypeConfiguration<CheckinSettlement>
{
    public void Configure(EntityTypeBuilder<CheckinSettlement> builder)
    {
        builder.ToTable("CheckinSettlements");
        builder.HasKey(cs => cs.Id);
        builder.Property(cs => cs.ScheduleId).IsRequired();
        builder.Property(cs => cs.Date).IsRequired();
        builder.Property(cs => cs.Status).IsRequired().HasConversion<int>();
        builder.Property(cs => cs.SettledAt).IsRequired();

        // UNIQUE(ScheduleId, Date)：每个实例最多一条结算记录（幂等锚点）。
        // 该唯一索引同时覆盖按 (ScheduleId, Date) 查询结算状态的查询模式。
        builder.HasIndex(cs => new { cs.ScheduleId, cs.Date }).IsUnique();
    }
}
