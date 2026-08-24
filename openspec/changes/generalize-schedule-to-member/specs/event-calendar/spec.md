# event-calendar · Delta Spec（generalize-schedule-to-member）

> 变更：日历「按孩子」筛选泛化为「按成员」；孩子端仅显示关联自己的日程。

## MODIFIED Requirements

### Requirement: 日历按成员筛选

日历筛选栏「按孩子」MUST 改为「按成员」，默认「全部成员」（家长 + 孩子）。筛选条件 MUST 跨月/周/日视图保持。

#### Scenario: 按某家长筛选
- **WHEN** 家长在日历视图筛选栏选择某家长（如"爸爸"）
- **THEN** 日历仅显示关联该家长的日程，筛选条件跨视图保持

#### Scenario: 默认全部成员
- **WHEN** 家长查看日历默认态
- **THEN** 默认「全部成员」（家长 + 孩子）

#### Scenario: 筛选无匹配
- **WHEN** 按某成员筛选但无关联日程
- **THEN** 显示空状态「该筛选条件下无日程」

### Requirement: 孩子端仅显示关联自己的日程

孩子端日历（今日/周/月视图）MUST 仅显示关联自己的日程，家长日程（即使关联某家长）SHALL 对孩子不可见。

#### Scenario: 孩子不看到家长日程
- **WHEN** 家庭中家长 A 有仅关联自己的日程，孩子小明查看日历
- **THEN** 该家长日程不出现，小明仅能看到关联到自己的日程
