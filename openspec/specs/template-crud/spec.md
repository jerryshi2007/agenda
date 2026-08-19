# template-crud Specification

## Purpose
模板 CRUD 模块——定义自定义模板的创建、查询、更新、删除以及使用次数统计的 API 契约与业务规则。模板用于将常用日程（课后活动/日常作息/作业任务）固化为可复用的模板。

## Requirements

### Requirement: System SHALL allow parent to create custom template

The system SHALL allow a parent to create a custom template by submitting a POST /api/v1/templates request with name (required, max 50 chars), scheduleType (required, one of AfterSchoolActivity/DailyRoutine/HomeworkTask), timeSlots (required for AfterSchoolActivity/DailyRoutine, forbidden for HomeworkTask), repeatEndDate (optional, null for HomeworkTask), location (optional, max 100 chars), notes (optional, max 500 chars). The new template SHALL be associated with the current user's family (FamilyId) and marked with IsPreset=false and CreatedBy=currentUserId.

#### Scenario: Successfully create after-school activity template

- **WHEN** a parent in FamilyA sends POST /api/v1/templates with name="钢琴课", scheduleType="AfterSchoolActivity", timeSlots=[{DayOfWeek:Wednesday, StartTime:16:00, EndTime:17:00}], repeatEndDate=null, notes="带上琴谱"
- **THEN** the system creates a template with FamilyId=FamilyA, CreatedBy=parentUserId, IsPreset=false, and returns 201 with the created template

#### Scenario: Empty name blocks template creation

- **WHEN** a parent sends POST /api/v1/templates with name="" or whitespace-only
- **THEN** the system returns 400 with error code TEMPLATE_NAME_EMPTY and message "模板名称不能为空"

#### Scenario: Name exceeds 50 characters blocks creation

- **WHEN** a parent sends POST /api/v1/templates with a name longer than 50 characters
- **THEN** the system returns 400 with error code TEMPLATE_NAME_TOO_LONG and message "模板名称不能超过 50 个字符"

#### Scenario: Homework template forbids time slots

- **WHEN** a parent sends POST /api/v1/templates with scheduleType="HomeworkTask" and timeSlots=[...]
- **THEN** the system returns 400 with error code TEMPLATE_TIMESLOT_INVALID and message "作业任务模板不能配置时间槽"

#### Scenario: After-school activity requires time slots

- **WHEN** a parent sends POST /api/v1/templates with scheduleType="AfterSchoolActivity" and timeSlots=[]
- **THEN** the system returns 400 with error code TEMPLATE_TIMESLOT_REQUIRED and message "课后活动模板至少需要一个时间槽"

#### Scenario: Child role cannot create template

- **WHEN** a child role user sends POST /api/v1/templates
- **THEN** the system returns 403 with error code CHILD_ACCESS_DENIED and message "孩子角色无权访问模板"

### Requirement: System SHALL list templates filtered by current family

The system SHALL return templates accessible to the current user's family: all preset templates (IsPreset=true, FamilyId=null) UNION all custom templates where FamilyId=currentUserFamilyId. The list SHALL support optional filters: keyword (fuzzy match on name), scheduleType, isPreset (true/false/null). Response SHALL be paginated with pageSize (default 20, max 100) and page (default 1).

#### Scenario: List returns presets and family customs

- **WHEN** a parent in FamilyA calls GET /api/v1/templates
- **THEN** the response includes 3 preset templates plus all custom templates owned by FamilyA
- **AND** the response does not include customs from other families

#### Scenario: Keyword search filters by name

- **WHEN** a parent calls GET /api/v1/templates?keyword=钢琴
- **THEN** the response includes only templates whose name contains "钢琴" (case-insensitive substring match)
- **AND** preset templates are matched alongside custom templates

#### Scenario: Schedule type filter

- **WHEN** a parent calls GET /api/v1/templates?scheduleType=DailyRoutine
- **THEN** the response includes only templates with ScheduleType=DailyRoutine

#### Scenario: Empty result for no match

- **WHEN** a parent calls GET /api/v1/templates?keyword=不存在的模板
- **THEN** the system returns 200 with items=[] and totalCount=0
- **AND** the frontend SHALL display the empty state "未找到匹配模板"

### Requirement: System SHALL return template detail by id

The system SHALL return the full template (including all time slots) for a given template id, IF the template is either a preset (IsPreset=true) OR belongs to the current user's family. Otherwise return 404 with error code TEMPLATE_NOT_FOUND.

#### Scenario: Get custom template detail

- **WHEN** a parent in FamilyA calls GET /api/v1/templates/{id} for a template with FamilyId=FamilyA
- **THEN** the system returns 200 with the full template including timeSlots array

#### Scenario: Get preset template detail

- **WHEN** a parent in FamilyA calls GET /api/v1/templates/{id} for a preset template
- **THEN** the system returns 200 with the preset template

#### Scenario: Get template from other family returns not found

- **WHEN** a parent in FamilyA calls GET /api/v1/templates/{id} for a template with FamilyId=FamilyB
- **THEN** the system returns 404 with error code TEMPLATE_NOT_FOUND and message "模板不存在"

### Requirement: System SHALL allow creator to update custom template

The system SHALL allow a parent to update a custom template (PUT /api/v1/templates/{id}) IF the template is NOT a preset AND the current user is the creator (CreatedBy=currentUserId). Updateable fields: name, scheduleType (cannot change to/from HomeworkTask if existing template is not HomeworkTask and vice versa), timeSlots, repeatEndDate, location, notes. ScheduleType SHALL be immutable for any update (decided via the rule: scheduleType is set at creation and cannot change).

#### Scenario: Creator updates template name and notes

- **WHEN** a parent (template creator) sends PUT /api/v1/templates/{id} with new name="大提琴课" and notes="带乐谱"
- **THEN** the system updates the template and returns 200 with the updated template
- **AND** the system does NOT affect any schedules already generated from this template

#### Scenario: Non-creator cannot update template

- **WHEN** a parent (not the creator) in the same family sends PUT /api/v1/templates/{id}
- **THEN** the system returns 403 with error code TEMPLATE_NOT_OWNER and message "仅创建者可编辑或删除此模板"

#### Scenario: Update preset template blocked

- **WHEN** any parent sends PUT /api/v1/templates/{id} for a preset template
- **THEN** the system returns 403 with error code TEMPLATE_PRESET_READONLY and message "预设模板不可编辑或删除"

### Requirement: System SHALL allow creator to delete custom template

The system SHALL allow a parent to delete a custom template (DELETE /api/v1/templates/{id}) IF the template is NOT a preset AND the current user is the creator. Deletion SHALL be a soft delete (IsDeleted=true) to preserve referential history. The system SHALL NOT cascade-delete or affect any schedules already generated from this template.

#### Scenario: Creator deletes custom template

- **WHEN** a parent (template creator) sends DELETE /api/v1/templates/{id}
- **THEN** the system marks the template as IsDeleted=true and returns 200 with deleted=true
- **AND** the system does NOT affect any schedules generated from this template

#### Scenario: Non-creator cannot delete template

- **WHEN** a parent (not the creator) sends DELETE /api/v1/templates/{id}
- **THEN** the system returns 403 with error code TEMPLATE_NOT_OWNER

#### Scenario: Delete preset template blocked

- **WHEN** any parent sends DELETE /api/v1/templates/{id} for a preset template
- **THEN** the system returns 403 with error code TEMPLATE_PRESET_READONLY

### Requirement: System SHALL count schedules generated from template

The system SHALL return the count of schedules where SourceTemplateId=templateId AND IsDeleted=false, accessible via the template detail endpoint (response field: `usageCount`). This count is used by the frontend to display "已有 N 个日程使用过此模板" in the delete confirmation dialog.

#### Scenario: Template with generated schedules shows count

- **WHEN** a parent calls GET /api/v1/templates/{id} for a template that has been used to generate 3 schedules
- **THEN** the response includes usageCount=3

#### Scenario: Unused template shows zero count

- **WHEN** a parent calls GET /api/v1/templates/{id} for a template never used
- **THEN** the response includes usageCount=0
