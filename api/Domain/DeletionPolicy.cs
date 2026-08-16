namespace Agenda.Api.Domain;

/// <summary>
/// 账户注销缓冲期（30 天）。到期后物理删除。
/// </summary>
public static class DeletionPolicy
{
    public static readonly TimeSpan GracePeriod = TimeSpan.FromDays(30);
}
