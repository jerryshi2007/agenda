## MODIFIED Requirements

### Requirement: JWT Token Claims
JWT token issued after login SHALL include the following claims for authenticated users:
- `userId`: user unique identifier
- `familyId`: current selected family identifier (when user belongs to a family)
- `role`: user role in the family (`Parent` / `Child`)
- `displayMode`: **ADDED** when role is `Child` — the child's current display mode (`Preschool` / `Primary` / `UpperGrades`)

This allows the mini-program to render the correct UI mode without an additional API call.

#### Scenario: Child login includes displayMode
- **WHEN** a child user successfully logs in
- **THEN** the JWT token contains the `displayMode` claim with the child's current display mode value
- **AND** the mini-program can read this claim from the token

#### Scenario: Parent login does not include displayMode
- **WHEN** a parent user successfully logs in
- **THEN** the JWT token does not contain a `displayMode` claim (or is null)
