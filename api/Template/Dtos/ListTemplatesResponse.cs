namespace Agenda.Api.Template.Dtos;

/// <summary>
/// 模板列表响应。标准分页结构：items + totalCount + page + pageSize。
/// </summary>
public record ListTemplatesResponse
{
    public List<TemplateSummary> Items { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}
