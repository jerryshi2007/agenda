# event-checkin-integration · Delta Spec（generalize-schedule-to-member）

> 变更：`IScheduleQueryService` 暴露的 `AssignedChildId` 泛化为成员；打卡权限随成员泛化。

## MODIFIED Requirements

### Requirement: Schedule 模块向打卡模块暴露成员关联信息

`IScheduleQueryService` 返回的 `ScheduleInfo` 中 `AssignedChildId` MUST 泛化为 `AssignedMemberId`（成员 User.Id，家长或孩子），并 MUST 补充成员角色以支撑打卡权限判断与双文案。

#### Scenario: 获取日程关联成员
- **WHEN** checkin 模块调用 `IScheduleQueryService.GetScheduleAsync(scheduleId)`
- **THEN** 返回 `ScheduleType`、`AssignedMemberId`、`FamilyId`、`IsDeleted`（原 `AssignedChildId` 改名）

#### Scenario: 打卡权限随成员泛化
- **WHEN** 家长为任意成员（自己/其他家长/孩子）的日程打卡
- **THEN** 允许打卡，source=Parent
- **WHEN** 孩子为其他成员的日程打卡
- **THEN** 拒绝，返回 403 `CHILD_ACCESS_DENIED`（仅能打卡自己的日程）
