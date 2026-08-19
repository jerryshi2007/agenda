using Agenda.Api.Domain.Enums;

namespace Agenda.Api.Domain.Entities;

/// <summary>
/// 模板实体。模板与日程共享 ScheduleType 枚举，但生命周期独立。
/// IsPreset=true 为系统预设模板（FamilyId=null, CreatedBy=Guid.Empty）；IsPreset=false 为家庭自定义模板。
/// 软删除：IsDeleted=true 保留数据，查询过滤。
/// </summary>
public class Template
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public ScheduleType ScheduleType { get; set; }

    /// <summary>是否为系统预设模板</summary>
    public bool IsPreset { get; set; }

    /// <summary>所属家庭（预设模板为 null；自定义模板必填）</summary>
    public Guid? FamilyId { get; set; }

    /// <summary>创建者 ID（预设模板为 Guid.Empty）</summary>
    public Guid CreatedBy { get; set; }

    /// <summary>重复结束日期（null=无限重复；HomeworkTask 为 null）</summary>
    public DateOnly? RepeatEndDate { get; set; }

    public string? Location { get; set; }
    public string? Notes { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation property
    public ICollection<TemplateTimeSlot> TimeSlots { get; set; } = new List<TemplateTimeSlot>();
}
