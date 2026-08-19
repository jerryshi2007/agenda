using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 日程核心实体。按 ADR-014 展开模型：N 个孩子 = N 条 Schedule 记录，通过 GroupKey 关联。
/// 乐观锁通过 RowVersion（byte[]，映射为 PostgreSQL xmin 或 timestamp）实现。
/// </summary>
public class Schedule
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public ScheduleType ScheduleType { get; set; }
    public Guid FamilyId { get; set; }
    public Guid AssignedChildId { get; set; }
    public Guid CreatedBy { get; set; }

    /// <summary>多孩子创建的关联批次键（GUID）</summary>
    public Guid GroupKey { get; set; }

    /// <summary>重复结束日期（null=无限重复；作业任务为 null）</summary>
    public DateOnly? RepeatEndDate { get; set; }

    public string? Notes { get; set; }
    public string? Location { get; set; }

    /// <summary>作业任务截止日期（仅 HomeWorkTask）</summary>
    public DateOnly? DueDate { get; set; }

    /// <summary>作业任务建议开始时间（仅 HomeWorkTask）</summary>
    public TimeOnly? SuggestedStartTime { get; set; }

    /// <summary>作业任务建议结束时间（仅 HomeWorkTask）</summary>
    public TimeOnly? SuggestedEndTime { get; set; }

    /// <summary>衍生来源 Schedule Id（仅 ThisOnly 编辑产生）</summary>
    public Guid? SourceScheduleId { get; set; }

    /// <summary>衍生日程覆盖日期（仅 ThisOnly 编辑产生，标记该衍生日程应用的特定日期）</summary>
    public DateOnly? OverrideDate { get; set; }

    /// <summary>衍生来源模板 Id（从模板生成时设置，软引用——模板删除不影响已生成日程）</summary>
    public Guid? SourceTemplateId { get; set; }

    /// <summary>乐观锁版本号</summary>
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public bool IsDeleted { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation properties
    public ICollection<TimeSlot> TimeSlots { get; set; } = new List<TimeSlot>();
    public ICollection<Cancellation> Cancellations { get; set; } = new List<Cancellation>();
    public ICollection<ScheduleDateExclusion> DateExclusions { get; set; } = new List<ScheduleDateExclusion>();
    public Schedule? SourceSchedule { get; set; }
    public ICollection<Schedule> DerivativeSchedules { get; set; } = new List<Schedule>();
}
