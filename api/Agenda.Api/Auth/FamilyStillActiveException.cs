using Agenda.Api.Infrastructure;

namespace Agenda.Api.Auth;

public class FamilyStillActiveException : DomainException
{
    public FamilyStillActiveException() : base(ErrorCodes.FamilyStillActive)
    {
    }
}
