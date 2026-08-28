namespace Agenda.Api.Infrastructure;

/// <summary>
/// 领域业务异常。携带契约错误码，由全局异常中间件映射为统一错误信封。
/// </summary>
public class DomainException : Exception
{
    public string ErrorCode { get; }

    public DomainException(string errorCode) : base(errorCode)
    {
        ErrorCode = errorCode;
    }
}
