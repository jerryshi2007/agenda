namespace Agenda.Api.Template.Dtos;

/// <summary>
/// 删除模板响应。软删除：返回 deleted=true 即可。
/// </summary>
public record DeleteTemplateResponse
{
    public Guid TemplateId { get; init; }
    public bool Deleted { get; init; }
}
