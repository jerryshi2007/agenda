# Design: 日程关联对象泛化（generalize-schedule-to-member）

> 日期：2026-08-23
> 上游：staging `production/staging/2026-08-23-家长日程/`（dev-ready，requirement.md / epic-story.md / review.md）
> 下游：dev-dotnet + dev-miniapp
> 变更类型：对已归档模块（日程管理 / 打卡 / 模板 / 家庭）的存量变更

---

## Context

现有日程管理模块的日程对象仅限「孩子」：`Schedule.AssignedChildId`（Guid）只存孩子的 `User.Id`，创建流程第一步「选孩子」必填可多选，`ScheduleController` 对非家长角色一律 403。家长自身与家庭中其他家长的日程无法进入系统，日历里只有孩子的安排。本次将「关联孩子」泛化为「关联成员」（家长 + 孩子），家长与孩子共用同一 `Schedule` 模型，实现"全家人的日程都在一个日历里"。

### 现状对账清单（现状对账 gate）

> 通过 codegraph 探查 `api/` 与 `app/` 已有实体/服务/组件/页面后逐项标注复用/扩展/新建。缺此清单即设计未完成（dev-codegraph rule）。

#### 数据模型与身份语义

| 现状符号 | 位置 | 本次处置 |
|---------|------|---------|
| `Schedule.AssignedChildId`（Guid，存 **User.Id**，非 FamilyMember.Id） | `api/Domain/Entities/Schedule.cs:15` | **迁移重命名**：语义泛化为「成员 User.Id」，C# 属性改名 `AssignedMemberId`，DB 列经正式 migration 重命名为 `AssignedMemberId`（不加 `[Column]`，用默认约定：属性名 = 列名） |
| `FamilyMember`（Id/FamilyId/UserId/Role/ChildName/DisplayMode）—— 家长与孩子**同一张表**，靠 `Role`（Parent=1/Child=2）区分 | `api/Domain/Entities/FamilyMember.cs` | **复用**（不新增表，仅用于成员角色解析） |
| `User.Role` / `FamilyMember.Role`（`UserRole` 枚举 Parent/Child） | `api/Domain/Enums/UserRole.cs` | **复用** |
| `GroupKey`（N 孩子 = N 条 Schedule，共享 GroupKey） | `Schedule.cs:19` | **复用**：泛化后 N 成员 = N 条 Schedule，天然支持「混合关联」per-member 独立 |

**关键结论**：`AssignedChildId` 存的是 `User.Id`（`ScheduleService.GetByIdAsync` 用 `Users.Id == AssignedChildId` 解析昵称；`ChildScheduleQueryService` 按 `AssignedChildId == userId` 过滤）。家长与孩子共用 `FamilyMember` 表，靠 `Role` 区分。因此泛化**无需引入 `FamilyMember.Id` 外键、无需新表**——列本就是 Guid，可直接存家长的 User.Id，成员角色通过 `FamilyMembers(UserId+FamilyId → Role)` 反查。唯一 DDL 变更是把列 `AssignedChildId` 重命名为 `AssignedMemberId`（一个可回滚的 migration，见 Decision 1），`RenameColumn` 不改数据，存量孩子行数据完整保留。

#### 后端服务/控制器

| 现状符号 | 位置 | 本次处置 |
|---------|------|---------|
| `ScheduleService.CreateAsync`（`foreach childId in request.ChildIds` 展开 N 行；`ValidateCreateRequest` 校验 `CHILD_NOT_SELECTED`） | `api/Schedule/Services/ScheduleService.cs:20/460` | **扩展**：`ChildIds`→`MemberIds`；新增「成员在家庭」校验 + 孩子仅自己校验 |
| `ScheduleService.GetByIdAsync`（已有 `role==Child && AssignedChildId!=userId → CHILD_ACCESS_DENIED`） | `ScheduleService.cs:146` | **扩展**：字段改名 + 新增返回 `AssignedMemberRole` |
| `ScheduleService.UpdateAsync/DeleteAsync/CancelInstanceAsync/RestoreInstanceAsync`（**无角色参数，无孩子越权检查**，靠 Controller 拦） | `ScheduleService.cs:203+` | **扩展**：增传 role，加孩子越权检查（与 GetByIdAsync 对齐） |
| `ScheduleController.Create/Update/Delete/Cancel/Restore`（`role != Parent → 403` 一刀切） | `api/Schedule/Controllers/ScheduleController.cs` | **扩展**：放开孩子角色（仅自己），新增 `CHILD_SELF_ASSIGN_ONLY` 越权拦截 |
| `ChildScheduleController`（只读，`EnsureChildAsync` + `AssignedChildId==userId` 过滤） | `api/Schedule/Controllers/ChildScheduleController.cs` | **复用**（孩子端可见性已满足 US-PAR-12，无需改） |
| `ChildScheduleQueryService`（`AssignedChildId==userId` 过滤） | `api/Schedule/Services/ChildScheduleQueryService.cs` | **复用**（无逻辑改动，随实体改名机械同步 `AssignedChildId`→`AssignedMemberId`） |
| `ScheduleQueryService`（`IScheduleQueryService.GetScheduleAsync` 返回 `ScheduleInfo.AssignedChildId`） | `api/Schedule/Services/ScheduleQueryService.cs` | **扩展**：`ScheduleInfo` 字段改名（供 checkin 模块消费） |
| `CalendarQueryService`（`CalendarQueryRequest.ChildId` 过滤 + 批量解析 User 名/头像） | `api/Schedule/Services/CalendarQueryService.cs` | **扩展**：`childId`→`memberId`；批量解析成员名/头像/角色 |
| `CalendarController.Query`（`[FromQuery] Guid? childId` 绑定 + `ChildId=childId` 赋值 + `role==Child → request.ChildId=User.GetUserId()` 孩子强制 self） | `api/Schedule/Controllers/CalendarController.cs:29,43,48-49` | **扩展**：绑定 `memberId`+`childId` 双参归一化；孩子强制过滤作用在归一化后的 `MemberId`（安全边界，见 Decision 6） |
| `ConflictDetectionService.CheckConflictAsync`（`AssignedChildId == request.ChildId`） | `api/Schedule/Services/ConflictDetectionService.cs` | **扩展**：`childId`→`memberId`（改名，逻辑不变） |
| `CheckinService.GetAccessibleScheduleAsync`（**仅校验家庭成员，不校验被分配者**） | `api/Checkin/CheckinService.cs:245` | **扩展**：孩子仅能打卡自己的日程（堵越权） |
| `SettlementJob`（`GroupBy(AssignedChildId)` per-child 事务；`UpdateStreaksAsync` 写 `StreakScope.Schedule` + `StreakScope.Child`） | `api/Infrastructure/Jobs/SettlementJob.cs` | **扩展**：状态结算保留全部；streak 更新排除家长成员 |
| `CompletionStatsService`（完成率/看板，孩子维度） | `api/Checkin/Services/CompletionStatsService.cs` | **复用**（仍孩子维度，家长日程天然不进入；无逻辑改动，随实体改名机械同步 `AssignedChildId`→`AssignedMemberId`） |
| `TemplateService.ApplyAsync`（`fm.Role == UserRole.Child` 校验 + `ChildIds=[request.ChildId]`） | `api/Template/Services/TemplateService.cs:260` | **扩展**：单选孩子 → 多选成员，去掉「仅孩子」校验 |

#### 后端基础设施

| 现状符号 | 位置 | 本次处置 |
|---------|------|---------|
| `ErrorCodes.cs`（**无 schedule 模块错误码**，schedule 全用裸字符串字面量） | `api/Infrastructure/ErrorCodes.cs` | **扩展**：新增 schedule 模块错误码常量（从 contracts 生成） |
| `AppDbContext` / `Configurations` | `api/Infrastructure/Data/` | **扩展**（无新实体/新表；`ScheduleConfiguration` 同步 `AssignedMemberId`；新增一个列重命名 migration） |
| `DomainException` + 全局中间件 | `api/Infrastructure/` | **复用** |

#### 契约与前端

| 现状符号 | 位置 | 本次处置 |
|---------|------|---------|
| `openspec/contracts/{auth,checkin,family,template}/` | `openspec/contracts/` | **复用**；**新建** `openspec/contracts/schedule/`（schedule 模块此前无契约） |
| `app/contracts/{auth,checkin,family,template}.js`（契约镜像 + parity 测试） | `app/contracts/` | **复用**；**新建** `app/contracts/schedule.js`（含双文案 label 映射） |
| `app/services/schedule.js/calendar.js/template.js/checkin.js` | `app/services/` | **扩展**：`childIds`/`childId` → `memberIds`/`memberId` |
| `app/pages/schedule-create/index.js`（`childIds: selected.map(c => c.userId)`；空态文案「请选择孩子」） | `app/pages/schedule-create/` | **扩展**：选成员 + 双文案 + 空态文案 |
| `app/pages/schedule-detail/`、`schedule-edit/` | `app/pages/` | **扩展**：关联成员区 |
| `app/components/child-selector/`（目录为空，需新建文件） | `app/components/` | **新建**：`member-selector` 组件 |
| `app/components/filter-bar/`、`calendar-view/`、`type-selector/` | `app/components/` | **扩展**：成员筛选、成员名/头像、双文案 |
| `app/globalData.childList`（成员列表来源） | `app/app.js` | **扩展**：改为成员列表（含家长） |

---

## Goals / Non-Goals

**Goals**：
- 关联对象泛化到「成员」，家长孩子共用同一 `Schedule` 模型，一次列重命名迁移、向后兼容（存量行数据不变）
- 完整权限矩阵：家长任意成员、孩子仅自己、孩子越权拦截（创建/编辑/删除/代打卡）
- 类型双文案（作业任务/待办事项）按关联成员角色渲染，与查看者无关
- 打卡泛化到成员；家长日程保留状态结算但排除 streak/统计
- 模板关联成员多选；冲突检测对象随成员泛化
- 三端契约共享（`openspec/contracts/schedule/` JSON 为单一真相源）

**Non-Goals**（首期不做）：
- 家长日程纳入统计（家长维度完成率/streak/看板）—— Could，后续迭代
- 家长日程订阅提醒 —— Could，后续迭代
- 家长独立类型体系/自定义类型 —— 明确不做（复用三类 + 双文案）
- 展示模式改动 —— 本次不触碰
- 存量数据回填/转换脚本 —— 本次仅列重命名（不改数据、不回填），无其它数据迁移

---

## Decisions

### Decision 1: 身份语义与迁移 —— `AssignedChildId` 存 `User.Id`，属性与 DB 列一并改名为 `AssignedMemberId`（正式迁移）

**Context**：现状 `AssignedChildId` 存的是 `User.Id`（非 `FamilyMember.Id`），家长与孩子共用 `FamilyMember` 表靠 `Role` 区分。原方案「零迁移 + `[Column("AssignedChildId")]` 保持列名」经用户否决，改为**正常 EF Core 迁移**：属性名与 DB 列名统一为 `AssignedMemberId`。

**Decision**：
- **代码层改名**：C# 实体属性 `AssignedChildId` → `AssignedMemberId`，**不加 `[Column]`（用默认约定，属性名 = 列名）**。`ScheduleConfiguration` 同步改 `AssignedMemberId`（`Property(e => e.AssignedMemberId)` + 索引 `HasIndex(e => e.AssignedMemberId)` 与 `HasIndex(e => new { e.FamilyId, e.AssignedMemberId })`）。DTO 内部属性改用新名（`MemberIds`/`AssignedMemberId`/`MemberId`）。**API 边界的新旧并存由 Decision 6 兼容层负责**，内部命名不受兼容层影响。
- **数据层迁移**：新增一个 migration `RenameAssignedChildIdToAssignedMemberId`，`Up` 用 `RenameColumn`（`AssignedChildId` → `AssignedMemberId`）+ `RenameIndex`（`IX_Schedules_AssignedChildId` → `IX_Schedules_AssignedMemberId`、`IX_Schedules_FamilyId_AssignedChildId` → `IX_Schedules_FamilyId_AssignedMemberId`）；`Down` 完整反向（可回滚，遵守 dev-dotnet-standards「迁移可回滚」）。**必须手写为 Rename，禁止 drop+add**——EF Core 脚手架默认把列改名生成为 drop column + add column（丢数据），须手工改为 `RenameColumn`/`RenameIndex` 以保留存量数据。
- **成员角色反查**：`AssignedMemberId(User.Id) + FamilyId → FamilyMembers(Role)`。双文案、打卡权限、streak 排除均需此反查。

**Alternatives Considered**：
- ❌ 引入 `FamilyMember.Id` 外键（`AssignedMemberId` 指向 memberId）：语义更严谨，但需迁移列语义 + 回填存量 `User.Id → FamilyMember.Id`，改动面大。
- ❌ 保留 `AssignedChildId` 字段名不改：最小改动但命名误导（存家长 User.Id 却叫 ChildId），违反「命名表意图」。
- ❌ 零迁移 + `[Column("AssignedChildId")]`（原方案）：无 DDL 无 backfill，但 DB 列名仍是误导性的 `AssignedChildId`，属「命名表意图」妥协；已被用户否决，改用正式迁移让列名与语义一致。

**Consequences**：
- ✅ 列名与语义一致（`AssignedMemberId`），不加 `[Column]` 后无「隐藏列名」负担
- ✅ 成员角色反查复用 `FamilyMembers` 已有索引（UserId+FamilyId）
- ⚠️ 需一次 migration + 生产部署执行（见 §部署与回滚）；`RenameColumn` 不改数据，存量孩子日程行完整保留

---

### 决策变更记录（ADR）：零迁移 → 正式 EF Core 迁移

- **Status**：Accepted（2026-08-23，用户拍板）
- **Context**：原 Decision 1 在「零迁移」硬约束下用 `[Column("AssignedChildId")]` 让 C# 属性名 `AssignedMemberId` 映射到旧列名，避免 DDL。用户否决该硬约束，要求属性名与 DB 列名统一走正式迁移。
- **Decision**：不加 `[Column]`（用默认约定，属性名 = 列名），新增 `RenameAssignedChildIdToAssignedMemberId` migration，`Up` 重命名列与索引、`Down` 反向还原。生产环境不自动迁移（`Database.Migrate()` 仅 Development，见 `Program.cs:149`），部署由运维/CI-CD 手动 `dotnet ef database update`。
- **改名范围界定（列名 vs 其它字段）**：
  - **唯一改名的落库列**：`Schedules.AssignedChildId` → `AssignedMemberId`（含其两个索引 `IX_Schedules_AssignedChildId`、`IX_Schedules_FamilyId_AssignedChildId` 同步重命名）。
  - **不落库、不受影响**：`ChildIds`/`ChildId`/`childId`/`assignedChildId` 均为请求/响应 DTO 字段（序列化边界），由 Decision 6 兼容层处理新旧并存，不涉及 DB。
  - **其它落库的 child 相关字段保持原名、不属本次泛化范围**：`FamilyMember.ChildName`（孩子显示名覆盖）、`InvitationCode.TargetChildName`/`TargetDisplayMode`（邀请孩子专用）。
  - **枚举值非列名、不改**：`UserRole.Child=2`、`StreakScope.Child=2`、`CheckinSource.Child=2`（均为枚举值，非 DB 列名）；`Streak.SubjectId`（多态列）语义保持「孩子整体 User.Id」，streak 仍仅孩子维度，本次不重构。
- **Consequences**：+ 列名与语义一致；− 引入一次迁移与部署步骤（可控、可回滚）。

---

### Decision 2: 越权拦截层 —— Controller 角色门 + Service 成员校验（不引入授权策略框架）

**Context**：现状无 ASP.NET 授权策略（无 `[Authorize(Policy)]`），权限靠 Controller 角色判断 + Service 局部检查。孩子越权（给家长创建/编辑/删除/代打卡家长日程）需服务端强制。

**Decision**：
- **Controller 层**：`ScheduleController` 各 Action 保留 `GetFamilyContextAsync` 取 role。`Create` 放开孩子角色，但孩子提交的 `MemberIds` 必须 `== [currentUserId]`，否则 403 `CHILD_SELF_ASSIGN_ONLY`。`Update/Delete/Cancel/Restore` 不再一刀切 `role != Parent`，改由 Service 判断。
- **Service 层**（业务规则集中地）：
  - `CreateAsync`：校验每个 `MemberIds` 是家庭内成员（`MEMBER_NOT_IN_FAMILY`，补现有缺口）；孩子仅自己（`CHILD_SELF_ASSIGN_ONLY`，需把 role 传入 Service）。
  - `UpdateAsync/DeleteAsync/CancelInstanceAsync/RestoreInstanceAsync`：新增 role 参数 + `role==Child && AssignedMemberId != userId → CHILD_ACCESS_DENIED`（与 `GetByIdAsync` 已有一致）。
  - `CheckinService.GetAccessibleScheduleAsync`：新增 `role==Child && AssignedMemberId != userId → CHILD_ACCESS_DENIED`（堵「孩子代其他孩子打卡」缺口）。

**Alternatives Considered**：
- ❌ 引入 `IAuthorizationHandler` + policy：对存量单 csproj 过重，破坏现有「Controller + Service 校验」模式，YAGNI。
- ❌ 只在 Controller 拦：编辑/删除的成员归属判断需读 Schedule，放 Controller 会重复查询，且 Service 复用方（TemplateService.ApplyAsync 走 CreateAsync）会被绕过。

**Consequences**：
- ✅ 与现有「Controller 角色门 + Service 业务校验」模式一致，增量不重写
- ✅ 越权拦截在 Service 兜底，前端隐藏仅 UX 优化，防篡改请求（US-PAR-06/BE-01/BE-02）
- ⚠️ **有意边界（已确认接受）**：后端只校验「成员 == 自己」，**不感知 DisplayMode**，不做「非高年级孩子」门槛。高年级/非高年级孩子的创建入口可见性由前端 DisplayMode 控制；绕过小程序直调 API 时，非高年级孩子也能创建自己的日程——属已知且接受的风险，不做服务端拦截。

---

### Decision 3: 双文案 —— 后端返回成员角色，前端按角色渲染 label（不新增类型枚举）

**Context**：三种 `ScheduleType` 枚举不变，仅 `HomeworkTask` 在关联对象为家长时显示「待办事项」。label 取决于**关联成员角色**，与查看者无关（决策 #7）。BE-11 定案：混合关联时**按每个成员各自显示**（孩子行「作业任务」、家长行「待办事项」）。

**Decision**：
- **后端**：枚举值与数据**不变**；仅在 schedule 响应（日历/详情/列表）新增 `AssignedMemberRole`（Parent/Child）。后端**不产出**文案 label。
- **前端**：`app/contracts/schedule.js` 新增角色感知 label 映射：
  ```
  ScheduleTypeLabels = { AfterSchoolActivity: '课后活动', DailyRoutine: '日常作息', HomeworkTask: { Parent: '待办事项', Child: '作业任务' } }
  ```
  渲染时取 `ScheduleTypeLabels[type][assignedMemberRole]`（HomeworkTask）或单值（其他两型）。
- **BE-11 的详情页成员上下文**：因「N 成员 = N 条 Schedule 行（GroupKey）」，日历/列表本就按行（=按成员）渲染，点击某行导航时携带该行的 `scheduleId`。详情页成员上下文 = `schedule.AssignedMemberId`，无需新增传递机制——`scheduleId` 天然唯一标识「某个成员的某条日程」。

**Alternatives Considered**：
- ❌ 后端返回 label：后端需按成员角色拼中文文案，把 UI 关注点泄入后端，且与现有 `app/contracts/*.js` 前端 label 模式不一致。
- ❌ 按查看者角色切（reviewer S2 提到的旧解读）：与已定案决策 #7（按关联成员角色）矛盾，且孩子看不到家长日程，跨角色场景不成立。

**Consequences**：
- ✅ 枚举/数据零改动，后端仅多返回一个角色字段
- ✅ BE-11 混合关联 per-member label 天然由「N 行」模型满足，无额外机制
- ⚠️ 前端所有展示 HomeworkTask label 的位置（创建类型卡片/详情/日历卡片/筛选/模板）都需接入角色感知映射

---

### Decision 4: 结算边界 —— 状态结算保留全部，streak 仅孩子维度

**Context**：`SettlementJob` 按 `AssignedChildId` 分组，`ProcessChildSettlementAsync` 先写 `CheckinSettlement` 终态，再 `UpdateStreaksAsync` 写 `StreakScope.Schedule`（SubjectId=ScheduleId）+ `StreakScope.Child`（SubjectId=AssignedChildId）。家长日程需「保留状态结算、排除 streak」（决策 #11 / S1）。

**Decision**：
- **状态结算**（写 `CheckinSettlement` 终态）：对**所有**日程执行，不分成员角色（家长日程照常「未完成→已结束/未完成/逾期未完成」）。
- **streak 更新**：仅当日程关联的成员在该日程所属家庭中是**孩子**时执行。实现：**逐 schedule 反查角色**——对每条待结算日程用 `FamilyMembers(UserId==schedule.AssignedMemberId && FamilyId==schedule.FamilyId)` 反查 `Role`，仅 `role==Child` 的日程参与 `UpdateStreaksAsync`（含单日程 `StreakScope.Schedule` streak）；分组内若均为家长日程则跳过。**必须绑定 `schedule.FamilyId`，不能只按 `AssignedMemberId` 分组后对每组反查单一 role**——同一 `User.Id` 可在不同家庭扮演不同角色（在自己家是 Parent、在父母家是 Child），按组反查会把「家庭 A 的家长日程」误判为「家庭 B 的孩子日程」从而错误写入 streak（跨家庭角色误判）。`StreakScope.Child` 整体 streak（`SubjectId=User.Id`）的跨家庭聚合属既有行为，本次不重构。
- **完成率/看板**：`CompletionStatsService` 本就按孩子维度查询（`AssignedChildId` 关联孩子），家长日程天然不进入，无需改（US-PAR-11/BE-03）。

**Alternatives Considered**：
- ❌ 家长日程连状态结算也跳过：违反决策 #11「保留状态流转」，且家长日程会永久停在「未完成」态，UI 无法显示终态。
- ❌ 在 streak 表加 role 维度：streak 仍仅孩子维度（决策 #4），无需为家长建维度。

**Consequences**：
- ✅ 家长日程状态正确终态化，UI 完整
- ✅ streak 数据不被家长日程污染，统计口径不变
- ⚠️ `SettlementJob` 增加一次 `FamilyMembers` 反查（逐 schedule，量小）

---

### Decision 5: 限界上下文与项目结构 —— 不新增 csproj，模块内扩展

**Context**：本次是存量变更，非新模块。项目结构已定：单 csproj `api/` 按模块目录（Schedule/Checkin/Family/Template/Auth/Domain/Infrastructure）+ PostgreSQL 单库 + `app/` 小程序。

**Decision**：
- **项目数量**：维持 `api/`（单 .NET csproj）+ `app/`（小程序）两目录，**不新增项目**。
- **命名空间**：沿用 `Agenda.Api.*`，变更落在 `Agenda.Api.Schedule` / `Agenda.Api.Checkin` / `Agenda.Api.Template` / `Agenda.Api.Infrastructure` 既有命名空间。
- **数据库**：单 PostgreSQL 库，**一个 migration**（列 `AssignedChildId` → `AssignedMemberId` 重命名，可回滚，见 Decision 1）；契约域新增 `openspec/contracts/schedule/`。

**Consequences**：✅ 增量对齐现有 4 模块布局，无构建/DI 新增复杂度。

---

### Decision 6: API 兼容层 —— 新旧字段/错误码并存一个版本（deprecated 别名）

**Context**：小程序已有生产部署（腾讯云轻量 + docker 单容器）。一刀切改名 `childIds`→`memberIds`、`assignedChildId`→`assignedMemberId`、`CHILD_NOT_SELECTED`→`MEMBER_NOT_SELECTED` 等，会让升级前的旧版客户端报错（读不到新字段名、匹配不到新错误码）。需在「语义清晰改名」与「存量客户端零破坏」之间平衡。

**Decision**：
- **请求 DTO（反序列化层，API 边界）**：`CreateScheduleRequest` 同时接受 `childIds`（旧，deprecated）与 `memberIds`（新）。归一化优先级：**两者都传 → `memberIds` 为准**；仅传旧 → 归一化为 `memberIds`；**都不传 → 400 `MEMBER_NOT_SELECTED`**。同理 `CalendarQueryRequest.childId`/`memberId`、`ScheduleConflictCheckRequest.childId`/`memberId`、`ApplyTemplateRequest.childId`（旧单选）→ `memberIds`（新多选）。归一化实现放反序列化边界（独立旧属性 + 归一化方法，或自定义 converter），保证「memberIds 优先」与 JSON 字段顺序无关。
- **日历查询的孩子强制过滤顺序（安全边界）**：`CalendarController.Query` 绑定 `memberId`（新）+ `childId`（旧，deprecated）双查询参数后，**先归一化、再角色强制**——① 归一化：都传 → `memberId` 优先；仅传 `childId` → 归一化为 `memberId`；都不传 → `memberId=null`（全部成员）；② 角色强制：`role==Child` 时强制 `request.MemberId = User.GetUserId()`（覆盖客户端传入的任何 `memberId`/`childId` 值）。**绝不**在归一化前用 `childId` 做孩子强制，也绝不只强制 `childId` 而不强制 `memberId`——否则孩子传 `memberId=家长Id` 会经「memberId 优先」覆盖强制 self，越权看到家长日程。强制赋值必须落在归一化后的最终成员字段 `MemberId` 上（或同时覆写 `MemberId` + `ChildId` 新旧两个字段）。
- **响应 DTO（序列化层，API 边界）**：`ScheduleResponse` / `ScheduleSummary` / `CalendarSchedule` 同时输出 `assignedMemberId`（新）+ `assignedChildId`（旧，同值）+ `assignedMemberRole`（新）。旧版小程序读 `assignedChildId` 不报错。
- **错误码**：新增 `MEMBER_NOT_SELECTED` / `MEMBER_NOT_IN_FAMILY` / `CHILD_SELF_ASSIGN_ONLY` 等新码；旧码 `CHILD_NOT_SELECTED` / `CHILD_NOT_IN_FAMILY` 保留为 **deprecated 别名**，继续返回同一 HTTP 状态。`CHILD_ACCESS_DENIED` 不改名，无别名。契约 `errors.json` 中为旧码加 `deprecated: true`。**运行时行为**：Service 抛新码常量（`ErrorCodes.MemberNotSelected` 等）；schedule 模块的错误处理路径是 `ScheduleController.IsDomainError` 错误码列表 + 各 Action 的 `catch (InvalidOperationException ex) when (IsDomainError(ex.Message))`（**非** `DomainException`/全局中间件——全局 `ExceptionHandlingMiddleware` 处理的是 `DomainException`，而 schedule 模块抛的是 `InvalidOperationException` + 字符串匹配），需把旧码别名（`CHILD_NOT_SELECTED`/`CHILD_NOT_IN_FAMILY`）保留在 `IsDomainError` 列表中并映射到同一 HTTP 状态，防御遗留代码路径仍抛旧字符串；错误响应体 `error` 字段携带新码。旧版客户端若匹配旧码字符串，则优雅降级为通用错误提示（HTTP 状态不变，非崩溃）。
- **C# 内部**：实体属性 `AssignedMemberId`（DB 列随 migration 同步重命名，不加 `[Column]`，默认约定），DTO 属性用新名 `MemberIds`/`AssignedMemberId`/`MemberId`；旧名只做在 API 边界（DTO 序列化/反序列化），不进 Service/Domain 内部。
- **移除时机**：下一个版本（V+1）移除全部 deprecated 旧字段/旧错误码，同时清理契约 `deprecated` 标记与前端旧字段读取分支。

**Alternatives Considered**：
- ❌ 一刀切改名（原设计）：语义清晰但破坏存量客户端，违背「生产部署零破坏」。
- ❌ 永久保留旧名：契约双份常驻，命名误导永久化，维护成本持续。

**Consequences**：
- ✅ 升级前的旧版客户端继续可用（读 `assignedChildId`、收 `CHILD_NOT_SELECTED` 旧错误码）
- ✅ 新版客户端用新名，语义清晰，为 V+1 彻底移除旧名铺路
- ⚠️ 契约/序列化层短期双份字段，需 parity 测试 + 单元测试锁定「旧字段名请求仍能成功创建日程」
- ⚠️ V+1 移除旧名时需跨端同步（一次性清理 deprecated 标记 + 前端兼容分支）

---

## API 契约轮廓

> 机读定义见 `openspec/contracts/schedule/{enums,errors,dto}.json`。下表为设计概览。

### 端点与 DTO 变更（无新增路由）

| 端点 | 方法 | 变更 |
|------|------|------|
| `/api/v1/schedules` | POST | 请求 `memberIds`（新）+ `childIds`（deprecated 兼容）；放开孩子角色（仅自己）；新增成员在家庭 + 孩子越权校验 |
| `/api/v1/schedules/{id}` | GET | 响应 `assignedMemberId` + `assignedChildId`（deprecated）+ `assignedMemberRole` |
| `/api/v1/schedules/{id}` | PUT | 放开孩子角色（仅自己） |
| `/api/v1/schedules/{id}` | DELETE | 放开孩子角色（仅自己） |
| `/api/v1/schedules/{id}/cancel` · `/restore` | POST | 放开孩子角色（仅自己） |
| `/api/v1/schedules/check-conflict` | POST | `memberId`（新）+ `childId`（deprecated 兼容） |
| `/api/v1/calendar` | GET | `memberId`（新）+ `childId`（deprecated）；响应项含 `assignedMemberId` + `assignedChildId`（deprecated）+ `assignedMemberRole` |
| `/api/v1/templates/{id}/apply` | POST | `memberIds`（新，多选）+ `childId`（deprecated，单选归一化） |
| `/api/v1/checkin` · `/api/v1/checkin/undo` | POST | 孩子仅自己能打卡/撤销（服务端收紧） |

### 关键 DTO 形状（含兼容层新旧并存，见 Decision 6）

**CreateScheduleRequest**（改动）：
```jsonc
{ "name": "string", "scheduleType": "ScheduleType",
  "memberIds": ["Guid"],              // 新字段（归一化后的唯一来源）
  "childIds": ["Guid"],               // deprecated 旧字段；都传以 memberIds 为准；都不传 → 400 MEMBER_NOT_SELECTED
  "timeSlots": [...], "repeatEndDate": "...", "location": "...", "notes": "...",
  "dueDate": "...", "suggestedStartTime": "...", "suggestedEndTime": "...",
  "ignoreConflict": false, "sourceTemplateId": null }
```

**ScheduleResponse**（改动，含双文案所需角色）：
```jsonc
{ "scheduleId": "Guid", "name": "string", "scheduleType": "ScheduleType",
  "assignedMemberId": "Guid",          // 新字段
  "assignedChildId": "Guid",           // deprecated 旧字段，与 assignedMemberId 同值
  "assignedMemberRole": "Parent|Child",
  "assignedMemberName": "string", ... }
```

**CalendarQueryRequest**（改动）：`memberId`（新，可空=全部成员）+ `childId`（deprecated 旧字段，都传以 `memberId` 为准）。

**ScheduleConflictCheckRequest**（改动）：`memberId`（新）+ `childId`（deprecated 旧字段，都传以 `memberId` 为准）。

**ApplyTemplateRequest**（改动）：`memberIds`（新，多选）+ `childId`（deprecated 旧字段，单选，归一化为单元素 `memberIds`）。

### 错误码（新建 schedule 契约，含新码 + deprecated 别名）

| 错误码 | HTTP | 中文提示 | 变更 |
|--------|:--:|------|------|
| `MEMBER_NOT_SELECTED` | 400 | 请至少选择一个成员 | 新码（原 `CHILD_NOT_SELECTED` 语义） |
| `CHILD_NOT_SELECTED` | 400 | 请至少选择一个成员 | **deprecated 别名**（兼容期保留，V+1 移除） |
| `MEMBER_NOT_IN_FAMILY` | 400 | 所选成员不属于当前家庭 | 新码（补现有缺口） |
| `CHILD_NOT_IN_FAMILY` | 400 | 所选成员不属于当前家庭 | **deprecated 别名**（兼容期保留，V+1 移除） |
| `CHILD_SELF_ASSIGN_ONLY` | 403 | 孩子只能给自己创建日程 | 新增（越权拦截） |
| `CHILD_ACCESS_DENIED` | 403 | 你只能查看/操作自己的日程 | 保留（编辑/删除/打卡越权复用） |
| `SCHEDULE_NOT_FOUND` | 404 | 日程不存在 | 保留（归入 schedule 契约） |
| `SCHEDULE_NAME_EMPTY` / `_TOO_LONG` / `SCHEDULE_TYPE_INVALID` / `LOCATION_TOO_LONG` / `NOTES_TOO_LONG` / `REPEAT_END_DATE_INVALID` / `DUE_DATE_REQUIRED` / `DUE_DATE_INVALID` / `NO_DAY_SELECTED` / `TIME_SLOT_INVALID` / `INVALID_SCOPE` | 400 | — | 现有裸字符串转契约常量 |
| `SCHEDULE_CONFLICT` | 409 | 该时段存在时间重叠 | 保留 |
| `CONCURRENT_EDIT_CONFLICT` | 409 | 日程已被他人修改，请刷新 | 保留 |

> 完整列表见 `openspec/contracts/schedule/errors.json`。`SCHEDULE_NOT_FOUND`/`NOT_FAMILY_MEMBER` 与 `checkin` 契约存在历史重叠，本次不强制去重（schedule 契约作为 schedule 域权威定义，checkin 契约保留其面向 checkin 的引用）。

### 契约覆盖与跨域 deprecate 同步说明

- **dto.json 覆盖范围**：`openspec/contracts/schedule/dto.json` 本次仅收录**本次变更触及的 DTO**（`CreateScheduleRequest`/`TimeSlotDto`/`ScheduleSummary`/`CreateScheduleResponse`/`ScheduleResponse`/`ScheduleConflictCheckRequest`/`CalendarQueryRequest`/`CalendarSchedule`/`ApplyTemplateRequest`）。存量未改动 DTO（`UpdateScheduleRequest`/`UpdateScheduleResponse`/`CancelScheduleInstanceRequest`/`CancelScheduleInstanceResponse`/`RestoreScheduleInstanceRequest`/`RestoreScheduleInstanceResponse`/`DeleteScheduleResponse`——均已复核**不含任何 `childId`/`memberId` 关联字段**，本次不迁移入 schedule 契约），仍以 `api/Schedule/Dtos/` 后端代码 + Swagger 为准，待后续「契约全量补全」独立变更统一迁入。schedule 域 DTO 的权威定义以本契约已收录子集为准。
- **跨域错误码 deprecate 同步**（`CHILD_NOT_IN_FAMILY` / `CHILD_ACCESS_DENIED`）：
  - `CHILD_NOT_IN_FAMILY` 同时存在于 `template` 契约（`template/errors.json`，message「所选孩子不属于当前家庭」）与本次新建的 `schedule` 契约（deprecated 别名）。Task 4.1 让 `TemplateService` 改用 `MEMBER_NOT_IN_FAMILY`（schedule 契约新码）后，`template/errors.json` 的 `CHILD_NOT_IN_FAMILY` 已同步标记 `deprecated: true`，V+1 与 schedule 契约的 deprecated 别名一并移除。
  - `CHILD_ACCESS_DENIED` 在 `schedule`（「你只能查看或操作自己的日程」）与 `template`（「孩子角色无权访问模板」）契约同码不同 message，属历史同码复用、语义各自独立。本次不强制合并：两契约各自保留其域内语义，schedule 域错误码以 `schedule/errors.json` 为准，template 域以 `template/errors.json` 为准。

---

## ER 图（可反推场景）

```
┌─────────────────────────┐
│      Users (existing)    │
│ Id (PK) · Nickname · Role│
└──────────┬──────────────┘
           │ 1
           │ UserId
           │ N
┌──────────▼──────────────┐
│   FamilyMembers (exist.) │  Role ∈ {Parent, Child}
│ Id(memberId) · FamilyId  │◄── 成员角色反查：AssignedMemberId(User.Id)+FamilyId → Role
│ UserId · Role · ChildName│
└──────────┬──────────────┘
           │ 1
           │ FamilyId
           │ N
┌──────────▼──────────────┐
│   Schedules (existing)   │
│ Id(PK) · AssignedMemberId│   AssignedMemberId = 成员 User.Id（家长或孩子），
│   (列名 = 属性名)        │   N 成员 = N 行，GroupKey 关联同一「日程」
│ FamilyId · GroupKey      │
│ ScheduleType · CreatedBy │
│ RowVersion · IsDeleted   │
└─────┬──────────────┬─────┘
      │ 1            │ 1
      │              │
      │ N            │ N
┌─────▼──────┐  ┌────▼─────────────┐
│ TimeSlots  │  │ Checkins (exist.)│  UNIQUE(ScheduleId, Date) —— 每行=每成员独立打卡
│ Cancellation│ │ CheckinSettlement│
│ DateExclusion││ Streaks (exist.) │  Scope∈{Schedule,Child}；Child 维度仅孩子成员
└────────────┘  └──────────────────┘
```

**关系基数从 spec scenario 反推**：
- `FamilyMember 1—N Schedule`：US-PAR-01/02/03（一个成员可有多条日程；一条日程关联一个成员，混合关联拆成多行）
- `Schedule 1—N TimeSlot`：event-crud（每日程多时间槽）
- `Schedule 1—N Checkin`（UNIQUE ScheduleId+Date）：US-PAR-03（各成员打卡独立 = 每行一条打卡记录）
- `Streak(Child 维度) 0..1—N Schedule`：checkin-settlement（孩子整体 streak 由孩子成员的 DailyRoutine 聚合）

---

## 核心时序

### 1. 家长创建混合关联日程（US-PAR-01/02/03）

```
家长 → ScheduleController.Create
  → GetFamilyContextAsync (role=Parent)
  → role==Parent，跳过 self-only 校验
  → 冲突检测（每成员 CheckConflictAsync，MemberId 各自）
  → ScheduleService.CreateAsync(familyId, createdBy, role=Parent, request{MemberIds:[家长B,小明]})
       → 反序列化归一化（API 边界）：memberIds 优先于 childIds（都传以 memberIds 为准）
       → ValidateCreateRequest：MemberIds 非空 → 逐成员校验在家庭（MEMBER_NOT_IN_FAMILY）
       → foreach memberId：new Schedule{ AssignedMemberId=memberId, GroupKey 共享 }
       → 小明行 + 家长B行 各一条，各自独立
  → 201 返回 GroupKey + Schedules
```

**异常分支**：`memberIds` 与 `childIds` 都不传 → 400 `MEMBER_NOT_SELECTED`；成员不在家庭 → 400 `MEMBER_NOT_IN_FAMILY`；时间重叠同成员 → 409 `SCHEDULE_CONFLICT`（软提示可继续）。

### 2. 孩子越权给家长创建（US-PAR-06 / BE-01）

```
孩子(高年级) 篡改请求 MemberIds=[家长B]
→ ScheduleController.Create
  → GetFamilyContextAsync (role=Child)
  → role==Child 且 MemberIds != [self] → 403 CHILD_SELF_ASSIGN_ONLY，不落库
（防御纵深：ScheduleService.CreateAsync 同样校验 role==Child && MemberIds==[self]）
```

### 3. 孩子编辑/删除家长日程（US-PAR-06 / BE-02）

```
孩子 → ScheduleController.Update(scheduleId=家长B的schedule)
  → 不再一刀切 403，进入 ScheduleService.UpdateAsync(..., role=Child)
  → 查得 schedule.AssignedMemberId != userId → 403 CHILD_ACCESS_DENIED，日程不变
```

### 4. 打卡（US-PAR-09/10 + 孩子越权）

```
家长A 代 家长B/小明 打卡 → CheckinService.CheckinAsync
  → GetAccessibleScheduleAsync：role=Parent，放行（代任意成员）
  → source=Parent，写 Checkin{UserId=家长A, Source=Parent}

孩子 打卡他人日程 → GetAccessibleScheduleAsync：role=Child 且 AssignedMemberId != userId
  → 403 CHILD_ACCESS_DENIED（堵越权）
```

### 5. 每日结算（US-PAR-11 / 决策 #11）

```
SettlementJob.ExecuteAsync
  → 昨日日程 GroupBy(AssignedMemberId)
  → 状态结算（写 CheckinSettlement 终态）：所有成员（不分角色）
  → streak 更新（UpdateStreaksAsync）：逐 schedule 反查 FamilyMembers(UserId==schedule.AssignedMemberId && FamilyId==schedule.FamilyId).Role，仅 role==Child 的日程参与
```

### 6. 日历按成员筛选 + 双文案（US-PAR-13 / US-PAR-07/08）

```
家长 → CalendarController.Query
  → [FromQuery] 绑定 memberId（新）+ childId（旧 deprecated）
  → 归一化（API 边界）：都传以 memberId 为准；仅 childId → 归一化为 memberId；都不传 → memberId=null（全部成员）
  → role==Parent：memberId 作为筛选条件（null=全部成员）
  → CalendarQueryService.QueryAsync：过滤 AssignedMemberId == memberId
  → 批量解析成员 User 名/头像 + 角色 → CalendarSchedule{ assignedMemberId, assignedMemberRole }
  → 前端：HomeworkTask + assignedMemberRole=Parent → "待办事项"；Child → "作业任务"

孩子（越权安全分支，US-PAR-12 / BE-08）：
  → 归一化后，role==Child → 强制 request.MemberId = User.GetUserId()（覆盖客户端传入的 memberId/childId）
  → CalendarQueryService 过滤 AssignedMemberId == 自己的 User.Id
  → 结果仅含自己的日程；孩子传 memberId=家长Id 也看不到家长日程
```

---

## 前端架构

### 组件/页面变更

| 组件/页面 | 变更 |
|-----------|------|
| `app/components/member-selector/`（新建，替代空目录 `child-selector`） | 成员选择器：家长视角全体成员多选；孩子视角仅自己不可改、不出现家长 |
| `app/components/filter-bar/` | 「按孩子」→「按成员」，默认「全部成员」 |
| `app/components/calendar-view/` + `day/week/month-view` | 卡片成员头像/名；孩子端仅显示自己的（复用现有过滤） |
| `app/components/type-selector/` | HomeworkTask 卡片按当前选中成员角色切「作业任务/待办事项」 |
| `app/pages/schedule-create/` | Step1 选孩子 → 选成员；空态文案「请至少选择一个成员」 |
| `app/pages/schedule-detail/` | 关联孩子区 → 关联成员区；类型标签按成员角色 |
| `app/pages/schedule-edit/` | 关联成员区 |
| `app/components/use-template-dialog/` + `app/pages/template-list/` | 关联成员多选（替代单选孩子） |

### 状态管理

沿用现有 `app.globalData`（不引入 Pinia/Vuex——小程序原生）。`globalData.childList` → `globalData.memberList`（含家长 + 孩子，每项含 `userId`/`role`/`name`/`avatarUrl`）。孩子端成员列表仅注入自己（`globalData.memberList` 由后端 `/api/v1/family/members` 返回后按当前角色过滤）。

### 契约镜像

`app/contracts/schedule.js`（新建，parity 测试锁定与 `openspec/contracts/schedule/*.json` 一致）导出：`ScheduleType`、`ScheduleTypeLabels`（角色感知）、`Scope`、`ErrorCodes`、`ErrorMessages`、`HttpStatus`。`app/contracts/template.js` 中的 `ScheduleTypeLabels` 保留（模板类型卡片默认按孩子语义「作业任务」，或按模板使用时的成员角色切换，由 UI 决定）。

---

## 构建序列

1. **契约层**：`openspec/contracts/schedule/{enums,errors,dto}.json`（含 deprecated 标记）+ `app/contracts/schedule.js` + parity 测试
2. **后端实体/DTO 改名 + 迁移 + 兼容层**：`Schedule.AssignedMemberId`（不加 `[Column]`，默认约定）+ `ScheduleConfiguration` 同步 + 列重命名 migration（`RenameAssignedChildIdToAssignedMemberId`）+ DTO 新字段 + API 边界新旧并存（`childIds`/`assignedChildId` deprecated 别名 + 归一化/双输出）
3. **后端权限 + 校验**：Controller 放开孩子角色 + `CHILD_SELF_ASSIGN_ONLY`；Service 成员在家庭 + 孩子越权检查；`ErrorCodes` 常量（新码 + deprecated 别名）
4. **后端打卡/结算**：`CheckinService` 孩子仅自己；`SettlementJob` streak 排除家长
5. **后端模板**：`ApplyTemplateRequest.MemberIds` 多选 + `childId` 兼容归一化
6. **后端测试**：单元测试覆盖权限矩阵 + 结算 streak 排除 + 兼容层（旧字段名请求仍成功）
7. **前端 service/契约**：`services/*.js` 参数改名 + `contracts/schedule.js`（新字段名，兼容旧响应字段）
8. **前端组件/页面**：`member-selector` + 各页面双文案/成员筛选
9. **联调 + 回归**：`dotnet test api/Agenda.Test/` + `cd app && npx jest`

---

## 边界与异常落点说明（BE-05 / BE-07）

> 这两条边界不在 US-PAR 主流程内，但属 requirement §11 明确要求的验收项，在此显式标注落点，避免下游遗漏。

- **BE-05（关联成员被移出家庭）**：分两段落点——
  - 「编辑提交时校验成员仍在家庭」→ 由本次新增的 `MEMBER_NOT_IN_FAMILY` 校验覆盖（创建 Task 2.1、编辑 Task 2.2）。
  - 「已移除成员打卡条目标记"已离群"、不接收新打卡」→ **沿用 checkin 模块既有逻辑（`NOT_FAMILY_MEMBER` 403 拦截），不新增代码**。本次只需确保 `CheckinService.GetAccessibleScheduleAsync` 的孩子越权检查（Task 3.1）不与既有家庭成员校验冲突，无需为「已离群」写新分支。
- **BE-07（家庭无孩子、仅家长，废止「无孩子」空态）**：**纯前端改动，后端无「无孩子」阻塞逻辑**（后端创建从不要求家庭必须存在孩子，只校验「所选成员在家庭」）。落点在 Task 7.1（`member-selector` 组件：家长视角 `memberList` 至少含当前用户，永远有成员可选）+ Task 7.2（`schedule-create` 空态文案从「无孩子」改为「无成员」，且仅当 `memberList` 为空时出现）。原 `module-event BE-08`「无孩子」空态不再适用。

---

## 部署与回滚（列重命名 migration）

- **生产环境不自动迁移**：`Program.cs` 中 `db.Database.MigrateAsync()` 已包在 `if (app.Environment.IsDevelopment())` 内（`Program.cs:149`），生产环境启动**不会**自动执行迁移。生产部署时由运维/CI-CD 手动执行迁移命令（遵守 dev-dotnet-standards「生产环境不自动迁移」）。
- **迁移文件名**：`20260823000000_RenameAssignedChildIdToAssignedMemberId`（沿用 `YYYYMMDDHHMMSS_Name` 约定，时间戳取生成当日）。
- **部署（应用迁移）**：
  ```bash
  dotnet ef database update --project api/Agenda.Api/ --startup-project api/Agenda.Api/
  ```
  （目标连接串取 `api/appsettings.json` 的 `DefaultConnection`，生产环境由环境变量注入。）
- **回滚（撤销本次列重命名）**：
  ```bash
  dotnet ef database update 20260819014740_AddTemplateModule --project api/Agenda.Api/ --startup-project api/Agenda.Api/
  ```
  （回退到上一迁移 `AddTemplateModule`，即执行 `RenameAssignedChildIdToAssignedMemberId` 的 `Down`，把列名与索引名改回 `AssignedChildId`。）
- **验证点（重命名不改数据）**：`RenameColumn`/`RenameIndex` 仅改列/索引名，不改任何行数据。部署后验证：`SELECT count(*) FROM "Schedules"` 行数不变；抽查存量孩子行 `"AssignedMemberId"` 仍等于原 `AssignedChildId` 值；应用层「命名表意图」达成（不加 `[Column]` 后无隐藏列名）。

---

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|------|------|------|
| 列重命名 migration 执行失败或回滚不彻底 | 部署中断 / 数据不一致 | `RenameColumn`/`RenameIndex`（非 drop+add）不改数据；`Down` 完整还原；部署前在 staging 验证 Up/Down；生产手动执行（见 §部署与回滚） |
| 兼容层旧字段/旧错误码短期双份维护 | 契约/DTO 复杂度上升 | 契约 `deprecated` 标记 + parity/单测锁定「旧字段名仍可用」；V+1 统一清理（Decision 6 定移除时机） |
| 孩子越权检查遗漏（编辑/删除/取消/恢复/打卡多入口） | 越权 | Service 层集中加检查 + 单元测试逐入口覆盖（US-PAR-06/BE-01/BE-02） |
| 结算 streak 排除遗漏家长分组 | 统计被污染 | SettlementJob 反查成员角色 + 单测覆盖家长分组跳过 streak |
| 双文案遗漏展示位 | 文案不一致 | 前端统一走 `app/contracts/schedule.js` label 映射，禁止散落硬编码 |
| 混合关联（家长+孩子）标签 | 用户困惑 | 依赖「N 行」模型天然 per-member，BE-11 已定案，无额外机制 |

**已确认/已解决的设计决策**（用户拍板，供 reviewer 与下游参照）：
1. ~~API 字段/错误码改名（BREAKING）~~ → **已解决**：采用 Decision 6 兼容层，新旧并存一个版本，非破坏性（V+1 移除旧名）。
2. 孩子「自主添加」后端边界 → **已确认接受**：后端只做「成员 == 自己」越权校验，**不做 DisplayMode 门槛**（有意边界，见 Decision 2 Consequence——绕过小程序直调 API 时非高年级孩子也能创建，属已知且接受的风险）。
3. change name `generalize-schedule-to-member` → **确认采用**。
4. 划分原则（不新增 csproj / 命名空间 / 数据库，全在既有上下文内扩展）→ **确认采用**（Decision 5）。
5. 「零迁移」硬约束 → **已被否决**：改为正式 EF Core 迁移，`AssignedChildId` 属性与 DB 列一并重命名为 `AssignedMemberId`（`RenameColumn`，可回滚），见 Decision 1 + 决策变更记录（ADR）。
