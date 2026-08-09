## ADDED Requirements

### Requirement: System SHALL compute schedule instances on-demand from repeat rules

The system SHALL compute daily schedule instances from the Schedule entity and its TimeSlot records for a given date range without pre-generating an instance table. Each computed instance SHALL be identified by (scheduleId, date).

#### Scenario: Compute instances for a week with repeating schedule

- **WHEN** a request asks for a repeating weekly schedule's instances for the week 2026-10-26 to 2026-11-01, and the schedule has TimeSlot entries for Monday and Wednesday
- **THEN** the system SHALL return instances for Monday 10/26 and Wednesday 10/28 within the requested range

#### Scenario: Homework task instance appears on due date only

- **WHEN** a request asks for instances for the week containing a homework task's due date
- **THEN** the system SHALL return exactly one instance on the due date

#### Scenario: Repeat end date limits instance computation

- **WHEN** a schedule's repeat end date is 2026-12-31 and the requested range extends to 2027-01-31
- **THEN** the system SHALL only return instances up to 2026-12-31

### Requirement: Schedule instance status SHALL be derived from checkin and cancellation records

The system SHALL derive each schedule instance's status by combining information from: Checkin table (打卡记录), Cancellation table (取消记录), schedule time properties, and server time. Status values SHALL be: 未完成 (incomplete), 已完成 (completed), 已取消 (cancelled), 已结束 (ended), 逾期未完成 (overdue).

#### Scenario: Instance has checkin record

- **WHEN** a Checkin record exists for (scheduleId, date)
- **THEN** the instance status SHALL be "completed" (已完成), regardless of cancellation records

#### Scenario: Instance has cancellation record without checkin

- **WHEN** a Cancellation record exists for (scheduleId, date) and no Checkin record exists
- **THEN** the instance status SHALL be "cancelled" (已取消)

#### Scenario: After-school activity past its time window

- **WHEN** an after-school activity instance has no Checkin and no Cancellation, and current time is more than 2 hours past the schedule end time
- **THEN** the instance status SHALL be "ended" (已结束)

#### Scenario: Daily routine from yesterday without checkin

- **WHEN** a daily routine instance from a past date has no Checkin record
- **THEN** the instance status SHALL be "incomplete" (未完成) as a terminal state

#### Scenario: Homework task past due date without checkin

- **WHEN** a homework task's due date is in the past and no Checkin record exists
- **THEN** the instance status SHALL be "overdue" (逾期未完成)

### Requirement: System SHALL cancel a single schedule instance

The system SHALL allow a parent to cancel a single instance of a repeating schedule. Cancellation SHALL be recorded as a Cancellation entity with (scheduleId, cancelDate). The instance SHALL display in grey with strikethrough text and "已取消" label.

#### Scenario: Successfully cancel this instance

- **WHEN** a parent clicks "取消本次" on a repeating schedule detail and confirms
- **THEN** the system SHALL create a Cancellation record for that date and SHALL NOT affect other instances

#### Scenario: Cancel button not shown for homework task

- **WHEN** viewing a homework task detail page
- **THEN** the "取消本次" button SHALL NOT be displayed

### Requirement: System SHALL restore a cancelled schedule instance

The system SHALL allow a parent to restore a previously cancelled instance by deleting its Cancellation record. The operation SHALL require no additional confirmation.

#### Scenario: Successfully restore cancelled instance

- **WHEN** viewing a cancelled instance's detail page, the "取消本次" button shows as "恢复本次". Clicking "恢复本次"
- **THEN** the Cancellation record SHALL be deleted, the instance SHALL immediately revert to "未完成" status, and the calendar SHALL remove the strikethrough display

#### Scenario: Cannot restore a deleted schedule

- **WHEN** a user tries to access a deleted schedule's detail page via a stale link
- **THEN** the system SHALL return 404 with error code SCHEDULE_NOT_FOUND, and the frontend SHALL display "该日程已被删除" without showing a "恢复本次" button

### Requirement: Child removal from family SHALL update schedule associations

When a child is removed from a family, existing schedules associated with that child SHALL be preserved but the child's checkin records SHALL be marked as "已离群" (left group) and SHALL NOT accept new checkin operations.

#### Scenario: Schedule retained when associated child is removed

- **WHEN** a child is removed from a family but has existing schedules
- **THEN** the schedules SHALL remain in the system. The removed child's checkin entries SHALL display as grey with "已离开家庭" label, and checkin buttons for that child SHALL be disabled.

#### Scenario: Parent editing schedule after associated child removed

- **WHEN** a parent edits a schedule whose associated child has been removed from the family
- **THEN** the system SHALL return 400 with error code CHILD_NOT_IN_FAMILY upon save attempt
