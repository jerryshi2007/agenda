// Global using aliases - resolves namespace conflicts in tests:
// - DomainEvent: between Agenda.Api.Schedule (namespace) and Schedule (entity)
// - DomainScheduleType: between Schedule (namespace) and ScheduleType (entity namespace)
// - DomainFamily: between Agenda.Api.Family (namespace) and Family (entity)
// - DomainFamilyMember: between Agenda.Api.Family (namespace) and FamilyMember (entity)
// - DomainInvitationCode: between Agenda.Api.Family (namespace) and InvitationCode (entity)
// - DomainTemplate: between Agenda.Api.Template (namespace) and Template (entity)
// - DomainTemplateTimeSlot: between Agenda.Api.Template (namespace) and TemplateTimeSlot (entity)
// - Domain: tests 原属 Agenda.Api.* 命名空间，裸写 Domain.X 靠命名空间嵌套解析到 Agenda.Api.Domain；
//   拆分到 Agenda.Test 后需显式别名还原。
global using Domain = Agenda.Api.Domain;
global using DomainEvent = Agenda.Api.Domain.Entities.Schedule;
global using DomainScheduleType = Agenda.Api.Domain.Enums.ScheduleType;
global using DomainFamily = Agenda.Api.Domain.Entities.Family;
global using DomainFamilyMember = Agenda.Api.Domain.Entities.FamilyMember;
global using DomainInvitationCode = Agenda.Api.Domain.Entities.InvitationCode;
global using DomainTemplate = Agenda.Api.Domain.Entities.Template;
global using DomainTemplateTimeSlot = Agenda.Api.Domain.Entities.TemplateTimeSlot;
