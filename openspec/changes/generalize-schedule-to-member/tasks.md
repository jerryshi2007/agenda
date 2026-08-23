# Tasks: 日程关联对象泛化（generalize-schedule-to-member）

> 日期：2026-08-23
> 总 task 数：25（按 8 梯队分组）
> 上游：design.md（generalize-schedule-to-member）
> 下游执行：dev-dotnet / dev-miniapp

---

## Task 依赖关系图

```
[第 0 梯队：契约 + 实体]
  Task 0.1 契约 JSON（schedule 域）                ← 无依赖（arch-architect 已交付）
  Task 0.2 app/contracts/schedule.js 镜像 + parity  ← 依赖 0.1
  Task 0.3 Schedule 实体 AssignedMemberId 改名      ← 无依赖（仅改属性 + [Column]）

[第 1 梯队：后端 DTO + 错误码]
  Task 1.1 ErrorCodes.cs 新增 schedule 常量         ← 依赖 0.1
  Task 1.2 Schedule DTOs 改名（Create/Response/Conflict） ← 依赖 0.3
  Task 1.3 CalendarQueryRequest + CalendarSchedule 角色 + CalendarController 绑定  ← 依赖 0.3
  Task 1.4 ApplyTemplateRequest.MemberIds           ← 无依赖

[第 2 梯队：后端权限 + 校验]
  Task 2.1 ScheduleService.CreateAsync 成员校验 + 孩子仅自己  ← 依赖 1.1, 1.2
  Task 2.2 ScheduleService 编辑/删除/取消/恢复 孩子越权    ← 依赖 1.1, 1.2
  Task 2.3 ScheduleController 放开孩子 + CHILD_SELF_ASSIGN_ONLY ← 依赖 2.1, 2.2

[第 3 梯队：打卡 + 结算]
  Task 3.1 CheckinService 孩子仅自己打卡            ← 依赖 0.3
  Task 3.2 SettlementJob streak 排除家长            ← 依赖 0.3

[第 4 梯队：模板]
  Task 4.1 TemplateService.ApplyAsync 多选成员      ← 依赖 1.4, 2.1

[第 5 梯队：后端测试]
  Task 5.1 Schedule 权限矩阵单测                    ← 依赖 2.1, 2.2, 2.3
  Task 5.2 Checkin + Settlement 单测                ← 依赖 3.1, 3.2
  Task 5.3 兼容层测试（旧字段名请求仍成功）           ← 依赖 1.2, 1.3, 1.4, 2.1

[第 6 梯队：前端 service/契约]
  Task 6.1 services/schedule.js + calendar.js 改名  ← 依赖 0.2
  Task 6.2 services/template.js + checkin.js 改名   ← 依赖 0.2

[第 7 梯队：前端组件/页面]
  Task 7.1 member-selector 组件（新建）             ← 依赖 0.2
  Task 7.2 schedule-create 选成员 + 双文案           ← 依赖 6.1, 7.1
  Task 7.3 schedule-detail + schedule-edit 关联成员   ← 依赖 6.1
  Task 7.4 filter-bar + calendar-view 成员筛选       ← 依赖 6.1
  Task 7.5 type-selector 双文案                      ← 依赖 0.2
  Task 7.6 use-template-dialog 多选成员              ← 依赖 6.2, 7.1

[第 8 梯队：联调回归]
  Task 8.1 后端全量测试                             ← 依赖 5.1, 5.2, 5.3
  Task 8.2 前端 Jest 回归                            ← 依赖 7.x 全部
```

---

## Task 列表

### 第 0 梯队：契约 + 实体

#### Task 0.1: 契约 JSON（schedule 域）

- **负责 agent**：`arch-architect`（本次交付）
- **依赖**：无
- **产出文件**：
  - `openspec/contracts/schedule/enums.json`
  - `openspec/contracts/schedule/errors.json`
  - `openspec/contracts/schedule/dto.json`
- **完成标准**：3 个 JSON 已写入；错误码含 `MEMBER_NOT_SELECTED`/`MEMBER_NOT_IN_FAMILY`/`CHILD_SELF_ASSIGN_ONLY`/`CHILD_ACCESS_DENIED` 等，旧码 `CHILD_NOT_SELECTED`/`CHILD_NOT_IN_FAMILY` 以 `deprecated: true` 标注；DTO 新旧字段并存（新字段 + `deprecated` 旧字段），与 design.md §API 契约轮廓 + Decision 6 一致
- **验证命令**：`cat openspec/contracts/schedule/dto.json | jq .`

#### Task 0.2: app 端契约镜像 + parity 测试

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 0.1
- **产出文件**：
  - `app/contracts/schedule.js`（导出 `ScheduleType`、`ScheduleTypeLabels`（角色感知：HomeworkTask.Parent='待办事项'/Child='作业任务'）、`Scope`、`ErrorCodes`（含 deprecated 别名 `CHILD_NOT_SELECTED`/`CHILD_NOT_IN_FAMILY`）、`ErrorMessages`、`HttpStatus`）
  - `app/__tests__/contracts/schedule.test.js`（parity 测试，锁定与 JSON 一致，含 deprecated 标记）
- **完成标准**：镜像字段与 JSON 一一对应（新码 + deprecated 别名）；无手写字面量；parity 测试通过
- **验证命令**：`cd app && npx jest __tests__/contracts/schedule.test.js`

#### Task 0.3: Schedule 实体 AssignedMemberId 改名（零迁移）

- **负责 agent**：`dev-dotnet`
- **依赖**：无
- **产出文件**：
  - `api/Domain/Entities/Schedule.cs`（`AssignedChildId` → `AssignedMemberId`，加 `[Column("AssignedChildId")]` + 注释说明该列存成员 User.Id）
  - `api/Domain/Interfaces/IScheduleQueryService.cs`（`ScheduleInfo.AssignedChildId` → `AssignedMemberId`）
- **完成标准**：属性改名后 EF 仍映射到 `AssignedChildId` 列（零迁移）；`ScheduleInfo` 同步改名；现有测试编译通过
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

---

### 第 1 梯队：后端 DTO + 错误码

#### Task 1.1: ErrorCodes.cs 新增 schedule 常量

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 0.1
- **产出文件**：
  - `api/Infrastructure/ErrorCodes.cs`（新增 `MemberNotSelected`/`MemberNotInFamily`/`ChildSelfAssignOnly`/`ChildAccessDenied`/`ScheduleNameEmpty` 等 schedule 模块常量 + deprecated 别名常量 `ChildNotSelected`/`ChildNotInFamily` + Messages/HttpStatuses 映射）
- **完成标准**：常量值与 `openspec/contracts/schedule/errors.json` 一致（新码 + deprecated 别名，别名与对应新码同 HTTP 状态）；`ScheduleService`/`CheckinService` 中不再使用裸字符串字面量
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 1.2: Schedule DTOs 改名 + 兼容层（请求归一化 + 响应双输出）

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 0.3
- **产出文件**：
  - `api/Schedule/Dtos/CreateScheduleRequest.cs`（新属性 `MemberIds` + deprecated 旧属性 `ChildIds` + 归一化方法 `GetEffectiveMemberIds()`：两者都传以 `MemberIds` 为准，仅旧归一化，都空返回空列表）
  - `api/Schedule/Dtos/ScheduleResponse.cs`（`AssignedMemberId` + `AssignedChildId`（deprecated，同值）+ 新增 `AssignedMemberRole`；`ScheduleSummary` 同步双字段）
  - `api/Schedule/Dtos/ScheduleConflictResponse.cs`（`ScheduleConflictCheckRequest.MemberId` + `ChildId`（deprecated）+ 归一化）
- **完成标准**：新字段名与 dto.json 一致；旧字段 `childIds`/`assignedChildId`/`childId` 以 `deprecated` 标记存在（`[JsonPropertyName]` 别名或独立属性）；归一化优先级「memberIds 优先」与 JSON 字段顺序无关
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 1.3: CalendarQueryRequest + CalendarSchedule 角色 + CalendarController 绑定（含兼容）

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 0.3
- **产出文件**：
  - `api/Schedule/Dtos/CalendarResponse.cs`（`CalendarQueryRequest.MemberId` + `ChildId`（deprecated）+ 归一化；`CalendarSchedule` 新增 `AssignedMemberId` + `AssignedChildId`（deprecated，同值）+ `AssignedMemberRole`）
  - `api/Schedule/Controllers/CalendarController.cs`（`[FromQuery]` 同时绑定 `memberId`（新）+ `childId`（旧 deprecated）；归一化到 `MemberId`；`role==Child` 时在**归一化之后**强制 `request.MemberId = User.GetUserId()`，覆盖客户端传入值——先归一化、后角色强制，安全边界见 design.md §Decision 6）
- **完成标准**：日历请求/响应新字段名 + deprecated 旧字段 + 角色字段与 dto.json 一致；孩子强制过滤作用在归一化后的 `MemberId`（先归一化、后角色强制），孩子传 `memberId=其他成员Id` 也只会返回自己的日程
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 1.4: ApplyTemplateRequest.MemberIds（含兼容）

- **负责 agent**：`dev-dotnet`
- **依赖**：无
- **产出文件**：
  - `api/Template/Dtos/ApplyTemplateRequest.cs`（新 `MemberIds`（`List<Guid>`）+ deprecated 旧 `ChildId`（`Guid?`）+ 归一化：`ChildId` 归一化为单元素 `MemberIds`，两者都传以 `MemberIds` 为准）
- **完成标准**：单选改多选字段 + deprecated 兼容归一化与 dto.json 一致
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

---

### 第 2 梯队：后端权限 + 校验

#### Task 2.1: ScheduleService.CreateAsync 成员校验 + 孩子仅自己

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1.1, 1.2
- **输入**：design.md §Decision 1/2/3
- **产出文件**：
  - `api/Schedule/Services/ScheduleService.cs`（`CreateAsync` 增传 `UserRole role`；`ValidateCreateRequest` 改 `CHILD_NOT_SELECTED`→`MEMBER_NOT_SELECTED`；新增逐成员「在家庭」校验 `MEMBER_NOT_IN_FAMILY`；`role==Child` 时校验 `MemberIds==[self]` 否则 `CHILD_SELF_ASSIGN_ONLY`）
  - `api/Schedule/Services/IScheduleService.cs`（接口签名加 role）
- **完成标准**：创建走成员校验；孩子仅自己；家长任意成员；错误码常量化
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~ScheduleService"`

#### Task 2.2: ScheduleService 编辑/删除/取消/恢复 孩子越权

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1.1, 1.2
- **产出文件**：
  - `api/Schedule/Services/ScheduleService.cs`（`UpdateAsync`/`DeleteAsync`/`CancelInstanceAsync`/`RestoreInstanceAsync` 增传 `UserRole role`，加 `role==Child && AssignedMemberId != userId → CHILD_ACCESS_DENIED`）
  - `api/Schedule/Services/IScheduleService.cs`（接口签名加 role）
- **完成标准**：孩子仅能编辑/删除/取消/恢复自己的日程；家长任意成员
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~ScheduleService"`

#### Task 2.3: ScheduleController 放开孩子 + CHILD_SELF_ASSIGN_ONLY

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 2.1, 2.2
- **产出文件**：
  - `api/Schedule/Controllers/ScheduleController.cs`（`Create` 去掉 `role != Parent` 一刀切，改 `role==Child && MemberIds != [self] → 403 CHILD_SELF_ASSIGN_ONLY`；`Update/Delete/Cancel/Restore` 去掉 `role != Parent` 一刀切，将 role 传入 Service）
- **完成标准**：孩子可给自己创建/编辑/删除；给家长操作被 403 拦截；`IsDomainError` 错误码列表更新
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~ScheduleController"`

---

### 第 3 梯队：打卡 + 结算

#### Task 3.1: CheckinService 孩子仅自己打卡

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 0.3
- **产出文件**：
  - `api/Checkin/CheckinService.cs`（`GetAccessibleScheduleAsync` 新增 `role==Child && schedule.AssignedMemberId != userId → CHILD_ACCESS_DENIED`）
- **完成标准**：孩子仅能打卡/撤销自己的日程；家长代任意成员不变；「已离群」成员不接收新打卡沿用 checkin 模块既有 `NOT_FAMILY_MEMBER` 403 拦截，不新增分支（BE-05）
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~CheckinService"`

#### Task 3.2: SettlementJob streak 排除家长（逐 schedule 反查角色）

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 0.3
- **产出文件**：
  - `api/Infrastructure/Jobs/SettlementJob.cs`（状态结算保留全部；streak 更新改为**逐 schedule** 反查 `FamilyMembers(UserId==schedule.AssignedMemberId && FamilyId==schedule.FamilyId).Role`，仅 `role==Child` 的日程参与 `UpdateStreaksAsync`；家长日程跳过 streak）
- **完成标准**：家长日程照常写 `CheckinSettlement` 终态但跳过 streak；孩子 streak 照常；同一 `User.Id` 在不同家庭角色不同（一家庭家长、另一家庭孩子）时，逐 schedule 按所属家庭反查角色不误判
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~SettlementJob"`

---

### 第 4 梯队：模板

#### Task 4.1: TemplateService.ApplyAsync 多选成员（含 CreateAsync role 参数传递）

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1.4, 2.1
- **产出文件**：
  - `api/Template/Services/TemplateService.cs`（`ApplyAsync` 遍历 `request.MemberIds` 校验每个是家庭内成员（任意角色，去掉 `Role==Child` 限制），构造 `CreateScheduleRequest{ MemberIds = request.MemberIds }`；同步 `_scheduleService.CreateAsync(familyId, userId, UserRole.Parent, merged, ct)` 的新 role 参数——`TemplateController.Apply` 已是 parent-only，传 `UserRole.Parent`）
  - `openspec/contracts/template/errors.json`（`CHILD_NOT_IN_FAMILY` 标记 `deprecated: true`，描述指向 schedule 契约的 `MEMBER_NOT_IN_FAMILY`）
- **完成标准**：模板可多选家长/孩子生成日程；错误码用 `MEMBER_NOT_IN_FAMILY`（旧 `CHILD_NOT_IN_FAMILY` 为 deprecated 别名）；`CreateAsync` 调用补上新 role 参数，编译通过；template 契约 `CHILD_NOT_IN_FAMILY` 已标记 deprecated
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~TemplateService"`

---

### 第 5 梯队：后端测试

#### Task 5.1: Schedule 权限矩阵单测

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 2.1, 2.2, 2.3
- **产出文件**：
  - `api/Schedule/Services/__tests__/ScheduleServiceTests.cs`（补：家长任意成员/孩子仅自己/孩子越权给家长创建/孩子越权编辑删除）
  - `api/Schedule/Controllers/__tests__/ScheduleControllerTests.cs`（补：`CHILD_SELF_ASSIGN_ONLY`、`CHILD_ACCESS_DENIED` 分支）
- **完成标准**：覆盖 US-PAR-01/02/03/05/06 + BE-01/BE-02 场景
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~Schedule"`

#### Task 5.2: Checkin + Settlement 单测

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 3.1, 3.2
- **产出文件**：
  - `api/Checkin/__tests__/CheckinServiceTests.cs`（补：孩子仅自己打卡越权）
  - `api/Infrastructure/Jobs/__tests__/SettlementJobTests.cs`（补：家长分组跳过 streak、家长状态照常结算）
- **完成标准**：覆盖 US-PAR-09/10/11 + BE-03 场景
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~CheckinService|FullyQualifiedName~SettlementJob"`

#### Task 5.3: API 兼容层测试（旧字段名请求仍成功）

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1.2, 1.3, 1.4, 2.1
- **输入**：design.md §Decision 6（归一化优先级 + 响应双输出 + deprecated 别名）
- **产出文件**：
  - `api/Schedule/__tests__/ScheduleCompatTests.cs`（请求兼容：只传旧字段 `childIds` 仍能成功创建日程；`childIds` 与 `memberIds` 都传以 `memberIds` 为准；都不传 → 400 `MEMBER_NOT_SELECTED`；响应兼容：`assignedChildId` 与 `assignedMemberId` 同值）
  - `api/Schedule/__tests__/CalendarControllerTests.cs`（孩子角色携带 `memberId=其他成员Id` 或 `childId=其他成员Id` 查询日历 → 返回结果仍只含自己的日程；`memberId` 与 `childId` 都传时 `memberId` 优先——锁定「先归一化、后角色强制」的安全边界）
  - `api/Template/__tests__/TemplateCompatTests.cs`（旧字段 `childId` 单选归一化为 `memberIds` 单元素）
- **完成标准**：旧字段名请求（`childIds`/`childId`）仍能成功创建日程；旧错误码 `CHILD_NOT_SELECTED` 仍按 400 返回；新字段名优先；孩子强制过滤在归一化后生效（孩子传 `memberId=其他成员Id` 查日历仍只见自己）
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~Compat"`

---

### 第 6 梯队：前端 service/契约

#### Task 6.1: services/schedule.js + calendar.js 改名

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 0.2
- **产出文件**：
  - `app/services/schedule.js`（`checkConflict(childId,...)` → `checkConflict(memberId,...)`）
  - `app/services/calendar.js`（`queryMonth/queryWeek/queryDay(childId,...)` → `memberId`）
- **完成标准**：请求参数 `childIds`/`childId` 全部改为 `memberIds`/`memberId`，错误码引用 `app/contracts/schedule.js`
- **验证命令**：`cd app && npx jest`

#### Task 6.2: services/template.js + checkin.js 改名

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 0.2
- **产出文件**：
  - `app/services/template.js`（`apply` 请求 `childId` → `memberIds`）
  - `app/services/checkin.js`（如需，错误码引用统一）
- **完成标准**：模板 apply 多选成员参数正确
- **验证命令**：`cd app && npx jest`

---

### 第 7 梯队：前端组件/页面

#### Task 7.1: member-selector 组件（新建）

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 0.2
- **产出文件**：
  - `app/components/member-selector/index.{js,wxml,wxss,json}`（家长视角全体成员多选；孩子视角仅自己不可改、不出现家长；`data-id="member-selector-*"`）
- **完成标准**：多选/单选按角色正确；可交互元素含 `data-id`；家长视角 `memberList` 至少含当前用户（家庭无孩子、仅家长时仍有成员可选，废止「无孩子」空态，BE-07）
- **验证命令**：`cd app && npx jest`

#### Task 7.2: schedule-create 选成员 + 双文案

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6.1, 7.1
- **产出文件**：
  - `app/pages/schedule-create/index.{js,wxml}`（Step1 用 member-selector；`childIds` → `memberIds`；空态文案「请至少选择一个成员」；错误码 `MEMBER_NOT_SELECTED`）
- **完成标准**：家长选成员多选、孩子仅自己；提交参数 `memberIds`；空态/错误码文案更新；空态仅当 `memberList` 为空时出现（不再有「无孩子」阻塞空态，BE-07）
- **验证命令**：`cd app && npx jest`

#### Task 7.3: schedule-detail + schedule-edit 关联成员

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6.1
- **产出文件**：
  - `app/pages/schedule-detail/index.{js,wxml}`（「关联孩子」→「关联成员」，类型标签按 `assignedMemberRole` 双文案）
  - `app/pages/schedule-edit/index.{js,wxml}`（关联成员区）
- **完成标准**：详情/编辑显示成员名 + 角色感知 label
- **验证命令**：`cd app && npx jest`

#### Task 7.4: filter-bar + calendar-view 成员筛选

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6.1
- **产出文件**：
  - `app/components/filter-bar/index.{js,wxml}`（「按孩子」→「按成员」，默认「全部成员」）
  - `app/components/calendar-view/index.{js,wxml}`（卡片成员头像/名 + 角色感知 label）
- **完成标准**：按成员筛选 + 默认全部成员；卡片成员名/头像
- **验证命令**：`cd app && npx jest`

#### Task 7.5: type-selector 双文案

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 0.2
- **产出文件**：
  - `app/components/type-selector/index.{js,wxml}`（HomeworkTask 卡片按当前选中成员角色切「作业任务/待办事项」）
- **完成标准**：类型卡片 label 走 `app/contracts/schedule.js` 角色感知映射
- **验证命令**：`cd app && npx jest`

#### Task 7.6: use-template-dialog 多选成员

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6.2, 7.1
- **产出文件**：
  - `app/components/use-template-dialog/index.{js,wxml}`（「关联孩子」单选 →「关联成员」多选）
- **完成标准**：模板使用多选成员，提交 `memberIds`
- **验证命令**：`cd app && npx jest`

---

### 第 8 梯队：联调回归

#### Task 8.1: 后端全量测试

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 5.1, 5.2, 5.3
- **完成标准**：`dotnet test api/` 全绿，无回归
- **验证命令**：`dotnet test api/`

#### Task 8.2: 前端 Jest 回归

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 7.1~7.6 全部
- **完成标准**：`cd app && npx jest` 全绿，契约 parity 测试通过
- **验证命令**：`cd app && npx jest`

---

## 跨模块集成点

- **前后端联调**（Task 8.1 + 8.2 之后）：字段已走兼容层（Decision 6），后端同时接受/输出新旧字段，**非破坏性**——升级前的旧版小程序可继续运行。仍建议前后端同批合并，避免「前端发新名、后端尚未支持新名」的过渡窗口（虽然旧名仍可用）。
- **跨上下文**：`TemplateService.ApplyAsync`（Template）依赖 `ScheduleService.CreateAsync`（Schedule）的 `MemberIds` + 成员校验，Task 4.1 依赖 Task 2.1。
- **跨模块消费**：`CheckinService` / `SettlementJob` 依赖 `IScheduleQueryService.ScheduleInfo.AssignedMemberId` 改名，Task 3.1/3.2 依赖 Task 0.3。
- **兼容层移除时机**：`childIds`/`childId`/`assignedChildId` 旧字段 + `CHILD_NOT_SELECTED`/`CHILD_NOT_IN_FAMILY` 旧错误码为 deprecated，V+1 统一移除（含契约 `deprecated` 标记 + 前端旧字段读取分支清理），本次不移除。
