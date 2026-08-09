## ADDED Requirements

### Requirement: Daily Settlement Execution

The system SHALL execute a daily settlement task at 00:05 each day. The task SHALL process all unchecked-in schedule instances from the previous day and transition their status to terminal states based on schedule type.

#### Scenario: Settlement processes all three schedule types
- **WHEN** the settlement task triggers at 00:05
- **THEN** for each unchecked-in instance from the previous day:
  - After-school activity instances SHALL transition from "未完成" to "已结束" (if current time > end time + 2 hours)
  - Daily routine instances SHALL transition from "未完成" to "未完成" (terminal, same status name)
  - Homework task instances (due date = previous day) SHALL transition from "未完成" to "逾期未完成"

#### Scenario: Settlement does not affect checked-in instances
- **WHEN** a schedule instance from the previous day is in "已完成" status
- **THEN** the settlement task SHALL NOT modify its status

#### Scenario: Settlement does not affect cancelled instances
- **WHEN** a schedule instance from the previous day is in "已取消" status
- **THEN** the settlement task SHALL NOT modify its status

### Requirement: Settlement Idempotency

The settlement task SHALL be idempotent. Processing already-settled instances SHALL NOT change their state.

#### Scenario: Settlement rerun on already-settled data
- **WHEN** the settlement task runs a second time for the same date (e.g., after an error recovery)
- **THEN** instances already in terminal states (已结束 / 未完成 / 逾期未完成) SHALL NOT be modified. The settlement task SHALL check the current status before transitioning.

#### Scenario: Settlement only transitions from non-terminal state
- **WHEN** the settlement task processes an instance
- **THEN** the instance status SHALL only transition to terminal if the current status is "未完成" (in-progress, non-terminal). Instances in "已完成" or "已取消" SHALL be skipped.

### Requirement: Settlement Error Recovery

The settlement task SHALL handle partial failures gracefully. Failure of one child's data SHALL NOT affect other children's settlement.

#### Scenario: Partial settlement failure with retry
- **WHEN** a database write fails for one child's data during settlement
- **THEN** the settlement task SHALL log the error, retry the failed child's data up to 3 times, and continue processing other children. Successfully settled data SHALL remain unchanged.

#### Scenario: Settlement task interruption
- **WHEN** the settlement task is interrupted mid-execution (e.g., database connection loss)
- **THEN** on retry, already-settled instances SHALL be skipped (idempotent). Partially processed children SHALL be correctly settled.

### Requirement: Settlement Concurrent Safety

The settlement task SHALL NOT interfere with active check-in operations on the current day. It SHALL only process instances from the previous day.

#### Scenario: User checks in during settlement execution
- **WHEN** settlement is executing for previous day's data, and a user performs check-in on a current day's instance
- **THEN** the check-in operation SHALL succeed normally. Settlement SHALL NOT affect current day's instances.

#### Scenario: Multi-child settlement concurrency
- **WHEN** settlement processes multiple children
- **THEN** each child's settlement SHALL be independent. Transaction isolation per child SHALL prevent cross-contamination.

### Requirement: Streak Update During Settlement

The settlement task SHALL update continuous completion days (streak) for daily routine schedules after status transitions.

#### Scenario: Single schedule streak increment
- **WHEN** settlement processes a child's routine schedule "练琴" that was checked in yesterday
- **THEN** the single-schedule streak for "练琴" SHALL increment by 1

#### Scenario: Single schedule streak reset
- **WHEN** settlement processes a child's routine schedule "练琴" that was NOT checked in yesterday
- **THEN** the single-schedule streak for "练琴" SHALL reset to 0

#### Scenario: Cancelled instance does not break streak
- **WHEN** settlement processes a routine schedule instance that was cancelled by parent (status = "已取消")
- **THEN** the streak SHALL NOT reset. It SHALL remain at its current value (no increment, no reset).

#### Scenario: Overall streak increment
- **WHEN** a child completed at least 1 valid daily routine yesterday
- **THEN** the child's overall streak SHALL increment by 1

#### Scenario: Overall streak reset
- **WHEN** a child has at least 1 valid (uncancelled) daily routine yesterday but completed none of them
- **THEN** the child's overall streak SHALL reset to 0

#### Scenario: All routines cancelled does not affect overall streak
- **WHEN** all of a child's daily routines yesterday were cancelled
- **THEN** the child's overall streak SHALL NOT change (no valid routines to evaluate)

### Requirement: Settlement Scheduled Trigger

The system SHALL provide a scheduled trigger mechanism to execute the daily settlement task at 00:05 every day.

#### Scenario: Normal scheduled execution
- **WHEN** the server clock reaches 00:05
- **THEN** the settlement task SHALL be triggered automatically and process the previous day's data

#### Scenario: Delayed execution
- **WHEN** the scheduled trigger is delayed (e.g., server under load, trigger framework latency)
- **THEN** the settlement task SHALL still execute. It SHALL identify the previous day by server date - 1 day. Delayed execution SHALL NOT cause incorrect date targeting.
