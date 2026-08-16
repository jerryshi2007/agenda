namespace Agenda.Api.Domain.Enums;

/// <summary>
/// 打卡操作来源。Parent=家长代打；Child=孩子自打。
/// 值从 openspec/contracts/checkin/enums.json 生成，禁止在业务代码中硬编码。
/// </summary>
public enum CheckinSource
{
    Parent = 1,
    Child = 2
}
