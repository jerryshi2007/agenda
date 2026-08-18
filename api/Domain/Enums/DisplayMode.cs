namespace Agenda.Api.Domain.Enums;

/// <summary>
/// 孩子展示模式。值与 openspec/contracts/family/enums.json DisplayMode 对齐。
/// 第一期仅存储设置，不做差异化 UI 渲染。
/// </summary>
public enum DisplayMode
{
    Preschool = 1,
    Primary = 2,
    UpperGrades = 3
}
