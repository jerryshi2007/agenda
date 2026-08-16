namespace Agenda.Api.Auth;

/// <summary>
/// 敏感词过滤器（首期关键词列表实现）。
/// </summary>
public class SensitiveWordFilter : ISensitiveWordFilter
{
    private static readonly string[] Keywords =
    [
        "赌博", "色情", "毒品", "诈骗"
    ];

    public bool ContainsSensitiveWord(string text) =>
        Keywords.Any(k => text.Contains(k, StringComparison.OrdinalIgnoreCase));
}
