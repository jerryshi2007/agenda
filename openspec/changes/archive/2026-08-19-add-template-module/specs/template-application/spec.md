## ADDED Requirements

### Requirement: System SHALL allow parent to apply template to generate schedule

The system SHALL allow a parent to generate a schedule from a template by submitting POST /api/v1/templates/{templateId}/apply with required fields: childId (single Guid, must be a child member of current family) and startDate (DateOnly, cannot be earlier than today). The system SHALL copy the template's fields (name, scheduleType, timeSlots, repeatEndDate, location, notes) to the new schedule, override with any provided optional fields (name, timeSlots, notes, location, repeatEndDate), and create the schedule via the existing IScheduleService.CreateAsync. The created schedule SHALL record SourceTemplateId=templateId for traceability.

#### Scenario: Successfully apply template with default fields

- **WHEN** a parent in FamilyA calls POST /api/v1/templates/{templateId}/apply with childId=<childA>, startDate=2026-08-25
- **THEN** the system creates a Schedule with all template fields (name, scheduleType, timeSlots, etc.) assigned to childA
- **AND** the system records SourceTemplateId=templateId on the new schedule
- **AND** the system returns 201 with CreateScheduleResponse (groupKey + schedules list)

#### Scenario: Apply with overridden name

- **WHEN** a parent calls POST /api/v1/templates/{templateId}/apply with childId=<childA>, startDate=2026-08-25, name="小提琴课"
- **THEN** the new schedule has name="小提琴课" (overridden) but other fields use template defaults

#### Scenario: Apply with overridden time slots

- **WHEN** a parent calls POST /api/v1/templates/{templateId}/apply with childId=<childA>, startDate=2026-08-25, timeSlots=[{DayOfWeek:Saturday, StartTime:10:00, EndTime:11:00}]
- **THEN** the new schedule uses the overridden timeSlots (single Saturday slot) instead of template's time slots

#### Scenario: Child not in family blocks application

- **WHEN** a parent calls POST /api/v1/templates/{templateId}/apply with childId=<childFromOtherFamily>
- **THEN** the system returns 400 with error code CHILD_NOT_IN_FAMILY and message "所选孩子不属于当前家庭"

#### Scenario: Start date earlier than today blocks application

- **WHEN** a parent calls POST /api/v1/templates/{templateId}/apply with startDate=2026-08-01 (and today is 2026-08-19)
- **THEN** the system returns 400 with error code START_DATE_INVALID and message "起始日期不能早于今天"

#### Scenario: Child role cannot apply template

- **WHEN** a child user calls POST /api/v1/templates/{templateId}/apply
- **THEN** the system returns 403 with error code CHILD_ACCESS_DENIED and message "孩子角色无权访问模板"

#### Scenario: Template not found returns 404

- **WHEN** a parent calls POST /api/v1/templates/{nonexistentId}/apply
- **THEN** the system returns 404 with error code TEMPLATE_NOT_FOUND

#### Scenario: Edit/delete template does not affect already generated schedules

- **WHEN** a parent applies template T1 to generate schedule S1
- **AND** the parent later edits T1 (changes name) or deletes T1
- **THEN** schedule S1 retains its original name and continues to function normally
- **AND** the SourceTemplateId field on S1 still points to T1 (even if T1 is soft-deleted)

### Requirement: System SHALL reject template application when template belongs to other family

The system SHALL only allow applying templates that are either preset (IsPreset=true) OR belong to the current user's family. Attempting to apply a template from another family SHALL return 404 with error code TEMPLATE_NOT_FOUND.

#### Scenario: Apply template from other family returns not found

- **WHEN** a parent in FamilyA calls POST /api/v1/templates/{id}/apply where the template has FamilyId=FamilyB
- **THEN** the system returns 404 with error code TEMPLATE_NOT_FOUND

#### Scenario: Apply preset template works for any family

- **WHEN** a parent in any family calls POST /api/v1/templates/{presetId}/apply
- **THEN** the system creates a schedule from the preset template
