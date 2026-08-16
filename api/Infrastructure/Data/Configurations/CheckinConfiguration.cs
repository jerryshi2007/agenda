using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Agenda.Api.Infrastructure.Data.Configurations;

public class CheckinConfiguration : IEntityTypeConfiguration<Domain.Entities.Checkin>
{
    public void Configure(EntityTypeBuilder<Domain.Entities.Checkin> builder)
    {
        builder.ToTable("CheckinRecords");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.ScheduleId).IsRequired();
        builder.Property(c => c.Date).IsRequired();
        builder.Property(c => c.UserId).IsRequired();
        builder.Property(c => c.CheckinAt).IsRequired();
        builder.Property(c => c.Source).IsRequired().HasConversion<int>();
        builder.Property(c => c.CreatedAt).IsRequired();

        // UNIQUE(ScheduleId, Date)：每个日程每天最多一条打卡记录（幂等最后防线）。
        // 该唯一索引同时覆盖按 (ScheduleId, Date) 查询打卡状态的查询模式。
        builder.HasIndex(c => new { c.ScheduleId, c.Date }).IsUnique();
        builder.HasIndex(c => c.UserId);
    }
}
