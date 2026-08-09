## ADDED Requirements

### Requirement: Schedule module SHALL provide schedule timing and status information for checkin module's window determination

The schedule module SHALL expose an interface (IScheduleQueryService, defined by checkin-module and implemented by Schedule module) that allows the checkin module to query the schedule type, time slot configuration, cancellation status, and date exclusion status for a given schedule instance. The checkin module SHALL use this information to determine whether the checkin window is open/closed, and whether undo is allowed. The Schedule module SHALL NOT implement checkin window time rules (e.g., 30-minute advance, activity-type-specific terminal times) -- those belong to the checkin module's CanCheckinAsync() logic.

#### Scenario: Schedule module returns schedule type for a given schedule

- **WHEN** checkin module calls IScheduleQueryService.GetEventAsync(scheduleId)
- **THEN** the method SHALL return the schedule's ScheduleType (AfterSchoolActivity / DailyRoutine / HomeworkTask), AssignedChildId, FamilyId, and IsDeleted flag

#### Scenario: Schedule module returns time slot for a given schedule and date

- **WHEN** checkin module calls IScheduleQueryService.GetTimeSlotAsync(scheduleId, date)
- **THEN** the method SHALL return the start time and end time for that date based on TimeSlot.DayOfWeek matching the date's day of week. For homework tasks, it SHALL return the SuggestedStartTime/SuggestedEndTime or null if not set.

#### Scenario: Schedule module returns cancellation status for a given date

- **WHEN** checkin module calls IScheduleQueryService.GetCancellationStatusAsync(scheduleId, date)
- **THEN** the method SHALL return whether a Cancellation record exists for that (scheduleId, date) pair

#### Scenario: Schedule module returns date exclusion status

- **WHEN** checkin module calls IScheduleQueryService.IsDateExcludedAsync(scheduleId, date)
- **THEN** the method SHALL return whether a ScheduleDateExclusion record exists for that (scheduleId, date) pair (i.e., the instance was deleted via "仅本次" deletion)

#### Scenario: Schedule module returns due date for homework tasks

- **WHEN** checkin module calls IScheduleQueryService.GetDueDateAsync(scheduleId)
- **THEN** the method SHALL return the schedule's DueDate if the schedule is a homework task, or null otherwise

### Requirement: Checkin SHALL support checkin and undo checkin operations

The system SHALL allow authenticated users (parents or the assigned child) to check in for a schedule instance and to undo a checkin. Checkin records SHALL be physically deleted on undo (not soft deleted). After undo, if the time window is still open, re-checkin SHALL be permitted.

#### Scenario: Successful checkin at detail page

- **WHEN** a parent or child clicks "打卡确认" (or type-specific label) on an uncompleted schedule in the checkin window
- **THEN** the system SHALL create a Checkin record with userId, checkinAt (server time), and source (parent/child). The instance status SHALL change to "已完成" with green check mark.

#### Scenario: Undo checkin

- **WHEN** a user clicks "撤销打卡" on a completed schedule within the checkin window
- **THEN** the system SHALL physically delete the Checkin record. The instance SHALL revert to "未完成" status.

#### Scenario: Already checked-in (idempotent)

- **WHEN** a checkin request is submitted for an instance that is already checked in
- **THEN** the system SHALL return 200 with alreadyCheckedIn=true, the existing checkin's checkinAt, and SHALL NOT create a duplicate record

#### Scenario: Checkin on cancelled schedule

- **WHEN** a schedule instance is cancelled
- **THEN** the checkin button SHALL NOT be displayed

#### Scenario: Quick checkin from calendar view card

- **WHEN** a user taps the quick-checkin icon on a day/week view schedule card
- **THEN** the schedule status SHALL immediately change to "已完成" without navigating to the detail page

#### Scenario: No quick checkin in month view

- **WHEN** a user is in month view
- **THEN** no quick checkin entry SHALL be provided (month view only shows colored dots)

### Requirement: Schedule SHALL integrate checkin state into schedule detail page

The schedule detail page SHALL display checkin records and control checkin button state based on the checkin window status query.

#### Scenario: Display checkin records on detail page

- **WHEN** a user opens the schedule detail page
- **THEN** the page SHALL display basic schedule info (date/time/location/children/notes), repeat info (if repeating), checkin records for each child, and action buttons (checkin/undo/edit/cancel/delete)

#### Scenario: Detail page fetches latest data

- **WHEN** a user opens the schedule detail page
- **THEN** the system SHALL fetch the latest data from the server (not rely on cached calendar data)

#### Scenario: Checkin button states

- **WHEN** checking button states for a schedule instance
- **THEN**: uncompleted state SHALL show the checkin button (with type-specific label: "确认到场"/"完成打卡"/"标记完成"); completed state SHALL show "撤销打卡"; cancelled or terminal state SHALL hide the checkin button entirely

#### Scenario: Parent vs child detail page differences

- **WHEN** a parent views the detail page: SHALL show all associated children and all checkin records; SHALL show edit/delete/cancel buttons
- **WHEN** a child views the detail page: SHALL only show their own data; SHALL NOT show edit/delete/cancel buttons; SHALL show checkin button for themselves

### Requirement: Network and concurrent failure handling for checkin

The system SHALL handle network failures and concurrent data changes gracefully for checkin operations.

#### Scenario: Checkin request fails due to network

- **WHEN** a checkin POST request fails due to network interruption
- **THEN** the frontend SHALL display "打卡失败，请重试" and the checkin button SHALL remain clickable (not falsely showing "已完成")

#### Scenario: Schedule deleted by another parent while checkin is attempted

- **WHEN** parent A deletes a schedule, and parent B simultaneously attempts to check in for that schedule
- **THEN** the checkin request SHALL return "日程不存在或已删除", and the frontend SHALL refresh the calendar to remove the schedule

#### Scenario: Calendar data load failure

- **WHEN** calendar data fails to load
- **THEN** the system SHALL display "加载失败，下拉重试" and MAY show the last successful cached data with a "数据可能不是最新" annotation
