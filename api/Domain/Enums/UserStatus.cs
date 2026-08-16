namespace Agenda.Api.Domain.Enums;

/// <summary>
/// 用户账户状态。Active=正常活跃；Deleted=已注销（30 天缓冲期）。
/// 值从 openspec/contracts/auth/enums.json 生成，禁止在业务代码中硬编码。
/// </summary>
public enum UserStatus
{
    Active = 0,
    Deleted = 1
}
