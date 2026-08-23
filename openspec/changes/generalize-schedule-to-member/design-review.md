# 架构设计审核报告 · 家长日程（generalize-schedule-to-member）

> 审核对象：`openspec/changes/generalize-schedule-to-member/`（design.md + proposal.md + tasks.md + 6 份 delta spec + contracts/schedule/*）
> 审核日期：2026-08-23 | 审核人：arch-architect-reviewer
> 对照真相源：`production/staging/2026-08-23-家长日程/`（requirement.md / epic-story.md / review.md）+ `openspec/specs/` 已归档六域
> 审核方法：按 `arch-review` skill 11 维度扫描；现状对账清单通过 `codegraph_explore` 逐条独立复核

---

## 零、现状对账清单独立复核结果（dev-codegraph 硬 gate）

> 用 codegraph 对 `api/` 与 `app/` 已有代码逐条核验，结论如下。**对账清单核心论断全部属实**，仅一处遗漏（见 B1）。

| 对账清单论断 | 复核结论 | 证据 |
|------------|:--:|------|
| `AssignedChildId` 存 **User.Id**（非 FamilyMember.Id） | ✅ 属实 | `ScheduleService.GetByIdAsync` 用 `_db.Users.FirstOrDefaultAsync(u => u.Id == schedule.AssignedChildId)` 解析昵称（ScheduleService.cs:153-155）；`CalendarQueryService` 批量 `Users.Where(u => childIds.Contains(u.Id))`（:65-69）；`TemplateService.ApplyAsync` 用 `fm.UserId == request.ChildId`（:278）；前端 `schedule-create/index.js:214` `childIds: selected.map(c => c.userId \|\| c.childId)` |
| `FamilyMember`（Id/UserId/Role/ChildName/DisplayMode），家长孩子同表靠 Role 区分 | ✅ 属实 | FamilyMember.cs:13-21；UserRole.cs Parent=1/Child=2 |
| `SettlementJob` per-child：`GroupBy(AssignedChildId)` + `StreakScope.Schedule`/`StreakScope.Child` | ✅ 属实 | SettlementJob.cs:49 `GroupBy(e => e.AssignedChildId)`；:134 `UpsertStreakAsync(StreakScope.Schedule, routine.Id, …)`；:144 `UpsertStreakAsync(StreakScope.Child, childId, …)` |
| `ScheduleController` Create/Update/Delete/Cancel/Restore `role != Parent → 403` 一刀切 | ✅ 属实 | ScheduleController.cs:35/95/132/156/180 |
| `ScheduleService.UpdateAsync/DeleteAsync/Cancel/Restore` 无 role 参数、无孩子越权检查 | ✅ 属实 | UpdateAsync 签名 `(scheduleId, request, userId, familyId, ct)`（ScheduleService.cs:203），体内无 role 判断 |
| `CheckinService.GetAccessibleScheduleAsync` 仅校验家庭成员、不校验被分配者 | ✅ 属实 | CheckinService.cs:245-262 只查 `fm.UserId == userId && fm.FamilyId == schedule.FamilyId` 取 role，未比对 `AssignedMemberId` |
| `ErrorCodes.cs` 无 schedule 模块、schedule 全用裸字符串 | ✅ 属实 | ErrorCodes.cs 仅 Auth/Checkin/Family 三节；ScheduleController/ScheduleService 散落 `"CHILD_NOT_SELECTED"` 等字面量 |
| `TemplateService.ApplyAsync` `Role==Child` 校验 + `ChildIds=[request.ChildId]` | ✅ 属实 | TemplateService.cs:276-283（`fm.Role == UserRole.Child`）+ :314 `ChildIds = new List<Guid>{ request.ChildId }` |
| `CalendarQueryService` childId 过滤 + 批量解析 User | ✅ 属实 | CalendarQueryService.cs:41-42 `request.ChildId.HasValue → AssignedChildId == childId`；:65-69 批量查 User |
| `ConflictDetectionService` `AssignedChildId == request.ChildId` | ✅ 属实 | ConflictDetectionService.cs:24 |
| `CompletionStatsService` 孩子维度、家长日程天然不进入、无需改 | ✅ 属实 | CompletionStatsService.cs:33 `AssignedChildId == userId`（仅孩子自身 User.Id，家长行天然排除） |
| 孩子端可见性已满足 US-PAR-12、无需改 | ✅ 属实（后端） | `ChildScheduleQueryService` `AssignedChildId == userId` 过滤 + `CalendarController.Query` :48-49 `role==Child → request.ChildId = User.GetUserId()` |

**结论**：`AssignedChildId` 存 User.Id（非 FamilyMember.Id）这一关键论断、以及 `SettlementJob` streak per-child 写，均经独立复核属实。零迁移方案（`[Column("AssignedChildId")]` 保持列名不变）在 EF Core 下成立——列名不改则无 DDL、无迁移，存量孩子日程行完全兼容。**对账清单唯一遗漏：`CalendarController` 的改动未列入**（见 B1）。

---

## 一、11 维度总览

| # | 维度 | 结论 | 严重度 |
|---|------|------|:--:|
| 1 | 需求覆盖 | US-PAR-01~15 逐条落到 delta spec/tasks；BE-01~11 大体覆盖，BE-05/BE-07 未显式落点 | ⚠️ 建议 |
| 2 | ER 关系可反推 | 关系基数均有 spec 依据；但「FamilyMember—Schedule」经 FamilyId 的画法略偏离实际（Schedule 无 FamilyMember.Id 外键，实为 AssignedMemberId→User.Id 软引用），正文已补说明 | ⚠️ 建议 |
| 3 | 时序完整 | 6 条时序覆盖正常+异常；创建/编辑/删除/打卡/结算/日历 越权链路均有说明 | ✅ |
| 4 | ADR 充分 | 6 ADR 均含 Context/Decision/Alternatives/Consequences；存量变更无需新增「认证/UI框架/状态管理」类决策，充分 | ✅ |
| 5 | 规则合规 | 无 TBD/TODO、无硬编码密钥、无同步阻塞异步、无裸 wx.request；契约 JSON 齐全；对账清单基本准确 | ✅ |
| 6 | 质量底线 | Risks 识别了越权遗漏/streak 污染/双文案遗漏/混合关联等关键风险；无占位符 | ✅ |
| 7 | 限界上下文合理 | 不新增 csproj，模块内扩展，跨上下文交互（Template→Schedule、Checkin→ScheduleQuery）已标注 | ✅ |
| 8 | API 契约完整 | contracts 齐全且大体一致；ScheduleSummary 缺 role、CHILD_NOT_IN_FAMILY 跨域重叠、dto 未覆盖全量 DTO、ScheduleConflictCheckRequest 错误码疑似笔误 | ⚠️ 建议 |
| 9 | 前端架构对齐 | 沿用 globalData（小程序原生，不引 Pinia）；memberList 改造、data-id、契约镜像均合理 | ✅ |
| 10 | 构建序列可行 | 8 梯队依赖无环；Task 8.1 依赖图漏列 5.3；Task 4.1 未显式说明 role 参数传递 | ⚠️ 建议 |
| 11 | 现状对账完整 | **对账清单核心论断全部属实，但遗漏 `CalendarController`**（child 角色强制过滤 + query param 绑定随改名受影响） | ❌ 阻塞 |

---

## 二、问题清单（按严重度排序）

### 阻塞（Blocking）

**B1｜现状对账清单 + tasks 遗漏 `CalendarController` 的改动，埋下「新字段筛选失效」+「孩子越权」双风险。**

`CalendarController.Query`（`api/Schedule/Controllers/CalendarController.cs:29,43,48-49`）有三处直接受 `childId`→`memberId` 改名影响，但对账清单只列了 `CalendarQueryService`（扩展），Task 1.3 产出文件只有 `CalendarResponse.cs`：

- :29 `[FromQuery] Guid? childId` —— 新版客户端发 `memberId` 查询参数不会被绑定（controller 仍只绑 `childId`）
- :43 `ChildId = childId`
- :48-49 `if (role == Child) request.ChildId = User.GetUserId();` —— **孩子仅见自己的安全强制过滤**

**后果**：
1. **功能缺陷（US-PAR-13）**：新版客户端 `GET /api/v1/calendar?memberId=…` 的成员筛选被静默忽略，日历按成员筛选对升级后客户端失效。
2. **潜在越权（US-PAR-12 / BE-08）**：Decision 6 归一化「memberId 优先」。若 dev-dotnet 补绑 `memberId` 但漏改 :49 的角色强制到新字段 `MemberId`（仍强制 `ChildId`），孩子传入 `memberId=<家长Id>` 会经「memberId 优先」覆盖强制 self，从而看到家长日程。

**修复**：对账清单补 `CalendarController`；Task 1.3 产出文件加 `CalendarController.cs`，并明确「绑定 `memberId`+`childId` 双参、归一化后孩子角色强制 `MemberId = User.GetUserId()`（覆盖客户端传入值）」。这是审批前必须补的项。

### 建议（Suggestion）

**S1｜`SettlementJob` 角色反查的 familyId 语义不精确（Decision 4）。** `ExecuteAsync` 按 `AssignedChildId`（=User.Id）分组，无 FamilyId 维度（SettlementJob.cs:49）；而同一 User.Id 可同时是家庭 A 的 Parent、家庭 B 的 Child（家长孩子同表 + 多家庭绑定）。Decision 4 写「对每组用 `FamilyMembers(UserId==AssignedMemberId && FamilyId==familyId)` 反查 role」未说明 familyId 从哪来。建议改为**按 schedule.FamilyId 逐条反查**（或按 `(FamilyId, AssignedMemberId)` 分组），Task 3.2 同步明确，避免跨家庭角色误判 streak 排除。当前 streak `SubjectId=User.Id` 本身已跨家庭聚合属既有行为，本次新增的 role 反查应至少绑定 schedule.FamilyId。

**S2｜`dto.json` 的 `ScheduleSummary` 缺 `assignedMemberRole`/`assignedMemberName`，与 Decision 6 prose 不一致。** Decision 6 写「ScheduleResponse / ScheduleSummary / CalendarSchedule 同时输出 assignedMemberId + assignedChildId + assignedMemberRole」，但 dto.json 的 ScheduleSummary 只有 assignedMemberId + assignedChildId。创建混合关联日程后，若前端要立即按成员角色渲染「待办事项/作业任务」标签，需 create 响应含 role。建议补齐 ScheduleSummary.assignedMemberRole，或显式声明「创建响应不含 role，前端用选成员时的已知角色」。

**S3｜`CHILD_NOT_IN_FAMILY` / `CHILD_ACCESS_DENIED` 跨域契约重叠未说明。** `CHILD_NOT_IN_FAMILY` 现由 template 契约持有（`template/errors.json:14`，message「所选孩子不属于当前家庭」），本次 schedule 契约将其定义为 deprecated 别名但 message 改为「所选成员不属于当前家庭」；design 的「历史重叠」脚注只提 SCHEDULE_NOT_FOUND/NOT_FAMILY_MEMBER 与 checkin，未提 CHILD_NOT_IN_FAMILY 与 template。Task 4.1 让 TemplateService 改用 `MEMBER_NOT_IN_FAMILY` 后，template 契约的 `CHILD_NOT_IN_FAMILY` 需同步 deprecate，否则三端契约不一致。同理 `CHILD_ACCESS_DENIED` 在 template（「孩子角色无权访问模板」）与 schedule（「只能查看/操作自己的日程」）message 语义不同但同码。建议在 design 补充跨域 deprecate 同步计划。

**S4｜`ScheduleConflictCheckRequest` 的「都不传」错误码疑似笔误。** dto.json 中 memberId 描述写「都不传报 TIME_SLOT_INVALID」，但「缺少冲突检测对象」与「时间槽非法」语义无关。建议改为专门的参数错误码（如 MEMBER_NOT_SELECTED 或新增），或明确该场景预期。

**S5｜schedule 契约 dto.json 仅覆盖「改动的 DTO」，未覆盖 schedule 域全量 DTO。** dev-contracts rule 定义 dto.json 为三端单一真相源，但本次新建的 schedule 契约只含 8 个改动 DTO，未含未改动的 UpdateScheduleRequest/DeleteScheduleRequest/CancelScheduleInstanceRequest/RestoreScheduleInstanceRequest 及对应 Response。作为 schedule 域权威契约覆盖面不完整。建议补全，或显式声明「本契约仅含本次变更 DTO，存量 DTO 不迁入」。

**S6｜Task 4.1 未显式说明 `TemplateService.ApplyAsync → ScheduleService.CreateAsync` 的新 role 参数传递。** Task 2.1 给 CreateAsync 增 role 参数后，ApplyAsync（:322 `_scheduleService.CreateAsync(familyId, userId, merged, ct)`）的调用签名需同步加 role（TemplateController.Apply 已是 parent-only，可传 UserRole.Parent）。Task 4.1 只提「去掉 Role==Child 限制」，未提签名变更。建议在 Task 4.1 产出补一句「同步 CreateAsync 新 role 参数」。

**S7｜Decision 6「错误处理中间件将旧码别名映射同一 HTTP 状态」与 schedule 模块实际错误处理机制不符。** schedule 模块当前不用 DomainException/全局中间件，而是 `InvalidOperationException` + `ScheduleController.IsDomainError` 字符串匹配 + 每 Action try/catch。deprecated 别名映射需落在 `IsDomainError` 列表与各 Action catch 路径（Task 2.3 已提「IsDomainError 错误码列表更新」，方向正确），但 prose 的「中间件」措辞易误导 dev-dotnet。建议修正措辞。

**S8｜BE-05（成员被移出家庭的「已离群」打卡标记）与 BE-07（废止「无孩子」空态）未在 delta spec / tasks 显式落点。** 需求要求「沿用 module-event BE-18/BE-23」，但 design 只通过 `MEMBER_NOT_IN_FAMILY`（创建时校验）覆盖了「编辑提交校验成员在家庭」，未显式说明「已离群」打卡标记是否真的无需新代码、以及前端「无孩子」空态的废止落在哪个 task。建议在 tasks 或 design 显式标注「沿用既有逻辑、不新增」，避免下游遗漏 US-PAR 之外的两条边界。

**S9（轻微）｜Task 0.3 实体改名会机械影响对账清单标记为「复用/无需改」的 `ChildScheduleQueryService`、`CompletionStatsService`。** `Schedule.AssignedChildId → AssignedMemberId` 是跨文件机械改名（ChildScheduleQueryService.cs:54/80/165、CompletionStatsService.cs:33 等）。对账清单对这些文件写「复用/无需改」指「无逻辑改动」，但实体改名仍强制机械同步。建议措辞改为「无逻辑改动，随实体改名机械同步」，避免 dev-dotnet 误以为这些文件完全不碰。

**S10（轻微）｜Task 8.1 依赖图漏列 Task 5.3。** 依赖关系图写「Task 8.1 后端全量测试 ← 依赖 5.1, 5.2」，但 `dotnet test api/` 会跑含 5.3（兼容层测试）在内的全部测试，8.1 应依赖 5.3。

---

## 三、三判决

| 判决 | 结论 |
|------|------|
| 设计质量 | ⚠️ 有保留（现状对账核心论断准确、契约大体一致、任务可执行，但 CalendarController 遗漏 + 数处契约/结算细节不一致） |
| 规则合规 | ✅ 合规（无 TBD/TODO、无硬编码密钥、无同步阻塞异步、契约文件齐全、对账清单基本准确，未发现 rule 违规） |
| 审批建议 | ⚠️ 建议有条件批准（修复 B1 CalendarController 后批准） |

---

## 四、待澄清问题及结果

| 问题 | 结论 | 状态 |
|------|------|------|
| 零迁移是否成立 | 成立：`AssignedChildId` 存 User.Id（已复核），`[Column("AssignedChildId")]` 保列名即无 DDL/迁移 | ✅ 已复核 |
| 后端是否做 DisplayMode 门槛 | 不做，只做「成员==自己」越权校验（Decision 2 已确认接受的有意边界） | ✅ 已确认（非缺陷） |
| 双文案按关联成员角色（非查看者） | 是（Decision 3，与用户拍板决策 #7 一致） | ✅ 已确认 |
| streak 是否仅孩子维度 | 是（Decision 4，SettlementJob per-child 已复核） | ✅ 已复核 |
| 兼容层新旧并存一个版本、error 返回新码 | 是（Decision 6，与用户拍板一致） | ✅ 已确认 |

无新增需人工拍板的疑问项——用户已拍板的 6 项约束在设计中均正确落档，未发现违反。

---

## 五、审核备注

- 本报告**不代替人工审批**。三层人审批（架构审核）是硬 Gate，本报告仅给出建议，最终由主代理呈交用户决策。
- **结论性意见**：本设计整体质量高，现状对账清单经 codegraph 独立复核**核心论断全部属实**（尤其「AssignedChildId=User.Id 非 FamilyMember.Id」与「SettlementJob streak per-child」），零迁移方案成立；契约 JSON 齐全、任务拆解可执行、越权拦截两层覆盖了创建/编辑/删除/取消/恢复/打卡/模板全部写入路径（TemplateService.ApplyAsync 复用 CreateAsync，孩子越权兜底一致）。唯一阻塞项 B1（CalendarController 遗漏）是局部、可快速补齐的缺口；其余 S1~S10 为建议级，不阻塞审批但建议在进入 Stage 3 前由 arch-architect 一并修订 design.md/tasks.md/contracts 后定稿。
