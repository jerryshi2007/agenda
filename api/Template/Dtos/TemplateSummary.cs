namespace Agenda.Api.Template.Dtos;

/// <summary>
/// 模板摘要——列表展示用。
/// 预设模板 createdBy = Guid.Empty。
/// </summary>
public record TemplateSummary
{
    public Guid TemplateId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string ScheduleType { get; init; } = string.Empty;
    public bool IsPreset { get; init; }
    public Guid CreatedBy { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
