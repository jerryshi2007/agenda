## ADDED Requirements

### Requirement: Parent SHALL create after-school activity schedule for children

The system SHALL allow a parent to create an after-school activity schedule by selecting children, filling in activity name, configuring weekly time slots, and specifying optional fields (location, notes). The schedule SHALL be associated with the selected children's family.

#### Scenario: Successfully create after-school activity

- **WHEN** a parent selects 1 child, chooses "课后活动" type, fills name "钢琴课", selects Tuesday 16:00-17:00, sets repeat end date 2026-12-31, and clicks "创建"
- **THEN** the system creates the schedule with type AfterSchoolActivity, generates TimeSlot entries for Tuesday 16:00-17:00, and returns the created schedule with 201 Created

#### Scenario: No child selected blocks progress

- **WHEN** a parent clicks "下一步" without selecting any child
- **THEN** the system SHALL return 400 with error code CHILD_NOT_SELECTED

### Requirement: Parent SHALL create daily routine schedule for children

The system SHALL allow a parent to create a daily routine schedule with a name, weekly time slot configuration with per-day fine-tuning, and optional notes.

#### Scenario: Successfully create daily routine with per-day tuning

- **WHEN** a parent selects "日常作息" type, fills name "练琴", sets default time 16:00-16:30 for Monday-Friday, tunes Wednesday to 17:00-17:30, and clicks "创建"
- **THEN** the system creates the schedule with type DailyRoutine, generates TimeSlot entries for each configured day with their specific times, and returns 201 Created

#### Scenario: Empty routine name blocked

- **WHEN** a parent submits a daily routine with empty name
- **THEN** the system SHALL return 400 with error code SCHEDULE_NAME_EMPTY

### Requirement: Parent SHALL create homework task for children

The system SHALL allow a parent to create a homework task with a task name, required due date, optional suggested time period, and optional notes. Homework tasks SHALL NOT use time slots or repeat rules.

#### Scenario: Successfully create homework task

- **WHEN** a parent selects "作业任务" type, fills task name "数学练习册 P32-35", sets due date to 2026-10-27, optionally sets suggested period 15:00-16:00, and clicks "创建"
- **THEN** the system creates the schedule with type HomeworkTask, dueDate set to 2026-10-27, no TimeSlot entries, and returns 201 Created

#### Scenario: Due date earlier than today blocked

- **WHEN** a parent sets due date to a date earlier than today
- **THEN** the system SHALL return 400 with error code DUE_DATE_INVALID or the frontend SHALL show a warning "截止日期不能早于今天"

### Requirement: Input validation for schedule creation

The system SHALL validate all schedule input fields at both frontend and backend boundaries.

#### Scenario: Schedule name exceeds 50 characters

- **WHEN** schedule name input exceeds 50 characters
- **THEN** the system SHALL return 400 with error code SCHEDULE_NAME_TOO_LONG

#### Scenario: Schedule name is whitespace only

- **WHEN** schedule name trimmed is empty
- **THEN** the system SHALL return 400 with error code SCHEDULE_NAME_EMPTY

#### Scenario: Notes exceed 500 characters

- **WHEN** notes input exceeds 500 characters
- **THEN** the system SHALL return 400 with error code NOTES_TOO_LONG

#### Scenario: Time slot start later than end

- **WHEN** start time is later than end time (e.g., 18:00-16:00)
- **THEN** the system SHALL return 400 with error code TIME_SLOT_INVALID

#### Scenario: No day selected in time slot week

- **WHEN** all 7 days are set to "无安排"
- **THEN** the system SHALL return 400 with error code NO_DAY_SELECTED

#### Scenario: Repeat end date earlier than today

- **WHEN** repeat end date is set to a date earlier than today
- **THEN** the system SHALL return 400 with error code REPEAT_END_DATE_INVALID

### Requirement: Schedule conflict detection SHALL provide soft warning

When creating or editing a schedule, the system SHALL detect time overlaps for the same child and SHALL return conflict information. The system SHALL NOT block creation — parents MAY confirm to proceed.

#### Scenario: Same child, overlapping time slot

- **WHEN** a parent creates a schedule with a time slot that overlaps an existing schedule for the same child
- **THEN** the system SHALL return 409 with error code SCHEDULE_CONFLICT, including conflicting schedule names and times, but SHALL allow creation if the parent confirms

#### Scenario: Different child, overlapping time slot

- **WHEN** a parent creates a schedule whose time overlaps an existing schedule for a different child
- **THEN** the system SHALL NOT trigger conflict detection

### Requirement: Parent SHALL edit a schedule (this instance only)

The system SHALL allow a parent to edit a single instance of a repeating schedule without affecting other instances. The default scope for editing SHALL be "仅本次" (this instance only).

#### Scenario: Edit this instance of a repeating schedule

- **WHEN** a parent opens a repeating schedule detail, clicks "编辑", modifies the activity name from "钢琴课" to "钢琴课补课" with scope "仅本次", and saves
- **THEN** the system SHALL create an instance override record for that specific date, leaving all other instances unchanged

#### Scenario: Switch edit scope preserves filled content

- **WHEN** a parent fills partial edit fields in "仅本次" mode, then switches to "全部日程"
- **THEN** the system SHALL preserve the filled content

#### Scenario: Edit checked-in instance

- **WHEN** a parent edits a checked-in schedule instance and modifies non-checkin fields (location, notes)
- **THEN** the system SHALL save the edits and SHALL NOT reset the checkin record. If the schedule type field is changed, the checkin record SHALL remain valid with updated semantics.

### Requirement: Parent SHALL edit a schedule (all future instances)

The system SHALL allow a parent to edit all future instances of a repeating schedule, including the current instance. Historical (past) instances SHALL NOT be affected.

#### Scenario: Edit time slot for all future instances

- **WHEN** a parent edits a repeating schedule, switches to "全部日程", changes Thursday time slot from 16:00-17:00 to 17:00-18:00, and saves
- **THEN** the system SHALL update the schedule's TimeSlot configuration for all future dates. Past instances SHALL remain unchanged.

#### Scenario: No future instances exist

- **WHEN** a parent switches to "全部日程" but the schedule has no future instances (repeat end date has passed)
- **THEN** the system SHALL notify the parent and execute as "仅本次" modification

### Requirement: Editing homework task SHALL NOT show range switch

The system SHALL NOT display the "仅本次/全部日程" toggle when editing homework tasks, as they are one-time tasks with no sequence concept.

#### Scenario: Homework task edit page

- **WHEN** a parent opens the edit page for a homework task
- **THEN** the range switch SHALL NOT be displayed

### Requirement: Concurrent edit conflict detection

The system SHALL detect concurrent edits using optimistic locking (version number or rowversion). When a conflict is detected, the later submission SHALL be rejected.

#### Scenario: Two parents edit the same schedule concurrently

- **WHEN** parent A opens the edit page (version=1), parent B also opens the edit page (version=1). Parent A saves first (version becomes 2). Parent B then attempts to save (with version=1).
- **THEN** the system SHALL return 409 with error code CONCURRENT_EDIT_CONFLICT, advising the user to refresh

### Requirement: Parent SHALL delete a schedule (this instance only)

The system SHALL allow a parent to delete a single instance of a repeating schedule. The operation SHALL require explicit confirmation. Historical checkin records SHALL be preserved.

#### Scenario: Delete this instance

- **WHEN** a parent clicks "删除" on a repeating schedule detail, selects "仅删除本次", and confirms
- **THEN** the system SHALL mark only the current date's instance as deleted (or create a deletion record). Other instances SHALL NOT be affected. Historical checkin records SHALL be preserved.

#### Scenario: Cancel delete operation

- **WHEN** a parent clicks "删除", the confirmation dialog appears, and then clicks "取消"
- **THEN** the system SHALL close the dialog and the schedule SHALL remain unchanged

### Requirement: Parent SHALL delete a schedule (this and all future instances)

The system SHALL allow a parent to delete the current instance and all future instances of a repeating schedule. Historical instances SHALL be preserved.

#### Scenario: Delete this and all future instances

- **WHEN** a parent selects "删除此日期及之后所有", and confirms
- **THEN** the system SHALL delete the current instance and all future instances. Historical instances and their checkin records SHALL be preserved.

#### Scenario: Last remaining future instance

- **WHEN** a schedule has only one future instance left and the parent selects "删除此日期及之后所有"
- **THEN** the system SHALL delete only the current instance (equivalent to "仅本次"), avoiding the ambiguity of deleting zero future instances

### Requirement: Deleting homework task SHALL use simple confirmation

The system SHALL use a simple confirmation dialog for homework task deletion without scope selection, as homework tasks are one-time items.

#### Scenario: Delete homework task

- **WHEN** a parent clicks "删除" on a homework task detail
- **THEN** the system SHALL show a simple confirmation dialog (no scope selection), and upon confirmation, SHALL delete the task while preserving checkin records

#### Scenario: Cancel homework task deletion

- **WHEN** the parent clicks "取消" in the confirmation dialog
- **THEN** the dialog SHALL close and the task SHALL remain unchanged
