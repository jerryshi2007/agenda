## ADDED Requirements

### Requirement: Checkin Time Window Determination

The system SHALL determine check-in eligibility based on schedule type, schedule time boundaries, and server time. The system SHALL allow check-in only within the valid time window for each schedule type.

#### Scenario: Early check-in window opens 30 minutes before start
- **WHEN** server time reaches (schedule start time - 30 minutes) for any schedule type
- **THEN** the check-in API SHALL return `canCheckin: true`, and the frontend SHALL render the check-in button as clickable

#### Scenario: Early check-in window not yet open
- **WHEN** server time is before (schedule start time - 30 minutes) for any schedule type
- **THEN** the check-in API SHALL return `canCheckin: false, reason: "EARLY", remainingSeconds: <N>`, and the frontend SHALL render the check-in button as disabled with countdown text "N 分钟后可打卡"

#### Scenario: Check-in allowed during the schedule
- **WHEN** server time >= schedule start time and the schedule instance is not in terminal state
- **THEN** the check-in API SHALL return `canCheckin: true`

### Requirement: Activity Overdue Determination

The system SHALL mark an after-school activity schedule instance as "已结束" (ended) when server time exceeds (end time + 2 hours) AND the instance has not been checked in.

#### Scenario: Activity still within grace period
- **WHEN** an after-school activity ends at 17:00, server time is 18:30, and the instance is not checked in
- **THEN** the check-in API SHALL return `canCheckin: true` (end time + 2h = 19:00, grace period not expired)

#### Scenario: Activity overdue after grace period
- **WHEN** an after-school activity ends at 17:00, server time is 19:01, the instance is not checked in, and settlement has executed
- **THEN** the instance status SHALL be "已结束" (terminal). The check-in API SHALL return `canCheckin: false, reason: "TERMINAL_STATE"`. The frontend SHALL render a disabled "已结束" text without check-in button.

#### Scenario: Activity checked in before grace period expires
- **WHEN** an after-school activity is checked in at 17:30 (before grace period expires)
- **THEN** the instance status SHALL be "已完成". Overdue determination SHALL NOT apply.

### Requirement: Routine Overdue Determination

The system SHALL mark a daily routine schedule instance as "未完成" (not completed, terminal) when server time passes 24:00 on the schedule date AND the instance has not been checked in.

#### Scenario: Routine still checkable on the same day
- **WHEN** a routine schedule's date is today, server time is 23:00, and the instance is not checked in
- **THEN** the check-in API SHALL return `canCheckin: true`

#### Scenario: Routine overdue after midnight
- **WHEN** a routine schedule's date was yesterday, server time is 00:01 today, settlement has executed, and the instance was not checked in
- **THEN** the instance status SHALL be "未完成" (terminal). The check-in API SHALL return `canCheckin: false, reason: "TERMINAL_STATE"`. The frontend SHALL render red "未完成" text without check-in button.

### Requirement: Homework Overdue Determination

The system SHALL mark a homework task schedule instance as "逾期未完成" (overdue not completed) when server time passes 24:00 on the due date AND the instance has not been checked in.

#### Scenario: Homework still checkable on the due date
- **WHEN** a homework task's due date is Oct 27, server time is 22:00 Oct 27, and the instance is not checked in
- **THEN** the check-in API SHALL return `canCheckin: true`

#### Scenario: Homework overdue after due date midnight
- **WHEN** a homework task's due date was Oct 27, server time is 00:01 Oct 28, settlement has executed, and the instance was not checked in
- **THEN** the instance status SHALL be "逾期未完成" (terminal). The check-in API SHALL return `canCheckin: false, reason: "TERMINAL_STATE"`. The frontend SHALL render red "逾期未完成" text without check-in button.

### Requirement: No Makeup Check-in After Terminal State

The system SHALL NOT allow check-in for any schedule instance in a terminal state (已结束 / 未完成 / 逾期未完成 / 已取消).

#### Scenario: Terminal state blocks check-in
- **WHEN** a schedule instance is in any terminal state (已结束 / 未完成 / 逾期未完成 / 已取消)
- **THEN** the check-in API SHALL return `canCheckin: false, reason: "TERMINAL_STATE"`. The frontend SHALL NOT display any check-in button, only the terminal state text.

#### Scenario: Parent attempts recovery via editing
- **WHEN** a parent attempts to use the edit function for a historical instance
- **THEN** the backend SHALL prevent editing the time of a historical instance to a future date. If recovery is needed, the parent SHALL use manual operations (edit schedule or contact support).

### Requirement: Server Time as Source of Truth

The system SHALL use server time for all time-based decisions (check-in window, overdue determination). Client time SHALL only be used for optimistic UI hints.

#### Scenario: Client-server time skew
- **WHEN** a child's phone shows 23:59, server time is 00:01 the next day, and a routine instance has not been checked in
- **THEN** the check-in API SHALL use server time (00:01, next day) for window determination. If settlement has executed, the API SHALL return `canCheckin: false, reason: "CHECKIN_WINDOW_CLOSED"`.

#### Scenario: Client time used for optimistic preview only
- **WHEN** a user performs a check-in action
- **THEN** the frontend SHALL display the server-returned check-in time on the UI, NOT the client time.

### Requirement: Undo Check-in Before Settlement

The system SHALL allow undoing a check-in when the schedule instance is in "已完成" status AND the check-in time window is still open. Undoing SHALL delete the check-in record and revert the instance status to "未完成".

#### Scenario: Undo check-in within time window
- **WHEN** a user has checked in a routine "练琴", the instance status is "已完成", and the current time is before 24:00 on the same day (time window still open)
- **THEN** the undo API SHALL delete the check-in record, revert instance status to "未完成", and return success. The user SHALL be able to re-check-in subject to time window rules.

#### Scenario: Undo check-in blocked after settlement
- **WHEN** settlement has executed (next day 00:05), and yesterday's "练琴" instance has become terminal "未完成"
- **THEN** the undo API SHALL return `canUndo: false, reason: "TERMINAL_STATE"`. The frontend SHALL NOT display the "撤销打卡" button.

#### Scenario: Undo check-in blocked after activity grace period
- **WHEN** a user has checked in an after-school activity "游泳课", and server time has passed (end time + 2 hours) making the instance terminal "已结束"
- **THEN** the undo API SHALL return `canUndo: false, reason: "TERMINAL_STATE"`. The frontend SHALL NOT display the "撤销打卡" button.

#### Scenario: Undo-Settlement race condition
- **WHEN** a user checks in at 23:59:30, undoes at 23:59:50, and settlement triggers at 00:05
- **THEN** settlement SHALL read the final state (status = "未完成" after undo) and transition it to terminal "未完成". No race condition SHALL occur.

#### Scenario: Undo then re-check-in window closed
- **WHEN** a user undoes a check-in, then attempts to re-check-in but the time window has closed (e.g., routine past 24:00)
- **THEN** the check-in API SHALL return `canCheckin: false, reason: "CHECKIN_WINDOW_CLOSED"`. The undo operation is irreversible once the window closes.

### Requirement: Check-in Record Creation

The system SHALL create a check-in record when a user performs check-in. Each schedule instance SHALL have at most one check-in record.

#### Scenario: Successful check-in
- **WHEN** a user (parent or child) performs check-in on an eligible schedule instance
- **THEN** the system SHALL create a check-in record with: schedule instance ID, check-in user ID, server timestamp, operation source (parent/child). The schedule instance status SHALL change to "已完成".

#### Scenario: Duplicate check-in (idempotent)
- **WHEN** multiple users (parent and child) press check-in simultaneously on the same schedule instance
- **THEN** the first request SHALL succeed (create record, status = "已完成"). Subsequent requests SHALL return `alreadyCheckedIn: true` (idempotent, no error).

### Requirement: Check-in Time Window Query

The system SHALL provide an API to query the current check-in eligibility for a schedule instance without performing the check-in.

#### Scenario: Query check-in window status
- **WHEN** a user views a schedule detail page
- **THEN** the API SHALL return `{ canCheckin: boolean, canUndo: boolean, reason?: string, remainingSeconds?: number }` based on server time and instance state.
