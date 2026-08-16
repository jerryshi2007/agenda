namespace Agenda.Api.Auth;

public interface ISensitiveWordFilter
{
    bool ContainsSensitiveWord(string text);
}
