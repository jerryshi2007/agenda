// Global using aliases - resolves namespace conflicts:
// - DomainEvent: between Agenda.Api.Schedule (namespace) and Schedule (entity)
// - DomainScheduleType: between Schedule (namespace) and ScheduleType (entity namespace)
// - DomainFamily: between Agenda.Api.Family (namespace) and Family (entity)
// - DomainFamilyMember: between Agenda.Api.Family (namespace) and FamilyMember (entity)
global using DomainEvent = Agenda.Api.Domain.Entities.Schedule;
global using DomainScheduleType = Agenda.Api.Domain.Enums.ScheduleType;
global using DomainFamily = Agenda.Api.Domain.Entities.Family;
global using DomainFamilyMember = Agenda.Api.Domain.Entities.FamilyMember;
global using DomainInvitationCode = Agenda.Api.Domain.Entities.InvitationCode;
