## ADDED Requirements

### Requirement: Calendar SHALL support month view with colored dots

The system SHALL provide a month view displaying a traditional 7-column by 5-6-row calendar grid. Each date cell SHALL show the day number and up to 3 colored dots (by schedule type). Dates exceeding 3 schedules SHALL show "+N". Today's date SHALL be highlighted. Non-current-month dates SHALL appear in grey. Tapping a date SHALL navigate to the day view for that date.

#### Scenario: Month view with schedules

- **WHEN** a parent views the month calendar for October 2026
- **THEN** dates with schedules SHALL show colored dots (blue for after-school activities, green for daily routines, orange for homework tasks), and dates with more than 3 schedules SHALL show "+N"

#### Scenario: Month view empty date

- **WHEN** a parent views a date with no schedules
- **THEN** the date cell SHALL display only the day number with no dots

#### Scenario: Tap non-current-month date

- **WHEN** a parent taps a grey date from the previous month in the month view
- **THEN** the calendar SHALL switch to that month and display the day view for the tapped date

### Requirement: Calendar SHALL support week view with schedule cards

The system SHALL provide a week view displaying 7 columns in a vertical time grid. Each schedule card SHALL display: colored bar (by type), time, schedule name, child avatar, and completion status icon. Tapping a card SHALL navigate to the schedule detail page.

#### Scenario: Week view with schedules

- **WHEN** a parent switches to week view
- **THEN** each day column SHALL display schedule cards sorted by time, showing color bar, start time, name, child avatars, and status icons

#### Scenario: Week view empty day

- **WHEN** a day in the week view has no schedules
- **THEN** the day column SHALL display as empty with no schedule cards

### Requirement: Calendar SHALL support day view with detailed schedule cards

The system SHALL provide a day view with a timeline layout arranged by time on the vertical axis. Each schedule card SHALL display: colored bar, time, name, child avatar + name, completion status icon + text, type label, location (if applicable), and notes. Tapping a card SHALL navigate to the schedule detail page.

#### Scenario: Day view with complete schedule information

- **WHEN** a parent switches to day view
- **THEN** schedule cards SHALL display full information including time, name, child avatars+names, status icons+text, type tags, location, and notes

#### Scenario: Day view with more than 20 schedules

- **WHEN** a day has more than 20 schedules
- **THEN** the timeline SHALL support vertical scrolling without truncation. The view SHALL default to showing from 30 minutes before the earliest schedule to 30 minutes after the latest schedule.

#### Scenario: Day view empty

- **WHEN** a day has no schedules
- **THEN** the system SHALL display an empty state with the message "今天没有日程安排" and a quick-entry button to create a schedule

#### Scenario: Calendar overall empty

- **WHEN** the user has no schedules at all
- **THEN** the system SHALL display empty state with illustration and message "还没有日程，点击创建第一个日程吧" and a "创建日程" button

### Requirement: Calendar SHALL filter by child and schedule type

The system SHALL provide filter controls to narrow displayed schedules by child (single or all) and by schedule type (multiple or all). Filter conditions SHALL persist across view switches (month/week/day).

#### Scenario: Filter by child

- **WHEN** a parent selects a specific child "小明" in the filter bar
- **THEN** the calendar SHALL only display schedules associated with that child

#### Scenario: Filter by schedule type

- **WHEN** a parent selects "课后活动" in the type filter
- **THEN** the calendar SHALL only display after-school activity schedules

#### Scenario: Filter with no matching schedules

- **WHEN** a filter is applied and no schedules match
- **THEN** the calendar SHALL display empty state "该筛选条件下无日程"

#### Scenario: Family has no children

- **WHEN** a parent tries to create a schedule but the family has no children
- **THEN** the "选孩子" step SHALL display empty state "请先添加孩子" with a link to the family management page

### Requirement: Calendar SHALL respond to slide gestures across time periods

The system SHALL support left/right slide gestures to navigate to the previous/next period (month in month view, week in week view, day in day view). Slide gestures SHALL be debounced at 300ms to prevent rapid consecutive triggers.

#### Scenario: Slide to next week

- **WHEN** a parent slides left in week view
- **THEN** the calendar SHALL navigate to the next week

#### Scenario: Rapid consecutive slides debounced

- **WHEN** a user rapidly slides consecutive times (< 300ms apart)
- **THEN** the system SHALL ignore slides within the debounce window and only process one navigation

### Requirement: Calendar SHALL handle cross-day time slots

The system SHALL correctly display schedules with cross-day time slots (e.g., 23:00-01:00) by showing the schedule on the start date with an annotation for the next-day end time.

#### Scenario: Cross-day schedule in week view

- **WHEN** a schedule has a time slot 23:00-01:00 on Friday
- **THEN** the schedule SHALL appear on Friday with an annotation indicating the next-day end time
