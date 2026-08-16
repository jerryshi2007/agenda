namespace Agenda.Api.Infrastructure;

/// <summary>
/// 统一错误信封，形状对齐 openspec/contracts/auth/dto.json 的 ErrorResponse。
/// </summary>
public record ErrorResponse(string Error, string Message, string? TraceId)
{
    public static ErrorResponse From(string errorCode, string? traceId = null) =>
        new(errorCode, ErrorCodes.Message(errorCode), traceId);
}
