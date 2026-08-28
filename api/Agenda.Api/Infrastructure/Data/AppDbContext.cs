using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<DomainFamily> Families => Set<DomainFamily>();
    public DbSet<DomainFamilyMember> FamilyMembers => Set<DomainFamilyMember>();
    public DbSet<DomainInvitationCode> InvitationCodes => Set<DomainInvitationCode>();
    public DbSet<Domain.Entities.Schedule> Schedules => Set<Domain.Entities.Schedule>();
    public DbSet<TimeSlot> TimeSlots => Set<TimeSlot>();
    public DbSet<Cancellation> Cancellations => Set<Cancellation>();
    public DbSet<ScheduleDateExclusion> ScheduleDateExclusions => Set<ScheduleDateExclusion>();
    public DbSet<CheckinSettlement> CheckinSettlements => Set<CheckinSettlement>();
    public DbSet<Streak> Streaks => Set<Streak>();
    public DbSet<Domain.Entities.Checkin> Checkins => Set<Domain.Entities.Checkin>();
    public DbSet<DomainTemplate> Templates => Set<DomainTemplate>();
    public DbSet<DomainTemplateTimeSlot> TemplateTimeSlots => Set<DomainTemplateTimeSlot>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
