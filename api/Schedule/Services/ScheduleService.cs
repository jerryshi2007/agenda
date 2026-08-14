using Agenda.Api.Domain.Entities;
using Agenda.Api.Domain.Enums;
using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Agenda.Api.Schedule.Services;

public class ScheduleService : IScheduleService
{
    private readonly AppDbContext _db;
    private readonly ILogger<ScheduleService> _logger;

    public ScheduleService(AppDbContext db, ILogger<ScheduleService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<CreateScheduleResponse> CreateAsync(
        Guid familyId, Guid createdBy, CreateScheduleRequest request, CancellationToken ct = default)
    {
        if (!Enum.TryParse<ScheduleType>(request.ScheduleType, out var scheduleType))
            throw new InvalidOperationException("SCHEDULE_TYPE_INVALID");

        ValidateCreateRequest(scheduleType, request);

        var groupKey = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var schedules = new List<Domain.Entities.Schedule>();

        using var transaction = await _db.Database.BeginTransactionAsync(ct);

        try
        {
            foreach (var childId in request.ChildIds)
            {
                var schedule = new Domain.Entities.Schedule
                {
                    Id = Guid.NewGuid(),
                    Name = request.Name,
                    ScheduleType = scheduleType,
                    FamilyId = familyId,
                    AssignedChildId = childId,
                    CreatedBy = createdBy,
                    GroupKey = groupKey,
                    RepeatEndDate = scheduleType == ScheduleType.HomeworkTask ? null : request.RepeatEndDate,
                    Location = request.Location,
                    Notes = request.Notes,
                    DueDate = scheduleType == ScheduleType.HomeworkTask ? request.DueDate : null,
                    SuggestedStartTime = scheduleType == ScheduleType.HomeworkTask ? request.SuggestedStartTime : null,
                    SuggestedEndTime = scheduleType == ScheduleType.HomeworkTask ? request.SuggestedEndTime : null,
                    RowVersion = Guid.NewGuid().ToByteArray(),
                    IsDeleted = false,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                if (scheduleType != ScheduleType.HomeworkTask)
                {
                    foreach (var ts in request.TimeSlots)
                    {
                        schedule.TimeSlots.Add(new TimeSlot
                        {
                            ScheduleId = schedule.Id,
                            DayOfWeek = ts.DayOfWeek,
                            StartTime = ts.StartTime,
                            EndTime = ts.EndTime
                        });
                    }
                }

                _db.Schedules.Add(schedule);
                schedules.Add(schedule);
            }

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create schedule for family {FamilyId}, group {GroupKey}", familyId, groupKey);
            await transaction.RollbackAsync(ct);
            throw;
        }

        var response = new CreateScheduleResponse
        {
            GroupKey = groupKey,
            Schedules = schedules.Select(s => new ScheduleSummary
            {
                ScheduleId = s.Id,
                AssignedChildId = s.AssignedChildId,
                Name = s.Name,
                ScheduleType = s.ScheduleType.ToString(),
                TimeSlots = s.TimeSlots.Select(t => new TimeSlotDto
                {
                    DayOfWeek = t.DayOfWeek,
                    StartTime = t.StartTime,
                    EndTime = t.EndTime
                }).ToList(),
                RepeatEndDate = s.RepeatEndDate,
                Location = s.Location,
                Notes = s.Notes,
                CreatedAt = s.CreatedAt
            }).ToList()
        };

        return response;
    }

    public async Task<ScheduleResponse?> GetByIdAsync(
        Guid scheduleId, DateOnly? date, Guid userId, Guid familyId, Domain.Enums.UserRole role, CancellationToken ct = default)
    {
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.Today);

        var schedule = await _db.Schedules
            .Include(e => e.TimeSlots)
            .Include(e => e.Cancellations)
            .Include(e => e.DateExclusions)
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == scheduleId && e.FamilyId == familyId && !e.IsDeleted, ct);

        if (schedule == null) return null;

        // Check for derivative schedule (ThisOnly edit creates a derivative with OverrideDate)
        if (date.HasValue)
        {
            var derivative = await _db.Schedules
                .Include(e => e.TimeSlots)
                .Include(e => e.Cancellations)
                .Include(e => e.DateExclusions)
                .AsNoTracking()
                .FirstOrDefaultAsync(e =>
                    e.SourceScheduleId == scheduleId &&
                    e.FamilyId == familyId &&
                    !e.IsDeleted &&
                    e.OverrideDate == targetDate, ct);

            if (derivative != null)
                schedule = derivative;
        }

        // 孩子端只能看自己的数据
        if (role == Domain.Enums.UserRole.Child && schedule.AssignedChildId != userId)
            throw new UnauthorizedAccessException("CHILD_ACCESS_DENIED");

        // Resolve child name (IM-4)
        string? assignedChildName = null;
        if (schedule.AssignedChildId != Guid.Empty)
        {
            var childUser = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == schedule.AssignedChildId, ct);
            assignedChildName = childUser?.Nickname;
        }

        var isCancelled = schedule.Cancellations.Any(c => c.CancelDate == targetDate);
        var isExcluded = schedule.DateExclusions.Any(d => d.ExcludedDate == targetDate);

        var status = ScheduleStatusHelper.DeriveInstanceStatus(schedule, targetDate, isCancelled, isExcluded);

        var canEdit = role == Domain.Enums.UserRole.Parent;
        var canCancel = role == Domain.Enums.UserRole.Parent && schedule.ScheduleType != ScheduleType.HomeworkTask && !isCancelled;
        var canDelete = role == Domain.Enums.UserRole.Parent;
        var canCheckin = !isCancelled && !isExcluded && status == "incomplete";
        var canUndo = isCancelled || isExcluded;

        return new ScheduleResponse
        {
            ScheduleId = schedule.Id,
            Name = schedule.Name,
            ScheduleType = schedule.ScheduleType.ToString(),
            Date = targetDate,
            TimeSlots = schedule.TimeSlots.Select(t => new TimeSlotDto
            {
                DayOfWeek = t.DayOfWeek,
                StartTime = t.StartTime,
                EndTime = t.EndTime
            }).ToList(),
            RepeatEndDate = schedule.RepeatEndDate,
            RepeatRule = BuildRepeatRule(schedule),
            Location = schedule.Location,
            AssignedChildId = schedule.AssignedChildId,
            AssignedChildName = assignedChildName,
            Notes = schedule.Notes,
            InstanceStatus = status,
            IsCancelled = isCancelled,
            IsExcluded = isExcluded,
            CanEdit = canEdit,
            CanCancel = canCancel,
            CanDelete = canDelete,
            CanCheckin = canCheckin,
            CanUndo = canUndo,
            RowVersion = Convert.ToBase64String(schedule.RowVersion),
            DueDate = schedule.DueDate,
            SuggestedStartTime = schedule.SuggestedStartTime,
            SuggestedEndTime = schedule.SuggestedEndTime
        };
    }

    public async Task<UpdateScheduleResponse> UpdateAsync(
        Guid scheduleId, UpdateScheduleRequest request, Guid userId, Guid familyId, CancellationToken ct = default)
    {
        ValidateUpdateRequest(request);

        var scope = request.Scope ?? "ThisOnly";

        var schedule = await _db.Schedules
            .Include(e => e.TimeSlots)
            .FirstOrDefaultAsync(e => e.Id == scheduleId && e.FamilyId == familyId && !e.IsDeleted, ct)
            ?? throw new KeyNotFoundException("SCHEDULE_NOT_FOUND");

        // Optimistic lock check
        if (request.RowVersion != null && request.RowVersion.Length > 0)
        {
            if (!schedule.RowVersion.SequenceEqual(request.RowVersion))
                throw new InvalidOperationException("CONCURRENT_EDIT_CONFLICT");
        }

        using var transaction = await _db.Database.BeginTransactionAsync(ct);

        try
        {
            if (scope == "ThisOnly")
            {
                // Create derivative Schedule with OverrideDate (ADR-018, IM-7)
                CreateDerivativeSchedule(schedule, request, userId);
            }
            else // ThisAndFuture
            {
                UpdateScheduleFields(schedule, request);
                await UpdateTimeSlotsAsync(schedule, request, ct);
                // Delete future derivative schedules
                await DeleteFutureDerivativesAsync(schedule.Id, request.Date, ct);
            }

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update schedule {ScheduleId} for family {FamilyId}, scope {Scope}",
                scheduleId, familyId, scope);
            await transaction.RollbackAsync(ct);
            throw;
        }

        return new UpdateScheduleResponse
        {
            ScheduleId = scheduleId,
            Scope = scope,
            Updated = true
        };
    }

    public async Task<DeleteScheduleResponse> DeleteAsync(
        Guid scheduleId, string scope, DateOnly? date, Guid userId, Guid familyId, bool force = false, CancellationToken ct = default)
    {
        if (scope != "ThisOnly" && scope != "ThisAndFuture")
            throw new InvalidOperationException("INVALID_SCOPE");

        var schedule = await _db.Schedules
            .Include(e => e.DateExclusions)
            .Include(e => e.Cancellations)
            .FirstOrDefaultAsync(e => e.Id == scheduleId && e.FamilyId == familyId && !e.IsDeleted, ct)
            ?? throw new KeyNotFoundException("SCHEDULE_NOT_FOUND");

        // Force: hard soft-delete for test cleanup (removes from conflict detection via IsDeleted)
        if (force)
        {
            schedule.IsDeleted = true;
            schedule.UpdatedAt = DateTimeOffset.UtcNow;

            // Also soft-delete derivative schedules (created by "ThisOnly" edits) so they
            // don't leak into conflict detection and break subsequent tests.
            var derivatives = await _db.Schedules
                .Where(d => d.SourceScheduleId == scheduleId && !d.IsDeleted)
                .ToListAsync(ct);
            foreach (var d in derivatives)
            {
                d.IsDeleted = true;
                d.UpdatedAt = DateTimeOffset.UtcNow;
            }

            await _db.SaveChangesAsync(ct);
            return new DeleteScheduleResponse
            {
                Deleted = true,
                Scope = "force",
                Date = date ?? DateOnly.FromDateTime(DateTime.Today),
                Method = "soft_delete"
            };
        }

        // Homework tasks get soft-deleted
        if (schedule.ScheduleType == ScheduleType.HomeworkTask)
        {
            schedule.IsDeleted = true;
            schedule.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
            return new DeleteScheduleResponse
            {
                Deleted = true,
                Scope = "ThisOnly",
                Date = date ?? DateOnly.FromDateTime(DateTime.Today),
                Method = "soft_delete"
            };
        }

        var targetDate = date ?? DateOnly.FromDateTime(DateTime.Today);

        using var transaction = await _db.Database.BeginTransactionAsync(ct);

        try
        {
            if (scope == "ThisOnly")
            {
                // ADR-020: Insert ScheduleDateExclusion
                _db.ScheduleDateExclusions.Add(new ScheduleDateExclusion
                {
                    ScheduleId = schedule.Id,
                    ExcludedDate = targetDate,
                    ExcludedBy = userId,
                    CreatedAt = DateTimeOffset.UtcNow
                });

                await _db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);

                return new DeleteScheduleResponse
                {
                    Deleted = true,
                    Scope = "ThisOnly",
                    Date = targetDate,
                    Method = "exclusion"
                };
            }
            else // ThisAndFuture
            {
                var truncatedEndDate = targetDate.AddDays(-1);

                // ADR-020: truncate RepeatEndDate
                schedule.RepeatEndDate = truncatedEndDate;
                schedule.UpdatedAt = DateTimeOffset.UtcNow;

                // Clean up future ScheduleDateExclusion records
                var futureExclusions = schedule.DateExclusions
                    .Where(d => d.ExcludedDate > truncatedEndDate)
                    .ToList();
                _db.ScheduleDateExclusions.RemoveRange(futureExclusions);

                // Clean up future Cancellation records (IM-6)
                var futureCancellations = schedule.Cancellations
                    .Where(c => c.CancelDate > truncatedEndDate)
                    .ToList();
                _db.Cancellations.RemoveRange(futureCancellations);

                await _db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);

                return new DeleteScheduleResponse
                {
                    Deleted = true,
                    Scope = "ThisAndFuture",
                    Date = targetDate,
                    Method = "truncate",
                    TruncatedRepeatEndDate = truncatedEndDate
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete schedule {ScheduleId} for family {FamilyId}, scope {Scope}, date {Date}",
                scheduleId, familyId, scope, targetDate);
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<CancelScheduleInstanceResponse> CancelInstanceAsync(
        Guid scheduleId, DateOnly date, Guid cancelledBy, Guid familyId, CancellationToken ct = default)
    {
        var schedule = await _db.Schedules
            .Include(e => e.Cancellations)
            .FirstOrDefaultAsync(e => e.Id == scheduleId && e.FamilyId == familyId && !e.IsDeleted, ct)
            ?? throw new KeyNotFoundException("SCHEDULE_NOT_FOUND");

        if (schedule.ScheduleType == ScheduleType.HomeworkTask)
            throw new InvalidOperationException("HOMEWORK_NO_CANCEL");

        if (schedule.Cancellations.Any(c => c.CancelDate == date))
            throw new InvalidOperationException("SCHEDULE_ALREADY_CANCELLED");

        var cancellation = new Cancellation
        {
            ScheduleId = schedule.Id,
            CancelDate = date,
            CancelledBy = cancelledBy,
            CancelledAt = DateTimeOffset.UtcNow
        };

        _db.Cancellations.Add(cancellation);
        await _db.SaveChangesAsync(ct);

        return new CancelScheduleInstanceResponse
        {
            ScheduleId = schedule.Id,
            Date = date,
            Cancelled = true,
            CancelledAt = cancellation.CancelledAt
        };
    }

    public async Task<RestoreScheduleInstanceResponse> RestoreInstanceAsync(
        Guid scheduleId, DateOnly date, Guid userId, Guid familyId, CancellationToken ct = default)
    {
        var schedule = await _db.Schedules
            .Include(e => e.Cancellations)
            .Include(e => e.DateExclusions)
            .FirstOrDefaultAsync(e => e.Id == scheduleId && e.FamilyId == familyId, ct)
            ?? throw new KeyNotFoundException("SCHEDULE_NOT_FOUND");

        // Check for cancelled instance
        var cancellation = schedule.Cancellations.FirstOrDefault(c => c.CancelDate == date);
        if (cancellation != null)
        {
            _db.Cancellations.Remove(cancellation);
            await _db.SaveChangesAsync(ct);
            return new RestoreScheduleInstanceResponse
            {
                ScheduleId = schedule.Id,
                Date = date,
                Restored = true,
                RestoredFrom = "cancellation"
            };
        }

        // Check for excluded date
        var exclusion = schedule.DateExclusions.FirstOrDefault(d => d.ExcludedDate == date);
        if (exclusion != null)
        {
            _db.ScheduleDateExclusions.Remove(exclusion);
            await _db.SaveChangesAsync(ct);
            return new RestoreScheduleInstanceResponse
            {
                ScheduleId = schedule.Id,
                Date = date,
                Restored = true,
                RestoredFrom = "exclusion"
            };
        }

        throw new InvalidOperationException("NOT_CANCELLED_OR_EXCLUDED");
    }

    // ---- private helpers ----

    private static void ValidateCreateRequest(ScheduleType scheduleType, CreateScheduleRequest request)
    {
        // Name
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new InvalidOperationException("SCHEDULE_NAME_EMPTY");
        if (request.Name.Length > 50)
            throw new InvalidOperationException("SCHEDULE_NAME_TOO_LONG");

        // ScheduleType
        if (string.IsNullOrWhiteSpace(request.ScheduleType) ||
            !Enum.TryParse<ScheduleType>(request.ScheduleType, out _))
            throw new InvalidOperationException("SCHEDULE_TYPE_INVALID");

        // ChildIds
        if (request.ChildIds == null || request.ChildIds.Count == 0)
            throw new InvalidOperationException("CHILD_NOT_SELECTED");

        // Location
        if (!string.IsNullOrEmpty(request.Location) && request.Location.Length > 100)
            throw new InvalidOperationException("LOCATION_TOO_LONG");

        // Notes
        if (!string.IsNullOrEmpty(request.Notes) && request.Notes.Length > 500)
            throw new InvalidOperationException("NOTES_TOO_LONG");

        // RepeatEndDate
        if (request.RepeatEndDate.HasValue &&
            request.RepeatEndDate.Value < DateOnly.FromDateTime(DateTime.Today))
            throw new InvalidOperationException("REPEAT_END_DATE_INVALID");

        if (scheduleType == ScheduleType.HomeworkTask)
        {
            if (request.DueDate == null)
                throw new InvalidOperationException("DUE_DATE_REQUIRED");
            if (request.DueDate.Value < DateOnly.FromDateTime(DateTime.Today))
                throw new InvalidOperationException("DUE_DATE_INVALID");
        }
        else
        {
            if (request.TimeSlots == null || request.TimeSlots.Count == 0)
                throw new InvalidOperationException("NO_DAY_SELECTED");

            foreach (var ts in request.TimeSlots)
            {
                if (ts.StartTime >= ts.EndTime)
                    throw new InvalidOperationException("TIME_SLOT_INVALID");
            }
        }
    }

    private static void ValidateUpdateRequest(UpdateScheduleRequest request)
    {
        if (!string.IsNullOrEmpty(request.Scope) &&
            request.Scope != "ThisOnly" && request.Scope != "ThisAndFuture")
            throw new InvalidOperationException("INVALID_SCOPE");

        if (request.Name != null && string.IsNullOrWhiteSpace(request.Name))
            throw new InvalidOperationException("SCHEDULE_NAME_EMPTY");
        if (!string.IsNullOrWhiteSpace(request.Name) && request.Name.Length > 50)
            throw new InvalidOperationException("SCHEDULE_NAME_TOO_LONG");

        if (!string.IsNullOrEmpty(request.Location) && request.Location.Length > 100)
            throw new InvalidOperationException("LOCATION_TOO_LONG");

        if (!string.IsNullOrEmpty(request.Notes) && request.Notes.Length > 500)
            throw new InvalidOperationException("NOTES_TOO_LONG");

        if (request.RepeatEndDate.HasValue &&
            request.RepeatEndDate.Value < DateOnly.FromDateTime(DateTime.Today))
            throw new InvalidOperationException("REPEAT_END_DATE_INVALID");

        if (request.TimeSlots != null)
        {
            foreach (var ts in request.TimeSlots)
            {
                if (ts.StartTime >= ts.EndTime)
                    throw new InvalidOperationException("TIME_SLOT_INVALID");
            }
        }
    }

    private static string? BuildRepeatRule(Domain.Entities.Schedule schedule)
    {
        if (schedule.TimeSlots.Count == 0) return null;
        var days = schedule.TimeSlots
            .Select(t => t.DayOfWeek)
            .OrderBy(d => d)
            .ToList();
        var dayNames = days.Select(d => d switch
        {
            DayOfWeek.Monday => "周一",
            DayOfWeek.Tuesday => "周二",
            DayOfWeek.Wednesday => "周三",
            DayOfWeek.Thursday => "周四",
            DayOfWeek.Friday => "周五",
            DayOfWeek.Saturday => "周六",
            DayOfWeek.Sunday => "周日",
            _ => d.ToString()
        });
        return "每" + string.Join("、", dayNames);
    }

    private void CreateDerivativeSchedule(Domain.Entities.Schedule original, UpdateScheduleRequest request, Guid createdBy)
    {
        var derivative = new Domain.Entities.Schedule
        {
            Id = Guid.NewGuid(),
            Name = request.Name ?? original.Name,
            ScheduleType = original.ScheduleType,
            FamilyId = original.FamilyId,
            AssignedChildId = original.AssignedChildId,
            CreatedBy = createdBy,
            GroupKey = original.GroupKey,
            RepeatEndDate = request.Date, // single instance — ends on the override date (IM-7)
            Location = request.Location ?? original.Location,
            Notes = request.Notes ?? original.Notes,
            DueDate = request.DueDate ?? original.DueDate,
            SuggestedStartTime = request.SuggestedStartTime ?? original.SuggestedStartTime,
            SuggestedEndTime = request.SuggestedEndTime ?? original.SuggestedEndTime,
            SourceScheduleId = original.Id,
            OverrideDate = request.Date, // IM-7: mark which date this derivative applies to
            RowVersion = Guid.NewGuid().ToByteArray(),
            IsDeleted = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        // Copy time slots (or use new ones)
        if (request.TimeSlots?.Count > 0)
        {
            foreach (var ts in request.TimeSlots)
            {
                derivative.TimeSlots.Add(new TimeSlot
                {
                    ScheduleId = derivative.Id,
                    DayOfWeek = ts.DayOfWeek,
                    StartTime = ts.StartTime,
                    EndTime = ts.EndTime
                });
            }
        }
        else
        {
            foreach (var ts in original.TimeSlots)
            {
                derivative.TimeSlots.Add(new TimeSlot
                {
                    ScheduleId = derivative.Id,
                    DayOfWeek = ts.DayOfWeek,
                    StartTime = ts.StartTime,
                    EndTime = ts.EndTime
                });
            }
        }

        _db.Schedules.Add(derivative);
    }

    private static void UpdateScheduleFields(Domain.Entities.Schedule schedule, UpdateScheduleRequest request)
    {
        if (request.Name != null) schedule.Name = request.Name;
        if (request.Location != null) schedule.Location = request.Location;
        if (request.Notes != null) schedule.Notes = request.Notes;
        if (request.RepeatEndDate.HasValue) schedule.RepeatEndDate = request.RepeatEndDate.Value;
        if (request.DueDate.HasValue) schedule.DueDate = request.DueDate.Value;
        if (request.SuggestedStartTime.HasValue) schedule.SuggestedStartTime = request.SuggestedStartTime.Value;
        if (request.SuggestedEndTime.HasValue) schedule.SuggestedEndTime = request.SuggestedEndTime.Value;
        schedule.UpdatedAt = DateTimeOffset.UtcNow;
        schedule.RowVersion = Guid.NewGuid().ToByteArray();
    }

    private async Task UpdateTimeSlotsAsync(Domain.Entities.Schedule schedule, UpdateScheduleRequest request, CancellationToken ct)
    {
        if (request.TimeSlots == null || request.TimeSlots.Count == 0) return;

        // Remove old time slots
        var oldSlots = await _db.TimeSlots.Where(t => t.ScheduleId == schedule.Id).ToListAsync(ct);
        _db.TimeSlots.RemoveRange(oldSlots);

        // Insert new time slots
        foreach (var ts in request.TimeSlots)
        {
            _db.TimeSlots.Add(new TimeSlot
            {
                ScheduleId = schedule.Id,
                DayOfWeek = ts.DayOfWeek,
                StartTime = ts.StartTime,
                EndTime = ts.EndTime
            });
        }
    }

    private async Task DeleteFutureDerivativesAsync(Guid sourceScheduleId, DateOnly? fromDate, CancellationToken ct)
    {
        var query = _db.Schedules
            .Where(s => s.SourceScheduleId == sourceScheduleId && !s.IsDeleted);

        if (fromDate.HasValue)
        {
            query = query.Where(s => s.OverrideDate >= fromDate.Value);
        }

        var derivatives = await query.ToListAsync(ct);

        foreach (var d in derivatives)
        {
            d.IsDeleted = true;
            d.UpdatedAt = DateTimeOffset.UtcNow;
        }
    }
}
