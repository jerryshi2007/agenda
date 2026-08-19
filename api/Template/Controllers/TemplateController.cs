using Agenda.Api.Domain.Enums;
using Agenda.Api.Infrastructure;
using Agenda.Api.Schedule.Services;
using Agenda.Api.Shared.Extensions;
using Agenda.Api.Template.Dtos;
using Agenda.Api.Template.Services;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Agenda.Api.Template.Controllers;

[ApiController]
[Route("api/v1/templates")]
[Authorize]
public class TemplateController : ControllerBase
{
    private readonly ITemplateService _templateService;
    private readonly IFamilyContextService _familyContext;
    private readonly IValidator<CreateTemplateRequest> _createValidator;
    private readonly IValidator<UpdateTemplateRequest> _updateValidator;
    private readonly IValidator<ApplyTemplateRequest> _applyValidator;

    public TemplateController(
        ITemplateService templateService,
        IFamilyContextService familyContext,
        IValidator<CreateTemplateRequest> createValidator,
        IValidator<UpdateTemplateRequest> updateValidator,
        IValidator<ApplyTemplateRequest> applyValidator)
    {
        _templateService = templateService;
        _familyContext = familyContext;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _applyValidator = applyValidator;
    }

    /// <summary>列出模板（预设 + 当前家庭自定义）</summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? keyword,
        [FromQuery] string? scheduleType,
        [FromQuery] bool? isPreset,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        if (role != UserRole.Parent)
            return Forbid(ErrorCodes.TemplateChildAccessDenied, "孩子不能访问模板");

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var result = await _templateService.ListAsync(
            familyId, keyword, scheduleType, isPreset, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>获取模板详情</summary>
    [HttpGet("{templateId:guid}")]
    public async Task<IActionResult> GetById(Guid templateId, CancellationToken ct)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        if (role != UserRole.Parent)
            return Forbid(ErrorCodes.TemplateChildAccessDenied, "孩子不能访问模板");

        var result = await _templateService.GetByIdAsync(templateId, familyId, ct);
        if (result == null)
            return NotFound(new { error = ErrorCodes.TemplateNotFound });

        return Ok(result);
    }

    /// <summary>创建模板</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTemplateRequest request, CancellationToken ct)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        if (role != UserRole.Parent)
            return Forbid(ErrorCodes.TemplateChildAccessDenied, "孩子不能创建模板");

        var validation = await _createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            throw new ValidationException(validation.Errors);

        var result = await _templateService.CreateAsync(familyId, User.GetUserId(), request, ct);
        return CreatedAtAction(nameof(GetById), new { templateId = result.TemplateId }, result);
    }

    /// <summary>更新模板</summary>
    [HttpPut("{templateId:guid}")]
    public async Task<IActionResult> Update(
        Guid templateId,
        [FromBody] UpdateTemplateRequest request,
        CancellationToken ct)
    {
        var (_, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        if (role != UserRole.Parent)
            return Forbid(ErrorCodes.TemplateChildAccessDenied, "孩子不能编辑模板");

        var validation = await _updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            throw new ValidationException(validation.Errors);

        var result = await _templateService.UpdateAsync(templateId, User.GetUserId(), request, ct);
        return Ok(result);
    }

    /// <summary>删除模板（软删除）</summary>
    [HttpDelete("{templateId:guid}")]
    public async Task<IActionResult> Delete(Guid templateId, CancellationToken ct)
    {
        var (_, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        if (role != UserRole.Parent)
            return Forbid(ErrorCodes.TemplateChildAccessDenied, "孩子不能删除模板");

        var result = await _templateService.DeleteAsync(templateId, User.GetUserId(), ct);
        return Ok(result);
    }

    /// <summary>从模板生成日程</summary>
    [HttpPost("{templateId:guid}/apply")]
    public async Task<IActionResult> Apply(
        Guid templateId,
        [FromBody] ApplyTemplateRequest request,
        CancellationToken ct)
    {
        var (familyId, role) = await _familyContext.GetFamilyContextAsync(User.GetUserId(), ct);

        if (role != UserRole.Parent)
            return Forbid(ErrorCodes.TemplateChildAccessDenied, "孩子不能使用模板");

        var validation = await _applyValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            throw new ValidationException(validation.Errors);

        var result = await _templateService.ApplyAsync(
            templateId, familyId, User.GetUserId(), request, ct);
        return Ok(result);
    }

    private ObjectResult Forbid(string errorCode, string message) =>
        StatusCode(403, new { error = errorCode, message });
}
