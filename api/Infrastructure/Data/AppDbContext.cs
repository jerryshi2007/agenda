using Agenda.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Family> Families => Set<Family>();
    public DbSet<FamilyMember> FamilyMembers => Set<FamilyMember>();
    public DbSet<Domain.Entities.Schedule> Schedules => Set<Domain.Entities.Schedule>();
    public DbSet<TimeSlot> TimeSlots => Set<TimeSlot>();
    public DbSet<Cancellation> Cancellations => Set<Cancellation>();
    public DbSet<ScheduleDateExclusion> ScheduleDateExclusions => Set<ScheduleDateExclusion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
