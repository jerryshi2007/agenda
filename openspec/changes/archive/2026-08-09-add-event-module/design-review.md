# Design Review: 日程管理模块

> Change: `add-event-module` | Reviewed: 2026-08-08 | Reviewer: dev-architect-reviewer

---

## 10 维度审核总览

| # | 维度 | 结果 | 说明 |
|---|------|:--:|------|
| 1 | 需求覆盖 | PASS | 20 个 User Story (15 Must + 5 Should) 和 23 条边界异常全部有对应实体/API/时序覆盖 |
| 2 | ER 关系可反推 | PASS (1 issue) | 7 个关系基数均可从 spec scenario 反推；删除级联规则有一处歧义（Open Question 3） |
| 3 | 时序完整 | PASS | 7 张时序图覆盖正常路径 + 异常/冲突分支；鉴权链路明确 |
| 4 | ADR 充分 | PASS | 6 个 ADR 覆盖全部关键架构决策（多孩子模型/虚拟实例/时间槽存储/契约对齐/编辑范围/分页策略） |
| 5 | 规则合规 | PASS (2 issues) | 规则合规良好；CancellationToken 在设计文档中未出现（.NET 实现层可补充）；Risk IDs 重复编号 |
| 6 | 质量底线 | PASS (1 blockers) | 无 TBD/TODO 占位符；Open Question 3 未解决 -- "仅本次"删除方案不确定；Risk IDs 有两个 R1；所有 Risks 已识别 |
| 7 | 限界上下文合理 | PASS | 聚合边界清晰，聚合根识别正确，跨上下文交互规则明确 |
| 8 | API 契约完整 | PASS (1 issue) | 8 个端点 + 19 个错误码 + 鉴权矩阵完整；分页/乐观锁标准化 |
| 9 | 前端架构对齐 | PASS | 路由表完整，组件树清晰，状态管理合理，所有 data-id 已列出 |
| 10 | 构建序列可行 | PASS | 依赖顺序正确无循环，集成 task 时机合理 |

---

## 问题清单

### 阻塞项（审批前必须修复）

#### B1: Open Question 3 -- "仅本次"删除方案未定案

- **位置**: design.md L1340-1341 (Open Questions #3), L454 (级联规则)
- **发现**: 级联规则表中"仅本次"删除写道：`更新原 Schedule 的 RepeatEndDate 为当前日前一天 + 或创建单日 Exclusion 标记`，使用了"或"字，表明方案未确定。Open Question 3 对此问题的建议是"用 Exclusion 标记"，但未作出最终决定。
- **影响**: 该方案直接影响"仅本次"删除 API 的实现逻辑。若选择修改 RepeatEndDate，后续"全部日程"编辑的理解会受影响（RepeatEndDate 已被人为缩短）；若选择 Exclusion 标记，需要新建一张表或标记机制。这是不可延迟到实现阶段的设计决策。
- **建议**: 在此 review 闭环前，dev-architect 必须做出明确二选一决策并更新 design.md。推荐：创建 `ScheduleDateExclusion` 表（ScheduleId + ExcludedDate, UNIQUE 约束），保持 RepeatEndDate 不与删除操作耦合。此方案与 Cancellation 表模式一致，语义清晰，"恢复"操作只需物理删除 Exclusion 记录。

#### B2: Risk IDs 重复编号

- **位置**: design.md L1276
- **发现**: 风险表中有两个 `R1`（L1269 和 L1276）。第二个 R1 应为 `R8`（乐观锁在批量编辑多孩子时的复杂交互）。前一个编号 R1 已被"多孩子展开模型导致 Schedule 记录膨胀"使用。
- **影响**: 文档质量缺陷，导致风险管理追溯时编号混乱。
- **建议**: 将 L1276 的 `R1` 修正为 `R8`。

### 建议项（审批前建议关注）

#### S1: Schedule 实体缺少 RepeatRule 字段 -- 与 checkin-module 契约存在间隙

- **位置**: design.md ADR-017 (L248-268) vs checkin-module design.md (L242-252)
- **发现**: checkin-module 预定义的 Schedule 骨架实体包含 `RepeatRule : DayOfWeek[]` 字段，但 Schedule 模块设计中的 Schedule 实体（L317-337）没有此字段。本模块的设计通过 TimeSlot 子表的 `DayOfWeek` 来表达"重复在哪些天"，这等价于 RepeatRule。但 checkin-module 的结算逻辑可能直接期望从 Schedule 上读取 `RepeatRule` 字段。
- **影响**: 如果 checkin-module 的窗口判定逻辑尝试直接读 `Schedule.RepeatRule`（而非通过 `IScheduleQueryService` 间接获取），会产生运行时错误。
- **建议**: 确认 checkin-module 是否通过 `IScheduleQueryService` 接口获取重复信息（而非直接读 Schedule 字段）。若 checkin-module 接受通过接口查询，则 Schedule 实体不设 RepeatRule 字段是合理的（冗余消除）。若需要，可在 Schedule 上添加一个计算属性 `RepeatRule` 聚合 TimeSlot 的 DayOfWeek 值，但这不是设计层面的阻塞问题——实现阶段可通过 IScheduleQueryService 接口封装来解决。

#### S2: checkin-module 骨架 Schedule 有 StartTime/EndTime 字段 -- ADR-017 已解决但需双向确认

- **位置**: design.md ADR-017 (L268), checkin-module design.md (L244-246)
- **发现**: checkin-module 设计假定 Schedule 有 `StartTime : TimeOnly?` 和 `EndTime : TimeOnly?` 字段。Schedule 模块将这些移入 TimeSlot 子表（每周几天不同时间）。ADR-017 的解决方案是"通过 IScheduleQueryService.GetTimeSlotAsync(scheduleId, dayOfWeek) 提供查询"。
- **影响**: checkin-module 开发者必须知道这个契约变更，在打卡窗口判定代码中使用 `IScheduleQueryService.GetTimeSlotAsync()` 而非 `Schedule.StartTime`。
- **建议**: 将此处双向契约对齐作为 Schedule 与 Checkin 模块联调 checklist 的第一项，优先于任何功能联调。

#### S3: IScheduleQueryService 接口定义位置 -- 建议 Schedule 模块定义，checkin 模块引用

- **位置**: design.md L103, checkin-module design.md L135
- **发现**: checkin-module 设计中说"本模块定义接口契约"，而 Schedule 模块设计中说"Schedule 模块对外暴露 IScheduleQueryService 接口"。两个模块都声称定义此接口。这是依赖反转的模式冲突——谁定义接口谁控制契约。
- **影响**: 编译依赖方向不明确。如果 checkin 模块定义接口，Schedule 模块实现它 → checkin 不需要依赖 Schedule 编译（依赖反转正确）。如果 Schedule 模块定义接口，checkin 模块调用它 → checkin 编译依赖 Schedule（依赖倒挂）。
- **建议**: 采用 checkin-module 的策略——接口由 checkin-module 定义（放在 `api/Checkin/IScheduleQueryService.cs` 或共享的 `api/Domain/Interfaces/` 目录），Schedule 模块实现它（放在 `api/Schedule/ScheduleQueryService.cs`）。这样 checkin 模块独立编译、独立测试（Mock 实现），且修改自己的接口不会影响 Schedule 模块。

#### S4: 打卡窗口查询职责归属 -- 建议重新划分

- **位置**: design.md event-checkin-integration spec (window query > event module) vs checkin-module design
- **发现**: `event-checkin-integration` delta spec 第 1 条 Requirement 说"Schedule module SHALL provide checkin window status query"，但 checkin-module 设计中打卡窗口判定（ADR-013）明确属于 `CheckinService.CanCheckinAsync()`。打卡窗口的时间规则（提前 30 分钟、课后活动 +2h、日常作息当天 24:00）是 checkin 模块的核心逻辑，不应由 Schedule 模块提供。
- **影响**: 职责混淆。Schedule 模块不应知道打卡窗口的时间规则，这会导致 Schedule 模块间接依赖 checkin 模块的业务逻辑。
- **建议**: `event-checkin-integration` delta spec 中的"window status query"应改为"Schedule 模块通过 IScheduleQueryService 提供 schedule 的基础信息（类型、时间、取消状态），供 checkin 模块做窗口判定"。窗口判定和 `/checkin/window` API 属于 checkin 模块。

#### S5: 设计文档中 CancellationToken 未出现

- **位置**: 全文
- **发现**: `dev-dotnet-standards` 要求异步方法接受 `CancellationToken` 参数（默认值 `default`）并传递给下游调用。design.md 的 API 设计和时序图中未提及 CancellationToken。这是实现层细节，但在 .NET 异步设计中文档化这样的关键模式有助于实现者保持一致。
- **影响**: 低。这属于实现细节，可在 coding 阶段由 linter 或 code review 强制。但提醒 dev-planning 在 task 描述中显式要求。
- **建议**: 在 handoff 到 dev-planning 时，提醒后端 task 中异步方法必须包含 CancellationToken 参数。

#### S6: 打卡模块 ScheduleType 枚举冗余定义

- **位置**: design.md ADR-017 vs checkin-module design.md
- **发现**: checkin-module 在 `Domain/Enums/ScheduleType.cs` 中定义了 ScheduleType 枚举，Schedule 模块也在 `Domain/Enums/ScheduleType.cs` 中定义了同名枚举。两个模块共用同一 Domain 目录，若 checkin 模块先落地此枚举，Schedule 模块不应重新定义，应直接引用。
- **影响**: 如果两边定义了相同枚举但在不同文件中，编译器会报重复定义错误。不过因为都在 `api/Domain/Enums/` 下且采用单项目结构，这个冲突在实现时自然会被发现和解决。
- **建议**: 在 tasks.md 中为 Schedule 模块的 task 1.1 添加注释："若 checkin-module 已定义 ScheduleType 枚举且命名空间和值完全一致，直接引用，不重复定义。"

### 疑问项（需审批人确认）

#### Q1: 模板对接的创建流程占位 -- 是否需要前端预留？

- **位置**: design.md L858（组件树中的 `template-entry`）
- **问题**: 组件树中有 `template-entry`（"从模板创建"入口），但 US-EVT-04 是 Should 优先级且 Non-Goals 中说明"模板系统对接"列入第一期。需确认前端是否应为此预留按钮位但不实现功能，还是完全移除。
- **影响**: 前端 UI 空间规划。

#### Q2: Child-selector 在日历筛选中是单选还是多选？

- **位置**: design.md L831（`child-selector (按孩子筛选（单选 + "全部"）)`）vs requirement.md US-EVT-19（只说筛选特定孩子）
- **问题**: 组件树标注 child-selector 为"单选 + 全部"，但 creation 流程中的 child-selector 是多选。这两处是不同的组件实例还是同一组件？如果是同一组件，筛选场景需要单选模式切换。
- **影响**: 前端组件设计和 data-id 命名。

---

## 审批建议

### 设计质量：PASS (有保留)

设计质量整体优秀。20 个用户故事全覆盖，6 个 ADR 对数个最核心的架构决策（多孩子模型、虚拟实例、时间槽存储、编辑范围、分页策略、契约对齐）做了深入分析。7 张时序图覆盖正常路径和异常分支。限界上下文划分清晰，与 auth-module/checkin-module 的扩展关系明确。

保留点：
- Open Question 3（"仅本次"删除方案）未定案是真正的阻塞项，必须在实现前决策
- 打卡窗口查询的职责归属需要重新划分

### 规则合规：PASS (无违规)

- `dev-dotnet-standards`：API 设计遵循 RESTful 约定、乐观锁（RowVersion）、FluentValidation 校验、DTO 隔离、分页标准化、API 版本 `/api/v1/`。CancellationToken 在实现阶段需补充。
- `dev-miniapp-standards`：原生小程序框架、`data-id` 完整（40+ 元素已列出命名）、`setData` 优化思路、Storage 键名常量、API 封装复用。
- `dev-security`：JWT 鉴权、familyId 隔离、角色权限控制、乐观锁防并发覆盖、无硬编码密钥。
- `dev-code-quality`：无 TBD/TODO 占位符、复用 auth-module 的 JWT 中间件和 api.js 封装、单一职责（ScheduleService/TimeSlotService/CalendarQueryService/ConflictDetectionService 分拆明确）。
- `design-ui-standards`：原型阶段规范未在本设计中涉及（设计聚焦架构层面）。
- `openspec-workflow`：proposal.md + delta specs 完整，变更类型标记正确。

### 审批建议：APPROVED WITH CONDITIONS

**批准条件**：
1. **B1** 必须解决：确定"仅本次"删除方案（Exclusion 标记 vs RepeatEndDate 修改）
2. **B2** 必须解决：修正重复的 Risk ID
3. **S3** 建议解决：明确 IScheduleQueryService 接口由哪个模块定义
4. **S4** 建议解决：重新划分打卡窗口查询的职责归属

**通过后的下一步**：
- dev-planning 可开始 task 拆解（tasks.md 框架已就绪，需根据闭环结果微调 task 3.4）
- checkin-module 可基于澄清后的 IScheduleQueryService 接口契约并行开发
- 前端可基于 data-id 列表和组件树启动原型开发

---

## 审核维度详细记录

### 1. 需求覆盖

| Requirement | 实体覆盖 | API 覆盖 | 时序覆盖 | 状态 |
|------------|:--:|:--:|:--:|:--:|
| US-EVT-01(课后活动创建) | Schedule + TimeSlot | POST /schedules | 时序 1 (正常) + 时序 2 (冲突) | OK |
| US-EVT-02(日常作息创建) | Schedule + TimeSlot | POST /schedules | 时序 1 | OK |
| US-EVT-03(作业任务创建) | Schedule (DueDate) | POST /schedules | 时序 1 | OK |
| US-EVT-04(模板创建) | -- (Should, Non-Goal) | -- | -- | OK |
| US-EVT-05(冲突检测) | ConflictDetectionService | POST /check-conflict | 时序 2 | OK |
| US-EVT-06(编辑仅本次) | Schedule(衍生) + SourceScheduleId | PUT /schedules (scope=ThisOnly) | 时序 3 | OK |
| US-EVT-07(编辑全部) | Schedule + TimeSlot | PUT /schedules (scope=ThisAndFuture) | 时序 4 | OK |
| US-EVT-08(作业任务编辑) | -- (no scope switch) | PUT /schedules | 设计明确 | OK |
| US-EVT-09(删除仅本次) | Schedule + (Exclusion or RepeatEndDate) | DELETE /schedules (scope=ThisOnly) | 级联规则 | OK* |
| US-EVT-10(删除全部) | Schedule.RepeatEndDate | DELETE /schedules (scope=ThisAndFuture) | 级联规则 | OK |
| US-EVT-11(作业任务删除) | Schedule.IsDeleted | DELETE /schedules | 级联规则 | OK |
| US-EVT-12(取消本次) | Cancellation | POST /schedules/{id}/cancel | 级联规则 | OK |
| US-EVT-13(恢复取消) | Cancellation(物理删除) | POST /schedules/{id}/restore | 级联规则 | OK |
| US-EVT-14(详情页打卡) | Checkin(借调 checkin-module) | GET /schedules/{id} + checkin API | 时序 6+7 | OK |
| US-EVT-15(快捷打卡) | -- (Should, Non-Goal) | checkin API | -- | OK |
| US-EVT-16(月视图) | CalendarQueryService | GET /calendar (view=month) | 时序 5 | OK |
| US-EVT-17(周视图) | CalendarQueryService | GET /calendar (view=week) | 时序 5 | OK |
| US-EVT-18(日视图) | CalendarQueryService | GET /calendar (view=day) | 时序 5 | OK |
| US-EVT-19(筛选) | FilterBar + API | GET /calendar (childId/scheduleTypes) | 数据流 | OK |
| US-EVT-20(详情页) | ScheduleDetail page | GET /schedules/{id} | 时序 6 | OK |
| BE-01~07(输入校验) | FluentValidation Validators | 各端点 400 返回 | 实现覆盖 | OK |
| BE-08~11(空状态) | 前端空态组件 | -- | 前端覆盖 | OK |
| BE-12~15(网络异常) | 前端重试 + 缓存兜底 | -- | 数据流 | OK |
| BE-16~18,23(并发/一致性) | 乐观锁 RowVersion | 409 CONCURRENT_EDIT_CONFLICT | 时序 4 | OK |
| BE-19~22(视图边界) | 前端滚动/防抖/跨月 | -- | 前端覆盖 | OK |

*US-EVT-09: 删除方案未定案，见 B1。

### 2. ER 关系可反推

| 关系 | 设计基数 | Spec 来源 | 可反推？ |
|------|:--:|------|:--:|
| Schedule -- TimeSlot | 1 : 0..7 | US-EVT-01: 7 天独立配置，作业任务 0 条 | YES |
| Schedule -- Cancellation | 1 : 0..N | US-EVT-12: 不同日期多次取消 | YES |
| Schedule -- Schedule(衍生) | 1 : 0..N | US-EVT-06: "仅本次"编辑产生衍生 | YES |
| Schedule -- Checkin | 1 : 0..N | checkin-module: 每天每条 | YES |
| Schedule -- User(AssignedChildId) | N : 1 | ADR-014: 一条 Schedule 一个孩子 | YES |
| Schedule -- Family | N : 1 | 数据隔离 | YES |
| Schedule -- Schedule(GroupKey) | 1 : 1..N | ADR-014: 同批多孩子创建 | YES |

结论：所有关系基数均有 spec scenario 或 ADR 依据支撑，无"凭空设计"的关系。

### 3. 时序完整性

| 时序图 | 正常路径 | 鉴权拒绝 | 异常/冲突分支 |
|--------|:--:|:--:|:--:|
| 1: 创建正常流程 | YES | JWT 校验 + 403 NOT_FAMILY_MEMBER | network failure (前端重试) |
| 2: 冲突检测软提示 | YES | -- | ignoreConflict 继续创建 |
| 3: "仅本次"编辑 | YES | rowVersion 校验 | -- |
| 4: 并发编辑冲突 | YES | -- | 409 CONCURRENT_EDIT_CONFLICT |
| 5: 日历查询 | YES | familyId 隔离 | 空结果 |
| 6: 详情页加载 | YES | 403, 404 | 已删除日程 |
| 7: 打卡协同 | YES | JWT 校验 | 已打卡(幂等), 已取消 |

结论：7 张时序图覆盖正常 + 异常 + 鉴权链路（JWT 401 -> 403 NOT_FAMILY_MEMBER/CHILD_ACCESS_DENIED -> 404 SCHEDULE_NOT_FOUND -> 409 CONCURRENT_EDIT_CONFLICT）。

### 7. 限界上下文分析

| 上下文 | 聚合根 | 边界 | 外部依赖 | 评价 |
|--------|--------|------|---------|------|
| Schedule | Schedule | `api/Schedule/` | Auth(userId), Family(familyId), Checkin(IScheduleQueryService) | 边界清晰，依赖通过接口反转 |
| Checkin | Checkin | `api/Checkin/` | Schedule(IScheduleQueryService) | 通过接口依赖，不直接 JOIN Schedule 表 |
| Auth | User | `api/Auth/` | 无 | 输出 JWT 中的 userId |
| Family | Family | `api/Family/`(后续) | Auth(userId) | Schedule 通过 familyId 隔离 |

评价：聚合根识别正确，跨上下文交互规则明确。建议 IScheduleQueryService 接口由 checkin-module 定义（依赖反转），Schedule 模块实现（见 S3）。

### 8. API 契约完整性

- 端点覆盖：8 个端点覆盖全部 CRUD + 操作 + 日历查询 + 冲突检测
- DTO 对齐：请求/响应形状包含完整字段和类型
- 错误码：19 个错误码（含 400/401/403/404/409）全覆盖
- 分页：日历查询采用日期范围分页（最大 90 天），符合标准化
- 鉴权矩阵：家长/孩子端权限逐接口标注

### 9. 前端架构对齐

- 路由表：5 个页面（index/schedule-detail/schedule-create/schedule-edit/mine），含 TabBar 扩展
- 组件树：10 个自定义组件 + 子组件分解清晰
- 状态管理：app.globalData + Page.data 模式（微信原生替代 Pinia）
- data-id：40+ 元素已列出命名，符合 dev-miniapp-standards 契约
- 数据流：onShow 恢复 -> API fetch -> setData 渲染 -> 操作 -> navigateBack + refresh

### 10. 构建序列分析

```
Auth/Family (已有设计) → Schedule 实体+基础CRUD → IScheduleQueryService实现
                                              → Checkin模块(可并行)
日历API → 前端日历视图(可并行)
编辑/删除/取消API → 前端详情页(可并行)
全部就绪 → 集成联调
```

依赖链无循环。checkin-module 可通过 Mock IScheduleQueryService 与 Schedule 模块并行开发（R8 缓解措施已覆盖）。

---

## 审核备注

1. **设计文档质量**：整体专业度高。ADR 格式规范（Context/Decision/Consequences/Alternatives），ER 图采用 ASCII 艺术清晰表达，API 形状完整具体。
2. **与前序模块对齐**：充分查阅了 auth-module 的 9 个 ADR 和 checkin-module 的 4 个 ADR，对齐决策明确列出。契约对齐 ADR-017 是关键的跨模块桥梁设计。
3. **重复造轮子检查**：复用 auth-module 的 JWT 中间件、异常中间件、api.js 封装、storage-keys.js；复用 checkin-module 的 Checkin 表结构和 UNIQUE 约束。无重复造轮子。
4. **tasks.md 一致性**：tasks.md 的 15 大任务组与 design.md 的 3.7 节构建序列完全一致。task 3.4（删除 API）需根据 B1 的闭环决定更新。
