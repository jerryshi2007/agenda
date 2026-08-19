## ADDED Requirements

### Requirement: Display Mode Enum
The system SHALL define three display modes for children: `Preschool` (3-6 years), `Primary` (6-10 years), `UpperGrades` (10-14 years).

Display mode SHALL be stored as a property of the `FamilyMember` entity.

#### Scenario: Default mode when not set
- **WHEN** a new child is added and no display mode is specified
- **THEN** the default mode is `Primary` (小学模式)

---

### Requirement: Display Mode Configuration
The system SHALL allow parents to set the display mode for a child member through the family management UI.

#### Scenario: Parent changes display mode
- **WHEN** parent selects a new display mode for a child and saves
- **THEN** the display mode is updated in the `FamilyMember` record
- **AND** the change takes effect when the child next enters or switches page

#### Scenario: Unset mode defaults to Primary
- **WHEN** the child record has no explicit display mode set
- **THEN** the system defaults to `Primary` mode

---

### Requirement: JWT Display Mode
The system SHALL include the current user's display mode in the JWT token when the user is a child.

#### Scenario: Child login
- **WHEN** a child user successfully logs in
- **THEN** the JWT `displayMode` claim contains the child's current display mode
- **AND** the mini-program can read this claim without additional API call

---

### Requirement: Primary Mode - Today View
In Primary mode, the child SHALL have a read-only today view showing all today's schedules in timeline order.

The view SHALL NOT allow editing, creating, or deleting schedules.

Each schedule item SHALL show: type icon + name + specific time + check-in status icon.

The top of the view SHALL show today progress: "Completed X/Y".

#### Scenario: Child opens today view in Primary mode
- **WHEN** child user with Primary mode enters today view
- **THEN** all schedules for today are displayed in timeline order
- **AND** each item shows type icon, name, time, and status icon
- **AND** top shows "Completed X/Y" progress
- **AND** all items are read-only (no edit/delete buttons)

#### Scenario: Empty today in Primary mode
- **WHEN** child has no schedules for today
- **THEN** displays empty state message "今天还没有日程"

---

### Requirement: Primary Mode - Week View
In Primary mode, the child SHALL have a read-only week view showing 7-day schedule overview.

Each day with schedules SHALL show color dots for schedule types.

Clicking a day SHALL navigate to that day's today view (still read-only).

#### Scenario: Child opens week view in Primary mode
- **WHEN** child user with Primary mode enters week view
- **THEN** 7-day calendar is displayed
- **AND** each day with schedules has colored dots indicating schedule types
- **AND** the view is read-only (no editing)

---

### Requirement: Primary Mode - Month View
In Primary mode, the child SHALL have a read-only month view showing monthly schedule overview.

Each day with schedules SHALL show color dots for schedule types.

Clicking a day SHALL navigate to that day's today view.

#### Scenario: Child opens month view in Primary mode
- **WHEN** child user with Primary mode enters month view
- **THEN** monthly calendar is displayed
- **AND** each day with schedules has colored dots indicating schedule types
- **AND** the view is read-only (no editing)

---

### Requirement: Primary Mode - Check-in Interaction
In Primary mode, the child SHALL check-in a schedule by clicking the check-in button directly, no confirmation popup required.

The child SHALL be able to undo a completed check-in.

#### Scenario: Child checks in
- **WHEN** child clicks the check-in button on an incomplete schedule
- **THEN** check-in is confirmed immediately
- **AND** status icon updates to checked ✓
- **AND** today progress X/Y updates

#### Scenario: Child undoes check-in
- **WHEN** child clicks on an already checked-in schedule
- **THEN** check-in is undone
- **AND** status icon reverts to incomplete
- **AND** today progress X/Y updates

---

### Requirement: Primary Mode - My Page
In Primary mode, the "My" page SHALL display only the child's name and本周完成率 (weekly completion rate).

The completion rate SHALL show percentage, progress bar, and completed/total count.

#### Scenario: Child opens My page in Primary mode
- **WHEN** child user with Primary mode enters My page
- **THEN** child name is displayed
- **AND** weekly completion rate is displayed with percentage, progress bar, and "X/Y completed"
- **AND** no other management functions are shown (no switching family, no settings)

---

### Requirement: Authorization - Child can only view own schedules
A child user SHALL only view and check-in schedules assigned to themselves.

The child SHALL NOT edit, create, or delete any schedules in Primary mode.

#### Scenario: Child attempts to access another child's schedule
- **WHEN** child user requests a schedule assigned to another child
- **THEN** the system returns 403 Access Denied
- **AND** the schedule is not displayed

---

### Requirement: Network Error Handling
The system SHALL display network error message appropriate to the current display mode.

- Preschool mode: cartoon-style error message
- Primary/UpperGrades: standard error message

#### Scenario: Network disconnected in Primary mode
- **WHEN** child opens today view and network is disconnected
- **THEN** standard error message is displayed "网络连接失败，请检查网络设置"
