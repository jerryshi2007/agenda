# template-preset Specification

## Purpose
模板预设模块——定义系统启动时自动注入的 3 个预设模板（AfterSchoolClass / DailyRoutine / Homework）以及预设模板的只读、跨家庭可见性规则。

## Requirements

### Requirement: System SHALL seed 3 preset templates on startup

The system SHALL insert 3 system preset templates (AfterSchoolClass, DailyRoutine, Homework) into the database on first startup, marked with `IsPreset=true` and `CreatedBy=SystemUserId` (Guid.Empty). Seed operation SHALL be idempotent (skip if preset with same Name+ScheduleType already exists).

#### Scenario: First-time startup seeds 3 preset templates

- **WHEN** the application starts with an empty database (no rows in Templates)
- **THEN** the system inserts 3 template records: AfterSchoolClass (AfterSchoolActivity, Wed 16:00-17:00), DailyRoutine (DailyRoutine, Mon-Sun 18:00-18:30), Homework (HomeworkTask, no time slots)
- **AND** all 3 records have IsPreset=true, FamilyId=null, CreatedBy=Guid.Empty

#### Scenario: Subsequent startup is idempotent

- **WHEN** the application starts and 3 preset templates already exist in the database
- **THEN** the system skips seeding without creating duplicates

### Requirement: System SHALL mark preset templates as read-only

Preset templates (`IsPreset=true`) SHALL NOT be modifiable or deletable via user-facing API endpoints. Attempting to PUT or DELETE a preset template SHALL return 403 with error code `TEMPLATE_PRESET_READONLY`.

#### Scenario: Parent attempts to update preset template

- **WHEN** a parent sends PUT /api/v1/templates/{id} for a template with IsPreset=true
- **THEN** the system returns 403 with error code TEMPLATE_PRESET_READONLY and message "预设模板不可编辑或删除"

#### Scenario: Parent attempts to delete preset template

- **WHEN** a parent sends DELETE /api/v1/templates/{id} for a template with IsPreset=true
- **THEN** the system returns 403 with error code TEMPLATE_PRESET_READONLY and message "预设模板不可编辑或删除"

### Requirement: Preset templates SHALL be visible to all authenticated users

The system SHALL include all preset templates (IsPreset=true) in the response of GET /api/v1/templates regardless of the current user's family. The response SHALL clearly distinguish preset templates from custom templates via an `IsPreset` boolean field.

#### Scenario: List templates returns presets plus family customs

- **WHEN** a parent in FamilyA calls GET /api/v1/templates
- **THEN** the response includes 3 preset templates (IsPreset=true) plus all custom templates where FamilyId=FamilyA
- **AND** the response does NOT include custom templates from FamilyB

#### Scenario: Preset templates appear first in list

- **WHEN** the response is rendered in the list view
- **THEN** preset templates are sorted before custom templates in display order (sorted by IsPreset DESC, CreatedAt DESC)
