using Agenda.Api.Schedule.Dtos;
using Agenda.Api.Template.Dtos;

namespace Agenda.Api.Template.Services;

/// <summary>
/// 模板系统服务契约：
/// - 列表/详情：家庭隔离（IsPreset=true 全局可见；否则仅同家庭）
/// - 创建/更新/删除：仅创建者可改；预设只读
/// - Apply：从模板生成日程，组合 IScheduleService.CreateAsync
/// </summary>
public interface ITemplateService
{
    Task<ListTemplatesResponse> ListAsync(
        Guid familyId,
        string? keyword,
        string? scheduleType,
        bool? isPreset,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<TemplateDetail?> GetByIdAsync(
        Guid templateId,
        Guid familyId,
        CancellationToken ct = default);

    Task<TemplateDetail> CreateAsync(
        Guid familyId,
        Guid userId,
        CreateTemplateRequest request,
        CancellationToken ct = default);

    Task<TemplateDetail> UpdateAsync(
        Guid templateId,
        Guid userId,
        UpdateTemplateRequest request,
        CancellationToken ct = default);

    Task<DeleteTemplateResponse> DeleteAsync(
        Guid templateId,
        Guid userId,
        CancellationToken ct = default);

    Task<CreateScheduleResponse> ApplyAsync(
        Guid templateId,
        Guid familyId,
        Guid userId,
        ApplyTemplateRequest request,
        CancellationToken ct = default);
}
