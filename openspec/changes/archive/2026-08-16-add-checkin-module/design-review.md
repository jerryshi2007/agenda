# Design Review (现状对账修正复审): 打卡与统计模块

> Change: `add-checkin-module` | Reviewed by: arch-architect-reviewer | Date: 2026-08-16
>
> 复审目标：复核 arch-architect 完成「现状对账修正」后的 design.md，重点核验现状对账清单真实性（第 11 维）、对账修正是否引入新的不一致、以及 3 处「⚠️ 待确认」项的裁决。抽查依据：`codegraph explore`（未 Read 大文件 / grep 全仓库）。

---

## 复审结论

**现状对账清单大部分断言真实可信**（Schedule 实体字段、ScheduleType/ScheduleStatus 枚举、AppDbContext 7 DbSet、schedule-detail data-id、checkin.js stub、contracts 仅 auth/ 均与真实代码一致）。**但存在 1 条事实性错误**：清单第 55 行断言 `IScheduleQueryService`「不存在」，而真实代码已在 `api/Domain/Interfaces/IScheduleQueryService.cs` 中预置了专供 checkin-module 消费的接口及其实现 `ScheduleQueryService`（ADR-017 依赖反转）。该错误连带 design.md line 176 复用目标错误、tasks.md Task 2.1/2.2 仍要新建重复接口。

此外发现 **2 个独立阻塞项**（结算任务范围与 delta spec 矛盾、tasks.md 未同步残留旧术语/旧页面）与若干建议项。**共 3 阻塞项，建议驳回，待修复后复审。**

---

## 一、现状对账清单真实性核验（第 11 维，重点 1）

抽查 design.md §「现状对账清单」逐条与真实代码比对：

| # | 清单断言 | codegraph 抽查结果 | 结论 |
|---|---------|-------------------|:--:|
| 1 | `Schedule` 实体 Id=Guid、含 GroupKey/AssignedChildId/SourceScheduleId/OverrideDate/RowVersion，导航 TimeSlots/Cancellations/DateExclusions | `api/Domain/Entities/Schedule.cs` 逐字段确认：全部命中；导航含 `SourceSchedule`/`DerivativeSchedules` | ✅ |
| 2 | 时间槽走 `TimeSlot` 实体（DayOfWeek+StartTime/EndTime），非扁平 StartTime/EndTime | `ScheduleQueryService.GetTimeSlotAsync` 按 `date.DayOfWeek` 查 `TimeSlots` 表；`CreateScheduleRequest` 用 `TimeSlotDto` | ✅ |
| 3 | `ScheduleType` = AfterSchoolActivity=1/DailyRoutine=2/HomeworkTask=3 | `api/Domain/Enums/ScheduleType.cs` 逐值命中 | ✅ |
| 4 | `ScheduleStatus` = Incomplete=1/Completed=2/Cancelled=3/Ended=4/Overdue=5 | `api/Domain/Enums/ScheduleStatus.cs` 逐值命中 | ✅ |
| 5 | `ScheduleStatusHelper.DeriveInstanceStatus` 返回 excluded/cancelled/overdue/ended/incomplete 字符串 | `ScheduleStatusHelper.cs` 逐值命中（但语义见建议 S5） | ✅ |
| 6 | `AppDbContext` 已含 7 个 DbSet、无 Checkin | `AppDbContext.cs` 命中：Users/Families/FamilyMembers/Schedules/TimeSlots/Cancellations/ScheduleDateExclusions，无 Checkin | ✅ |
| 7 | `schedule-detail` 已含 data-id：checkin-btn/checkin-btn-disabled/undo-btn/checkin-record-{childId} | `app/pages/schedule-detail/index.wxml` 命中（line 99/114/119/126） | ✅ |
| 8 | `app/services/checkin.js` 已有 stub：getWindow/checkin/undo/getRecords | 命中，方法名与设计稿不一致、undo 用 body 形式（见裁决 #2） | ✅ |
| 9 | `openspec/contracts/` 仅 auth/ 存在，无 checkin/ | `find contracts` 命中：仅 auth/enums+errors+dto | ✅ |
| 10 | `GetByIdAsync` 已返回 CanCheckin/CanUndo/InstanceStatus/IsCancelled/IsExcluded | `ScheduleResponse.cs` 命中：含上述 5 字段 + CheckinRecords | ✅ |
| **11** | **`IScheduleQueryService`（原设计假设）「不存在」** | **`api/Domain/Interfaces/IScheduleQueryService.cs` 存在，`ScheduleQueryService` 实现之** | ❌ **失实** |

**结论**：清单 10/11 条真实，第 11 条（line 55）事实性错误——是本次复审的唯一硬伤断言，详见阻塞项 B1。第 5 条字符串值真实但语义需澄清（建议 S5）。

---

## 二、11 维度总览

| # | 维度 | 结论 | 说明 |
|---|------|:--:|------|
| 1 | 需求覆盖 | ❌ | checkin-record spec 全覆盖；checkin-settlement spec 的「状态 transition / 幂等 / 连续天数更新」被 design §7 单方面降级为「首期不写库骨架」，spec 与 design 范围矛盾（B2） |
| 2 | ER 关系可反推 | ✅ | User—Checkin / Schedule—Checkin / Schedule—Cancellation 基数均可从 spec scenario 反推，无凭空关系 |
| 3 | 时序完整 | ✅ | 7 个时序覆盖正常 + 异常 + 并发 + 竞态 + 结算调度；鉴权 401/403/422 拒绝路径有说明 |
| 4 | ADR 充分 | ✅ | ADR-010/011/012/013 四类决策（存储/调度/幂等/时间判定）均含四段式；ADR-010 虚拟实例是 B2 的根源但决策本身自洽 |
| 5 | 规则合规 | ❌ | 违反 dev-codegraph（对账清单 line 55 失实）+ dev-contracts（Event 术语残留未统一、contracts/checkin 未产出） |
| 6 | 质量底线 | ✅ | 无 TBD/TODO；Risks R1-R9 识别关键风险（含撤销竞态、客户端时钟、Hangfire 暴露） |
| 7 | 限界上下文合理 | ⚠️ | Checkin/Schedule/Family/Auth 聚合边界清晰；但跨上下文接口（IScheduleQueryService）被误判为「不存在」，复用目标错误 |
| 8 | API 契约完整 | ❌ | contracts/checkin/ 未产出；错误码沿用 Event 术语（B1 附带的术语问题）；status 枚举缺 "excluded"（S1）；undo 路径三处不一致（S2） |
| 9 | 前端架构对齐 | ⚠️ | data-id 表与真实页面一致，但 tasks.md 仍用 event-detail 前缀；状态机缺 "excluded" |
| 10 | 构建序列可行 | ❌ | tasks.md 依赖图节点「2.IScheduleQueryService」已失效；Task 2 应删除/改为复用真实接口 |
| 11 | 现状对账完整 | ❌ | 清单已存在且大部分真实，但 line 55 断言失实 → 违反 dev-codegraph「对账 MUST 真实」 |

---

## 三、问题清单

### 阻塞项（审批前必须修复）

**B1 — 现状对账清单 line 55 断言 `IScheduleQueryService`「不存在」，与真实代码相悖（重点 1）**

- 真实代码：`api/Domain/Interfaces/IScheduleQueryService.cs` 已存在，`api/Schedule/Services/ScheduleQueryService.cs` 实现它。接口注释明确「IScheduleQueryService 实现——供 checkin-module 调用」「ADR-017：依赖反转——checkin 模块定义接口，Schedule 模块实现」。
- 5 个方法（`GetScheduleAsync` / `GetTimeSlotAsync` / `GetCancellationStatusAsync` / `IsDateExcludedAsync` / `GetDueDateAsync`）恰好覆盖打卡窗口判定所需（类型/时间槽/取消/排除/截止日）。
- 此外 `ScheduleResponse` 已预置 `CanCheckin/CanUndo/InstanceStatus/IsCancelled/IsExcluded/CheckinRecords` 字段——Schedule 模块已为打卡窗口做了大量前瞻工作。
- **为什么会导致返工**：design.md line 176 写「复用 ScheduleService/CalendarQueryService/ScheduleStatusHelper（原设计假设的 IScheduleQueryService 接口并不存在，无需新造）」——复用目标错误；tasks.md Task 2.1/2.2 仍要新建 `api/Checkin/IScheduleQueryService.cs`（签名 `GetScheduleForCheckinAsync`）+ `MockScheduleQueryService.cs`，与真实 `Domain/Interfaces/IScheduleQueryService`（签名 `GetScheduleAsync`）冲突，dev-dotnet 照做会产出重复接口 + 错误依赖。
- **可执行修正**：
  1. design.md line 55 改为「`IScheduleQueryService`（Domain/Interfaces）+ `ScheduleQueryService`（Schedule/Services）已存在，专供 checkin 消费，复用之」。
  2. design.md line 176 改为「复用 `IScheduleQueryService`/`ScheduleQueryService`，并参考 `ScheduleResponse` 已预置的 CanCheckin/CanUndo 状态推导」。
  3. tasks.md Task 2 整节删除或改为「DI 注册 `ScheduleQueryService` 为 `IScheduleQueryService` 实现」，删除 `MockScheduleQueryService`。

**B2 — 结算任务范围与 delta spec 矛盾（需求覆盖）**

- delta spec `checkin-settlement/spec.md` 的四条 Requirement——「Daily Settlement Execution」（状态 transition）、「Settlement Idempotency」（transition 前查当前状态）、「Settlement Error Recovery」（DB 写失败重试）、「Streak Update During Settlement」（连续天数更新）——都要求结算任务**写库**（状态持久化 + 连续天数）。
- design.md §7（line 902-912）明确 Phase 1 结算「不写库」「业务逻辑仅做验证性遍历」「连续天数更新→二期」，绑定 ADR-010 虚拟实例模式。
- proposal.md「What Changes」也写「更新连续完成天数」「保证幂等性」。
- **为什么会导致返工**：design 未覆盖 delta spec 的结算状态变更/幂等/连续天数需求，dev-dotnet 按 design 实现会交付不满足 spec 验收标准的结算任务；spec 与 design 的「是否写库」分歧若留到 Stage 3 才拍，checkin-settlement spec 与测试用例都要返工。
- **可执行修正**（需审批人拍板，二选一）：
  - 方案 A：确认 Phase 1 结算不写库 → 回写 `checkin-settlement/spec.md`，将 Streak/Idempotency/Error Recovery 的写库语义标记为二期或删除，仅保留「定时触发 + 触发时机」骨架语义。
  - 方案 B：确认 Phase 1 结算需写库 → design.md §7 改为实现真实状态 transition + 连续天数更新 + 幂等检查。
  - 不能靠 Open Question #2「决策为不需要」单方面带过——需审批人确认并回写 spec。

**B3 — tasks.md 未随对账修正同步，残留旧术语/旧实体/旧页面（重点 2）**

design.md 已修正，tasks.md 未动，残留：

| 位置 | 残留内容 | 应改为 |
|------|---------|-------|
| Task 1.1 | 创建 `EventType.cs` | 复用已有 `ScheduleType` |
| Task 1.5 | `Schedule.cs + Cancellation.cs` 最小化骨架，字段用 `EventType/StartTime/EndTime/RepeatRule` | 删除（实体已存在）；无扁平 StartTime/EndTime/RepeatRule，时间槽走 TimeSlot |
| Task 1.6 | 新增 `DbSet<Schedule>/DbSet<Cancellation>` | 仅新增 `DbSet<Checkin>` |
| Task 2.1/2.2 | 创建 `IScheduleQueryService` + `MockScheduleQueryService` | 复用真实接口，删除 Mock |
| Task 3.6 | DI 注册 `MockScheduleQueryService` | 注册真实 `ScheduleQueryService` |
| Task 7.1/7.2/7.3 | 方法名 `getCheckinWindow/doCheckin/undoCheckin` | 对齐 stub `getWindow/checkin/undo/getRecords` |
| Task 8.1/8.8 | 页面 `pages/event-detail/` + data-id `event-detail-*` 前缀 | `pages/schedule-detail/` + `schedule-detail-*` |
| 总览依赖图 | 节点「2.IScheduleQueryService」 | 改为「复用 IScheduleQueryService」 |

**为什么会导致返工**：tasks.md 是 dev-dotnet/dev-miniapp 的实现 brief，残留旧实体名/旧页面/旧接口会直接驱动返工。

### 建议项（审批前建议关注）

**S1 — 「excluded」第 6 状态未贯穿到 API 契约/前端/tasks.md**

对账修正把 `ScheduleDateExclusion` 补为第 4 数据源（design.md line 356-360 step 2 产出「已排除/excluded」），但：API 契约 status 枚举（响应示例 + tasks.md Task 3.5）仅 `incomplete/completed/cancelled/ended/overdue`（5 值）；前端状态机（line 614）与 data-id 表（line 655-661）无「excluded」。若 dev-dotnet 按「与 ScheduleStatusHelper 语义对齐」返回 `status="excluded"`，前端/契约未定义该值。**修正**：明确 excluded 与 cancelled 是否合并——design.md line 44 已写「同等对待」，则 step 2 应写「已取消/已排除 → 统一返回 cancelled」并在契约注明；若需区分，契约补 `excluded` 且前端补 data-id。

**S2 — 撤销打卡 HTTP 方法/路径三处不一致（裁决 #2 的路径部分）**

design.md §4 端点清单 = `DELETE /api/v1/checkin/{scheduleId}/{date}`；design.md §5 前端服务 = `DELETE /api/v1/checkin`（body）；checkin.js stub = `DELETE /api/v1/checkin`（body）；tasks.md Task 5.1/7.3 = 路径参数形式。**修正**：统一为路径参数形式（见裁决 #2）。

**S3 — SettlementJob 代码示例 `e.FamilyId != null` 无效判断**

design.md line 873 `Where(e => !e.IsDeleted && e.FamilyId != null)` —— `Schedule.FamilyId` 是 `Guid`（非空），`!= null` 恒真，是错误示例。应改为按 `FamilyId` 分组或移除该条件（dev-code-quality：示例代码应准确）。

**S4 — 「终态判定应对齐 ScheduleStatusHelper」措辞有误导**

对账清单 line 52 与 design.md line 348 说「与 ScheduleStatusHelper 语义对齐」，但真实 `DeriveInstanceStatus` 的 `ended` 来自 `RepeatEndDate`、`overdue` 来自 `DueDate`，**不含** checkin 的「课后活动 endTime+2h 即时逾期」规则。design.md §3 状态推导逻辑（step 3）本身已正确实现该规则，业务逻辑无误；但「对齐」措辞易误导 dev-dotnet 直接复用该 helper 而漏掉 endTime+2h。**修正**：明确「CheckinService 自带 endTime+2h 即时逾期判定，ScheduleStatusHelper 仅作参考，其 ended/overdue 是重复期/截止期的不同语义」。

### 次要建议（不影响审批，implementation 顺手处理）

**S5 — RowVersion 语义提示**：真实 `Schedule.RowVersion` 在 `ScheduleService.CreateAsync` 中是 `Guid.NewGuid().ToByteArray()`（随机字节，非并发令牌），design.md ER 图写「乐观锁」与真实实现意图有出入。Checkin 模块不涉及 Schedule 并发写，非阻塞，但若 Stage 3 遇到「打卡/撤销并发」需另议锁策略（Checkin 的幂等靠 `UNIQUE(ScheduleId, Date)` 兜底，已在 ADR-012 覆盖，无需 Schedule 乐观锁）。

---

## 四、待澄清问题及裁决（重点 3）

| 项 | 问题 | 裁决 |
|----|------|------|
| #1 | 错误码沿用废弃 "Event" 术语（`EVENT_CANCELLED`/`NOT_EVENT_PARTICIPANT`/`EVENT_NOT_FOUND`，design.md line 572-577） | **应改为 Schedule/Family 术语**，产出 `contracts/checkin/errors.json` 时：404 日程不存在 → 直接复用 `SCHEDULE_NOT_FOUND`（真实代码已用，见 ScheduleController line 79/115）；403 非家庭成员 → 复用 `NOT_FAMILY_MEMBER`（真实代码 `FamilyContextService.cs` line 35 已抛）；400 日程已取消 → 新建 `SCHEDULE_CANCELLED`。注意 `CHILD_ACCESS_DENIED` 是「孩子角色无权」语义（真实代码 line 36），打卡场景权限边界是「家庭成员」而非「角色」，故 403 用 `NOT_FAMILY_MEMBER` 而非 `CHILD_ACCESS_DENIED`。沿用 Event 术语会导致 contracts/checkin 与既有 auth 契约 + Schedule 模块错误码术语分裂，dev-miniapp/test-writer 引用歧义 |
| #2 | checkin.js stub 方法名（getWindow/checkin/undo/getRecords）与 design.md 设计稿（getCheckinWindow/doCheckin/undoCheckin）不一致，且 undo HTTP 方法/路径不一致 | **Stage 3 以「API 契约 + REST 惯例」为准，前端 stub 对齐契约**。方法名：统一为 stub 现有名 `getWindow/checkin/undo/getRecords`（stub 已被 schedule-detail 页面调用，改名需同步页面，方法名是前端内部实现非契约）。undo 路径：统一为路径参数形式 `DELETE /api/v1/checkin/{scheduleId}/{date}`——理由：(a) 与 `GET /checkin/window/{scheduleId}/{date}` 路径风格一致；(b) DELETE 带 body 在部分 HTTP 客户端/代理有兼容风险；(c) tasks.md Task 5.1/7.3 已用路径参数形式。stub `undo()` 改为 `api.del(\`/api/v1/checkin/${scheduleId}/${date}\`)` |
| #3 | Schedule 模块错误码硬编码（未进 contracts）属既有技术债 | **不属本次范围，记录不阻塞**。Schedule 模块（已归档 event 模块）错误码硬编码是其自身技术债；checkin 只需保证 `contracts/checkin/` 自己正确——复用鉴权 `TOKEN_INVALID`（auth 契约已定义）+ 按 #1 裁决新建/复用 Schedule 术语错误码。Schedule 模块错误码进 contracts 应单独提 issue，不在 checkin 变更内阻塞 |
| Open Question #2 | 首期结算任务是否写库 | 见阻塞项 B2——design 单方面「决策为不需要」与 delta spec 矛盾，需审批人拍板并回写 spec，不能带过 |

---

## 五、三判决

| 判决维度 | 结论 | 说明 |
|---------|:--:|------|
| 设计质量 | ⚠️ 有保留 | ADR/ER/时序本身自洽且质量尚可，现状对账清单 10/11 真实；但存在 IScheduleQueryService 事实错误 + 结算范围矛盾 + tasks 未同步 |
| 规则合规 | ❌ 存在违规 | 违反 dev-codegraph（对账清单 line 55 失实）、dev-contracts（Event 术语未统一、contracts/checkin 未产出） |
| 审批建议 | ❌ 建议驳回 | 3 阻塞项（B1 事实错误、B2 spec 范围矛盾、B3 tasks 未同步）均非轻量文档修正，修复后需复审 |

---

## 六、审核备注

- 本次复审范围：design.md 现状对账清单真实性（第 11 维）+ 对账修正引入的一致性 + 3 处待确认项裁决，未改动 design.md/tasks.md/contracts。
- 抽查方式：`codegraph explore`（Schedule 实体/ScheduleType/ScheduleStatus/ScheduleStatusHelper/AppDbContext/IScheduleQueryService/ScheduleQueryService/ScheduleResponse/checkin.js/schedule-detail data-id）+ 精确 Read 3 个文件（`Schedule.cs`/`ScheduleResponse.cs`/`schedule-detail/index.wxml`），未 grep 全仓库 / Read 大文件。
- 现状对账清单除 line 55 外全部真实，arch-architect 的 `EventType→ScheduleType`、`event-detail→schedule-detail` 等修正方向正确，本次复审未推翻这些修正。
- 阻塞项 B1/B3 属「修正不彻底」——改了 design.md 现状章节但未同步 tasks.md 与 line 55 断言，属「改了 A 没改 B」；B2 属 design 与 delta spec 的范围矛盾，需审批人拍板。
- 上轮（若有）复审结论不在本次范围；本次为对账修正后的独立复审。

---

## 七、终审（第三轮复核）：修复验收

> Reviewed by: arch-architect-reviewer | Date: 2026-08-16
>
> 终审范围：逐项核验 B1/B2/B3/S1-S4/裁决 #1-#3/额外发现是否修复到位，检查 `contracts/checkin/` 三文件与 design.md 一致性，检查修复是否引入新的不一致。抽查依据：`codegraph explore`（未 Read 大文件 / grep 全仓库）。本终审三判决**取代**第五节「五、三判决」（该节为第二轮复审结论）。

### 终审结论

**3 阻塞项全部闭合，4 建议项全部落实，3 裁决全部落地，`contracts/checkin/` 三文件已产出且与 design.md 一致。** 额外发现（AnonymizationService 表名）经 codegraph 查证属实，`.ToTable("CheckinRecords")` 确为必要约束。终审另发现 3 个**建议级（非阻塞）**遗留项（N1 getRecords 幽灵端点 / N2 NOT_FAMILY_MEMBER 异常类型映射 / N3 结算查询缺 RepeatEndDate 过滤），不阻断 Stage 3 启动。

### 7.1 阻塞项逐项核验

| # | 原问题 | 核验方式（codegraph） | 结论 |
|---|--------|----------------------|:--:|
| B1 | 清单 line 55 断言 `IScheduleQueryService` 不存在 | 查证 `api/Domain/Interfaces/IScheduleQueryService.cs` 确含 5 方法 `GetScheduleAsync`/`GetTimeSlotAsync`/`GetCancellationStatusAsync`/`IsDateExcludedAsync`/`GetDueDateAsync`，与 design.md line 55 逐字一致；`ScheduleResponse.cs:16-24` 确含 `CanCheckin`/`CanUndo`/`InstanceStatus`/`IsCancelled`/`IsExcluded`/`CheckinRecords` 6 字段；tasks.md Task 2 改为 DI 注册真实 `ScheduleQueryService`，无 Mock | ✅ 闭合 |
| B2 | 结算范围与 spec 矛盾 | design.md §7 改为写库完整实现：`CheckinSettlement`（UNIQUE(ScheduleId,Date)+Status+SettledAt 终态锚点）+ `Streak`（UNIQUE(Scope,SubjectId)+CurrentStreak+LastSettledDate）；结算算法与 spec 6 条 Requirement（Daily Settlement Execution / Idempotency / Error Recovery / Concurrent Safety / Streak Update / Scheduled Trigger）逐一对应 | ✅ 闭合 |
| B3 | tasks.md 残留旧术语/旧实体/旧页面 | grep 全变更目录：`EventType`/`EVENT_`/`event-detail`/`MockSchedule`/`doCheckin`/`getCheckinWindow`/`undoCheckin` 在 design.md + tasks.md 中已清零（仅剩「替代旧术语 EventType」等说明性文字） | ✅ 闭合 |

### 7.2 建议项逐项核验

| # | 原建议 | 核验 | 结论 |
|---|--------|------|:--:|
| S1 | excluded 第 6 状态未贯穿 | design.md line 44/410-412 明确「excluded 合并入 cancelled，不单独暴露」；`contracts/checkin/enums.json` `CheckinStatus` = 5 值（无 excluded） | ✅ 落实 |
| S2 | undo 路径三处不一致 | design.md line 62/507/712 + tasks.md Task 5.1/7.3 统一为 `DELETE /api/v1/checkin/{scheduleId}/{date}` | ✅ 落实 |
| S3 | SettlementJob `e.FamilyId != null` 恒真判断 | design.md §7 查询（line 949-954）已删除该条件 | ✅ 落实 |
| S4 | 「对齐 ScheduleStatusHelper」措辞误导 | design.md line 52/399 改为「参考（非对齐）」；codegraph 查证 `DeriveInstanceStatus`（ScheduleStatusHelper.cs:13-17）确为 excluded→cancelled→overdue(DueDate)→ended(RepeatEndDate)→incomplete，与「参考」措辞一致 | ✅ 落实 |

### 7.3 裁决落地核验

| # | 裁决 | 核验 | 结论 |
|---|------|------|:--:|
| #1 | 产出 contracts/checkin/，错误码改 Schedule/Family 术语 | `contracts/checkin/{enums,errors,dto}.json` 已产出；`errors.json` 含 `SCHEDULE_NOT_FOUND`(404)/`NOT_FAMILY_MEMBER`(403)/`SCHEDULE_CANCELLED`(400) + `CHECKIN_WINDOW_CLOSED`/`TERMINAL_STATE`/`NOT_CHECKED_IN`/`WINDOW_CLOSED`；无 Event 术语残留 | ✅ 落地 |
| #2 | 方法名 getWindow/checkin/undo/getRecords，undo 路径统一 | design.md line 62/707 统一保留 stub 方法名；codegraph 查证 `app/services/checkin.js` stub 确为 `getWindow/checkin/undo/getRecords`；undo 路径统一为路径参数形式 | ✅ 落地（getRecords 见 7.5 N1） |
| #3 | 记录不阻塞 | design.md Open Question #5 已记录 | ✅ 落地 |

### 7.4 额外发现核验

**AnonymizationService 表名**：codegraph 查证 `AnonymizationService.AnonymizeCheckinRecordsAsync`（AnonymizationService.cs:26-29）确以 `ExecuteSqlRawAsync("UPDATE \"CheckinRecords\" SET \"UserId\" = {0} WHERE \"UserId\" = {1}", ...)` 原始 SQL 引用 `"CheckinRecords"` 表名。design.md line 278 与 tasks.md Task 1.4 的 `.ToTable("CheckinRecords")` 确为必要约束——表名不对齐会导致注销匿名化静默失效（broad catch 只 log warning）。✅ 属实，已对齐。

### 7.5 终审新增建议（非阻塞，3 项）

**N1 — `getRecords` 幽灵端点（design.md §4 vs §5 不一致）**

design.md §5 line 713 列出 `getRecords(scheduleId, date) → GET /api/v1/checkin/records`，但 §4 端点清单（line 503-507）仅 3 个端点（window/checkin/undo），无 `/checkin/records`。tasks.md Task 7 标题提及 getRecords 但仅定义 7.1/7.2/7.3（3 方法）。codegraph 查证 `schedule-detail/index.js` 仅调用 `getWindow/checkin/undo`，未调用 `getRecords`。spec `checkin-record` 亦无「查询打卡记录列表」Requirement（读取由窗口查询 status + ScheduleResponse.CheckinRecords 覆盖）。这是 stub 残留未与契约对账。**修正**：将 getRecords 标注为二期（CHK-07 统计），从 design.md §5 移除或注明「二期」，避免 dev-miniapp 实现一个后端不存在的端点。

**N2 — NOT_FAMILY_MEMBER 的异常类型映射（403 vs 401）**

design.md line 646 称「复用 FamilyContextService 已抛错误码」为 NOT_FAMILY_MEMBER(403)，但 codegraph 查证 `FamilyContextService.GetFamilyContextAsync`（FamilyContextService.cs:34-35）抛 `UnauthorizedAccessException("NOT_FAMILY_MEMBER")`，而 `ExceptionHandlingMiddleware`（ExceptionHandlingMiddleware.cs:46-49）将 `UnauthorizedAccessException` 统一映射为 401 `TOKEN_INVALID`。design.md line 650 已正确警告「NOT_FAMILY_MEMBER(403) 不可用 UnauthorizedAccessException 抛出」，但 line 646/657 的复用计划未与此对齐。**修正**：明确 CheckinService 自行比对 `Schedule.FamilyId`（经 `IScheduleQueryService.GetScheduleAsync`）与用户家庭（经 `IFamilyContextService.GetFamilyContextAsync`），不匹配时抛 `DomainException("NOT_FAMILY_MEMBER")`；并处理「用户在零家庭」边界——此时 GetFamilyContextAsync 会抛 UnauthorizedAccessException（→401），需 catch 后转 DomainException 或改用直接 FamilyMember 查询。

**N3 — 结算查询缺 RepeatEndDate 过滤**

design.md §7 结算查询（line 949-954）对非 HomeworkTask 日程仅按 `TimeSlots.Any(DayOfWeek == yesterday.DayOfWeek)` 筛选，未过滤 `RepeatEndDate`。对 RepeatEndDate < yesterday 的重复日程（重复期已结束），结算会误写终态（如 DailyRoutine 误写 Incomplete）并误算 streak reset——而 `ScheduleStatusHelper` 已将 `date > RepeatEndDate` 判为 "ended" 终态。**修正**：非 HomeworkTask 分支追加 `(e.RepeatEndDate == null || e.RepeatEndDate >= yesterday)`，或在 ProcessChildSettlementAsync 增加「跳过 RepeatEndDate 已过实例」步骤。

### 7.6 终审三判决

| 判决维度 | 结论 | 说明 |
|---------|:--:|------|
| 设计质量 | ✅ 合格 | 3 阻塞 + 4 建议 + 3 裁决全部闭合；现状对账经 codegraph 逐条核验真实；B2 写库设计与 spec 6 条 Requirement 对齐，且 CheckinSettlement/Streak 为独立表（非 Schedule 列），与「虚拟实例模式（无实例表、无 Schedule.Status 列）」自洽，非 YAGNI（Idempotency 需终态锚点、Streak Update 为 spec 显式 Requirement）；3 个终审建议均为非阻塞细节 |
| 规则合规 | ✅ 合规 | dev-codegraph（现状对账 line 55 已修正，复用/扩展/新建标注真实）；dev-contracts（contracts/checkin 三文件齐全、错误码/枚举/DTO 与 design.md §4 一一对应、格式对齐 contracts/auth/、无 Event 术语残留、CheckinStatus 5 值前后一致）；无 TBD/TODO |
| 审批建议 | ✅ 建议批准 | 无阻塞项；N1/N2/N3 为建议级，dev-dotnet/dev-miniapp 实现时顺手处理即可，不阻断 Stage 3 启动 |

### 7.7 问题清单状态汇总

| 项 | 上一轮状态 | 终审状态 |
|----|-----------|:--:|
| B1 IScheduleQueryService 失实 | 阻塞 | ✅ 闭合 |
| B2 结算范围矛盾 | 阻塞 | ✅ 闭合 |
| B3 tasks.md 未同步 | 阻塞 | ✅ 闭合 |
| S1 excluded 状态 | 建议 | ✅ 落实 |
| S2 undo 路径 | 建议 | ✅ 落实 |
| S3 SettlementJob 恒真判断 | 建议 | ✅ 落实 |
| S4 ScheduleStatusHelper 措辞 | 建议 | ✅ 落实 |
| 裁决 #1 contracts + 错误码 | 待办 | ✅ 落地 |
| 裁决 #2 方法名 + undo 路径 | 待办 | ✅ 落地 |
| 裁决 #3 记录不阻塞 | 待办 | ✅ 落地 |
| N1 getRecords 幽灵端点 | 新增 | 建议（非阻塞） |
| N2 NOT_FAMILY_MEMBER 异常映射 | 新增 | 建议（非阻塞） |
| N3 RepeatEndDate 过滤 | 新增 | 建议（非阻塞） |
