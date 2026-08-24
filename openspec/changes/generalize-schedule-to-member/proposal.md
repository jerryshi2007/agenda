# Proposal: 日程关联对象泛化（generalize-schedule-to-member）

## Why

现有日程管理模块的日程对象仅限「孩子」——`Schedule.AssignedChildId` 只存孩子的 `User.Id`，创建流程第一步为「选孩子」、字段「关联孩子」必填、可多选。家长自身及家庭中其他家长的日程无法进入系统，日历里只有孩子的安排。该需求已通过 `production/staging/2026-08-23-家长日程/` 完成需求评审（`dev-ready` 状态，`requirement.md` + `epic-story.md` + `review.md` 已定稿 13 项决策）。

本次变更将日程关联对象从「孩子」泛化为「家庭成员」（家长 + 孩子），使家长可以为自己、其他家长、孩子创建日程，实现"全家人的日程都在一个日历里"。

## What Changes

- **关联对象泛化**：`Schedule.AssignedChildId` 语义从「孩子的 User.Id」扩展为「成员的 User.Id」（家长或孩子）。家长孩子共用同一模型（非并列新增），`AssignedChildId` 属性与 DB 列经一次正式 migration 重命名为 `AssignedMemberId`（列仍为 Guid，不改数据、不回填）。
- **创建/编辑/删除/打卡权限矩阵泛化**：家长可给任意成员创建/编辑/删除/代打卡；孩子（高年级）仅能给自己创建、编辑、删除、打卡，不能给家长创建（新增越权拦截）。
- **类型双文案**：`ScheduleType.HomeworkTask` 在关联对象为家长时前端显示「待办事项」，为孩子时显示「作业任务」。后端枚举值与数据不变，label 按关联成员角色渲染（与查看者无关）。
- **打卡泛化到成员**：家长给自己打卡 + 代任意成员打卡；孩子仅给自己打卡。打卡时间窗口/逾期判定规则不变。
- **统计/streak 隔离**：家长日程保留状态结算（未打卡→终态），但不写入 streak、不进入完成率/看板（仍仅孩子维度）。
- **模板关联成员泛化**：模板「关联孩子」（单选）→「关联成员」（多选），可生成家长日程。
- **冲突检测对象泛化**：「同一孩子」→「同一成员」，不同成员之间不冲突。
- **废止 `module-event BE-08`「无孩子」空态**：家庭仅有家长时不再阻塞创建日程。
- **展示模式与统计**：本次不触碰（家长无展示模式，统计仍孩子维度）。

**API 契约变更（非破坏，新旧并存一个版本，见 design.md §Decision 6）**：
- `CreateScheduleRequest` 新增 `memberIds`，旧 `childIds` 保留为 deprecated 兼容字段（都传以 `memberIds` 为准）
- `ScheduleResponse` 新增 `assignedMemberId` + `assignedMemberRole`，旧 `assignedChildId` 保留为 deprecated 同值字段
- 错误码新增 `MEMBER_NOT_SELECTED` / `MEMBER_NOT_IN_FAMILY`，旧 `CHILD_NOT_SELECTED` / `CHILD_NOT_IN_FAMILY` 保留为 deprecated 别名（同 HTTP 状态）
- 模板 `ApplyTemplateRequest` 新增 `memberIds`（多选），旧 `childId`（单选）保留为 deprecated 兼容字段
- 冲突/日历查询参数新增 `memberId`，旧 `childId` 保留为 deprecated 兼容字段
- 所有 deprecated 旧字段/旧错误码在 V+1 版本统一移除

## Capabilities

### New Capabilities

（无新 capability。本次是对已归档模块的存量变更，不引入新领域能力。）

### Modified Capabilities

- `event-crud`: 日程关联对象从孩子泛化为成员；创建/编辑/删除权限矩阵（孩子仅自己、家长任意）；越权拦截；类型双文案；冲突检测对象随成员泛化。
- `event-calendar`: 日历「按孩子」筛选 →「按成员」；孩子端仅显示关联自己的日程（家长日程对孩子不可见）。
- `event-checkin-integration`: `IScheduleQueryService` 暴露的 `AssignedChildId` 泛化为成员；打卡权限随成员泛化。
- `checkin-record`: 打卡/撤销权限泛化（家长代任意成员、孩子仅自己），打卡记录 source/被打卡对象泛化。
- `checkin-settlement`: 家长日程保留状态结算但排除 streak 更新（streak 仍仅孩子维度）。
- `template-application`: 模板「关联孩子」单选 →「关联成员」多选，可生成家长日程。

## Impact

**受影响代码路径**（现状对账见 design.md §现状对账清单）：

| 路径 | 变更类型 | 说明 |
|------|---------|------|
| `api/Domain/Entities/Schedule.cs` | 扩展 | `AssignedChildId` → `AssignedMemberId`（属性与 DB 列经 migration 重命名，无 `[Column]` 映射） |
| `api/Schedule/Dtos/` | 扩展 | `CreateScheduleRequest.MemberIds`、`ScheduleResponse.AssignedMemberId+AssignedMemberRole`、`ScheduleConflictCheckRequest.MemberId`、`CalendarQueryRequest.MemberId` |
| `api/Schedule/Services/ScheduleService.cs` | 扩展 | 创建校验成员在家庭 + 孩子仅自己；编辑/删除加孩子越权检查 |
| `api/Schedule/Services/ConflictDetectionService.cs` | 扩展 | 冲突过滤字段改名 |
| `api/Schedule/Services/CalendarQueryService.cs` | 扩展 | 日历筛选字段改名 + 返回成员角色 |
| `api/Schedule/Controllers/ScheduleController.cs` | 扩展 | 创建/编辑/删除放开孩子角色 + 越权拦截 |
| `api/Checkin/CheckinService.cs` | 扩展 | 打卡权限：孩子仅自己 |
| `api/Infrastructure/Jobs/SettlementJob.cs` | 扩展 | streak 更新排除家长成员 |
| `api/Infrastructure/ErrorCodes.cs` | 扩展 | 新增 schedule 模块错误码常量（从 contracts 生成） |
| `api/Template/Services/TemplateService.cs` + `Dtos/ApplyTemplateRequest.cs` | 扩展 | 单选孩子 → 多选成员 |
| `app/pages/schedule-create/`、`schedule-edit/`、`schedule-detail/` | 扩展 | 选孩子 → 选成员 |
| `app/components/child-selector/`、`filter-bar/`、`calendar-view/` | 扩展 | 成员选择器、成员筛选、成员名/头像 |
| `app/services/schedule.js`、`calendar.js`、`template.js`、`checkin.js` | 扩展 | `childIds` → `memberIds` 等参数改名 |
| `app/contracts/schedule.js`（新建） | 新建 | schedule 契约镜像（含双文案 label 映射） |
| `openspec/contracts/schedule/` | 新建 | enums.json / errors.json / dto.json |

**API 端点变更**（无新增路由，仅 DTO/参数新旧并存 + 权限放开）：
- `POST /api/v1/schedules` — 请求 `memberIds`（新）+ `childIds`（deprecated）；放开孩子角色（仅自己）
- `PUT /api/v1/schedules/{id}` / `DELETE` / `cancel` / `restore` — 放开孩子角色（仅自己）
- `GET /api/v1/calendar` — `memberId`（新）+ `childId`（deprecated）
- `POST /api/v1/schedules/check-conflict` — `memberId`（新）+ `childId`（deprecated）
- `POST /api/v1/templates/{id}/apply` — `memberIds`（新，多选）+ `childId`（deprecated，单选归一化）

**性能影响**：无新增性能负担。成员角色解析复用 `FamilyMembers` 索引（`UserId + FamilyId`），日历批量解析成员角色沿用现有「一次性批量查 User」模式。

**安全影响**：新增孩子越权拦截（服务端强制，前端仅做隐藏）；创建时新增「成员在家庭」校验（补现有缺口）；打卡权限收紧（孩子仅自己，堵住「孩子代其他孩子打卡」的潜在越权）。

**迁移保证**：`AssignedChildId` 列经一次可回滚的 `RenameColumn` migration 重命名为 `AssignedMemberId`（不改类型、不回填、不改数据）。存量孩子日程行完全兼容（重命名后 `AssignedMemberId` 仍是孩子的 User.Id）。
