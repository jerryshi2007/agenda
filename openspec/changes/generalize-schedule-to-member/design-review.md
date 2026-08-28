# 架构设计审核报告 · 家长日程（generalize-schedule-to-member）— 复审（迁移方案）

> 审核对象：`openspec/changes/generalize-schedule-to-member/`（design.md + proposal.md + tasks.md + 6 份 delta spec + contracts/schedule/* + contracts/template/errors.json）
> 审核日期：2026-08-23（复审）| 审核人：arch-architect-reviewer
> 复审缘起：上一轮审核后，用户否决「零迁移」硬约束，改为正式 EF Core 列重命名迁移，design.md 已重做（commit `fcc41bb`）。本轮聚焦**迁移方案正确性**，并复核上一轮结论是否仍成立。
> 对照真相源：`production/staging/2026-08-23-家长日程/` + `openspec/specs/` 已归档六域
> 审核方法：`arch-review` skill 11 维度扫描 + 用 codegraph/grep/Read **独立核验** `api/` 实际数据库结构（`AppDbContext`、`ScheduleConfiguration`、既有 Migration、`AppDbContextModelSnapshot`、`Program.cs`）

---

## 零、迁移方案独立核验结果（本轮核心）

> 用实际代码逐条核验 design.md §Decision 1 + §部署与回滚 + Task 0.4 的迁移声明。**核心论断全部属实，索引名与 design 完全一致**（索引名写错会导致迁移失败，故逐字核对既有 migration 文件）。

| # | design 声明 | 核验结论 | 证据 |
|---|-----------|:--:|------|
| 1 | `Schedules` 表当前列名为 `AssignedChildId`（Guid，非 FamilyMember.Id） | ✅ 属实 | `api/Migrations/20260809110306_InitialCreate.cs:36` `AssignedChildId = table.Column<Guid>(type: "uuid", nullable: false)`；表名 `Schedules`（`AppDbContextModelSnapshot.cs:330` `b.ToTable("Schedules")`） |
| 2 | 索引名 `IX_Schedules_AssignedChildId` 存在 | ✅ 属实 | `InitialCreate.cs:207` `name: "IX_Schedules_AssignedChildId"`（由 `HasIndex(e => e.AssignedChildId)` 自动生成，名称与约定完全一致） |
| 3 | 索引名 `IX_Schedules_FamilyId_AssignedChildId` 存在 | ✅ 属实 | `InitialCreate.cs:217` `name: "IX_Schedules_FamilyId_AssignedChildId"`（由 `HasIndex(e => new { e.FamilyId, e.AssignedChildId })` 自动生成） |
| 4 | 仅此两索引引用 `AssignedChildId`（其余 `IX_Schedules_FamilyId`/`GroupKey`/`SourceScheduleId`/`SourceTemplateId` 不含该列） | ✅ 属实 | grep 全量：`InitialCreate.cs` + `AddTemplateModule.cs` 中 `IX_Schedules_*` 仅上述两个含 `AssignedChildId` |
| 5 | 改名范围界定：唯一改名的落库列为 `Schedules.AssignedChildId` | ✅ 属实 | snapshot 中 child 相关列仅 3 处：`AssignedChildId`（:251）、`ChildName`（:157，FamilyMember）、`TargetChildName`（:223，InvitationCode）；后两者语义为「显示名覆盖/邀请目标」非 User.Id 引用，**正确排除** |
| 6 | `FamilyMember.ChildName` / `InvitationCode.TargetChildName`/`TargetDisplayMode` 属其它语义、不改 | ✅ 属实 | `FamilyMember.cs:18` `string? ChildName`（显示名覆盖）；`InvitationCode.cs:18-19` `TargetChildName`/`TargetDisplayMode`（邀请孩子专用）。均非成员 User.Id 引用，不属本次泛化 |
| 7 | `RenameColumn`/`RenameIndex` 不改数据、存量行完整保留 | ✅ 属实 | PostgreSQL `ALTER TABLE ... RENAME COLUMN` / `ALTER INDEX ... RENAME TO` 仅改名称，不动行数据；design 明确「禁止 drop+add」以规避 EF 脚手架默认的丢数据行为，方向正确 |
| 8 | 生产不自动迁移：`Database.MigrateAsync()` 包在 `IsDevelopment()` 内 | ✅ 属实 | `api/Program.cs:149` `if (app.Environment.IsDevelopment())` 包裹 `:155` `await db.Database.MigrateAsync()`，生产启动不迁移 |
| 9 | 回滚目标为上一迁移 `20260819014740_AddTemplateModule` | ✅ 属实 | `api/Migrations/` 目录实际迁移列表：`..._AddFamilyExpansion` → `20260819014740_AddTemplateModule`（最后一个）。回退到它即执行 `RenameAssignedChildIdToAssignedMemberId` 的 `Down` |
| 10 | 枚举值 `UserRole.Child`/`StreakScope.Child`/`CheckinSource.Child` 非列名、不改；`Streak.SubjectId` 多态列语义不变 | ✅ 属实 | `Streak.cs:12-13` `Scope`(枚举)+`SubjectId`(Guid 多态)，无 `Child` 列名 |

**迁移核验结论**：`Up`（`RenameColumn("Schedules", "AssignedChildId", "AssignedMemberId")` + 两个 `RenameIndex`）与 `Down`（反向）**完全正确、可回滚**。索引名经逐字核对与实际既有 migration 一致，无「写错索引名导致迁移失败」风险。改名范围界定完整——除 `Schedules.AssignedChildId` 及其两个索引外，无其它落库的 child 关联列被遗漏。

---

## 一、上一轮结论复核（B1 + S1~S10 是否已修复）

> 上一轮 design-review.md 的 1 阻塞项 + 10 建议项，对照重做后的 design.md / tasks.md / contracts 逐一复核。

| 上轮项 | 内容 | 现状 | 证据 |
|------|------|:--:|------|
| B1（阻塞） | 现状对账 + Task 1.3 遗漏 `CalendarController` | ✅ 已修复 | design.md:41 对账清单补 `CalendarController`；tasks.md Task 1.3 产出文件加 `CalendarController.cs` + 「先归一化、后角色强制」安全边界 |
| S1 | `SettlementJob` 角色反查 familyId 语义不精确 | ✅ 已修复 | design.md Decision 4（:177-180）改「逐 schedule 反查 `FamilyMembers(UserId==AssignedMemberId && FamilyId==FamilyId)`」+ 显式说明跨家庭角色误判风险；Task 3.2 同步 |
| S2 | `ScheduleSummary` 缺 `assignedMemberRole` | ✅ 已修复 | `dto.json` ScheduleSummary 补 `assignedMemberRole` + `assignedMemberName`（:31-32） |
| S3 | `CHILD_NOT_IN_FAMILY`/`CHILD_ACCESS_DENIED` 跨域重叠未说明 | ✅ 已修复 | design.md §契约覆盖与跨域 deprecate 同步说明（:292-298）；`template/errors.json` `CHILD_NOT_IN_FAMILY` 已标 `deprecated:true`（:14） |
| S4 | `ScheduleConflictCheckRequest`「都不传」错误码笔误 | ✅ 已修复 | `dto.json` memberId 描述改「都不传报 MEMBER_NOT_SELECTED」（:80） |
| S5 | dto.json 未覆盖 schedule 域全量 DTO | ✅ 已修复 | design.md:294 显式声明「本契约仅含本次变更 DTO，存量 DTO 以代码 + Swagger 为准」 |
| S6 | Task 4.1 未说明 `CreateAsync` 新 role 参数传递 | ✅ 已修复 | Task 4.1 补「同步 `CreateAsync(familyId, userId, UserRole.Parent, merged, ct)` 新 role 参数」 |
| S7 | Decision 6「中间件」措辞与 schedule 实际错误处理不符 | ✅ 已修复 | Decision 6（:214）改「非 DomainException/全局中间件，而是 `IsDomainError` 列表 + catch 字符串匹配」 |
| S8 | BE-05 / BE-07 未在 delta spec/tasks 显式落点 | ✅ 已修复 | design.md §边界与异常落点说明（BE-05/BE-07）（:460-467） |
| S9 | `ChildScheduleQueryService`/`CompletionStatsService` 措辞 | ✅ 已修复（措辞） | design.md:38/45 改「无逻辑改动，随实体改名机械同步」 |
| S10 | Task 8.1 依赖图漏列 5.3 | ✅ 已修复 | tasks.md:55 `Task 8.1 ← 依赖 0.4, 5.1, 5.2, 5.3` |

**结论**：上一轮 1 阻塞 + 10 建议项**全部修复**。迁移改动未破坏任何上一轮已确认通过的结论（现状对账核心论断、越权两层、双文案按成员角色、streak 孩子维度、模板多选、冲突按成员、无 DisplayMode 门槛、Decision 6 兼容层——均仍成立）。

---

## 二、本轮新增发现（迁移方案引入的轻微瑕疵）

### 建议（Suggestion）

**N1（轻微，措辞不准确）｜「移除 `[Column]` 映射」与实际代码不符。** design.md §Decision 1（:97）、决策变更记录（:117）多处写「移除 `[Column("AssignedChildId")]` 映射」，但实际 `api/Domain/Entities/Schedule.cs:15` 的 `AssignedChildId` **从未有任何 `[Column]` 特性**（就是裸 `public Guid AssignedChildId { get; set; }`）。「移除 [Column]」是上一轮「零迁移」方案（本会**新增** `[Column]`）的残留措辞。Task 0.3 的实际指令「**不加** `[Column]`」才是正确的。

**后果**：轻微——dev-dotnet 读「移除 [Column]」可能误以为要去找一个不存在的特性。属零影响（移除不存在属性 = no-op），但措辞应统一为「不加 `[Column]`，走 EF 默认约定」。

**修复**：design.md Decision 1 与决策变更记录中「移除 `[Column]` 映射」统一改为「不加 `[Column]`，属性改名后 EF 默认约定（属性名 = 列名）」。

**N2（需在 Stage 3 前补全）｜Task 0.3 实体改名后，5 个消费文件未列入任何 task 的产出文件，导致 `dotnet build` 失败 + Task 0.4 被阻塞。** Task 0.3 改名 `Schedule.AssignedChildId`（实体）+ `ScheduleInfo.AssignedChildId`（`IScheduleQueryService`），但以下消费该属性的文件**未出现在任何 task 的「产出文件」清单**：

| 未指派文件 | 引用 `AssignedChildId` 的位置 | 现有处置 |
|-----------|------------------------------|---------|
| `api/Schedule/Services/ScheduleQueryService.cs` | :35 `AssignedChildId = schedule.AssignedChildId`（构造 ScheduleInfo） | 无 task 列出 |
| `api/Schedule/Services/ConflictDetectionService.cs` | :24 `e.AssignedChildId == request.ChildId` | Task 1.2 只列 DTO `ScheduleConflictResponse.cs`，未列 Service |
| `api/Schedule/Services/CalendarQueryService.cs` | :42/65/114 `s.AssignedChildId` | Task 1.3 只列 `CalendarResponse.cs` + `CalendarController.cs`，未列 Service |
| `api/Checkin/Services/CompletionStatsService.cs` | :33 `s.AssignedChildId == userId` | 无 task 列出 |
| `api/Schedule/Services/ChildScheduleQueryService.cs` | :54/63/73/80/165 | 无 task 列出 |

（`SettlementJob.cs` 由 Task 3.2 覆盖、`ScheduleService.cs` 由 Task 2.1/2.2 覆盖，均 OK。）

Task 0.3 完成标准写「跨文件机械引用 … 由各自下游 task 同步」，但**上述 5 个文件没有任何「下游 task」同步**。直接后果：
1. Task 0.3 验证命令 `dotnet build api/Agenda.Api/` 会因这 5 处编译错误而**失败**。
2. Task 0.4（`dotnet ef migrations add`）依赖 0.3，且脚手架需项目**可编译 + 可运行**，故被阻塞——迁移本身无法生成，直到这些文件被改名。

> 说明：design.md 现状对账清单（:38/45）已**正确**标注这些文件「随实体改名机械同步」，问题仅在于 tasks.md 未把它们落到具体 task 的产出文件。属任务拆分完整性缺口，非设计正确性错误。

**修复**：将上述 5 个文件补入 Task 0.3 的产出文件清单（Task 0.3 本就是「实体改名」任务，机械改名应集中在此一次性完成、`dotnet build` 作为完成标准），或将 `ConflictDetectionService.cs` 并入 Task 1.2、`CalendarQueryService.cs` 并入 Task 1.3、`CompletionStatsService.cs`/`ChildScheduleQueryService.cs`/`ScheduleQueryService.cs` 补入 Task 0.3。任选其一，但必须保证每个文件有明确 owner。

---

## 三、11 维度总览（复审后）

| # | 维度 | 结论 | 严重度 |
|---|------|------|:--:|
| 1 | 需求覆盖 | US-PAR-01~15 + BE-01~11 均有落点（BE-05/BE-07 已显式标注） | ✅ |
| 2 | ER 关系可反推 | 关系基数均有 spec 依据；`AssignedMemberId→User.Id` 软引用已说明 | ✅ |
| 3 | 时序完整 | 6 时序覆盖正常+异常，越权链路多级拒绝清晰 | ✅ |
| 4 | ADR 充分 | 6 ADR + 决策变更记录（零迁移→正式迁移）均含四要素 | ✅ |
| 5 | 规则合规 | 无 TBD/硬编码密钥/同步阻塞异步/裸 wx.request；迁移可回滚（dev-dotnet-standards）；契约 JSON 齐全 | ✅ |
| 6 | 质量底线 | Risks 识别迁移失败/越权遗漏/streak 污染等关键风险；无占位符 | ✅ |
| 7 | 限界上下文合理 | 不新增 csproj，模块内扩展，跨上下文交互已标注 | ✅ |
| 8 | API 契约完整 | contracts 齐全且与 design 一致；跨域 deprecate 同步已说明 | ✅ |
| 9 | 前端架构对齐 | 沿用 globalData、memberList 改造、data-id、契约镜像合理 | ✅ |
| 10 | 构建序列可行 | 8 梯队无环；Task 0.4 依赖 0.3（迁移需先编译，见 N2） | ⚠️ 建议 |
| 11 | 现状对账完整 | 对账清单核心论断经独立核验全部属实（含本轮迁移核验） | ✅ |

---

## 四、三判决

| 判决 | 结论 |
|------|------|
| 设计质量 | ✅ 合格（迁移方案经独立核验正确，索引名与既有 migration 完全一致，改名范围完整；上一轮 10 项全部修复；余 N1/N2 两处轻微瑕疵） |
| 规则合规 | ✅ 合规（无 TBD/TODO、无硬编码密钥、无同步阻塞异步、契约文件齐全、迁移可回滚、生产不自动迁移——未发现 rule 违规） |
| 审批建议 | ⚠️ 建议有条件批准（进入 Stage 3 前修复 N2「Task 0.3 产出文件补全 5 个机械改名消费文件」，顺手修正 N1「移除 [Column]」措辞） |

---

## 五、待澄清问题及结果

| 问题 | 结论 | 状态 |
|------|------|------|
| 迁移 Up/Down 是否正确可回滚 | 正确：`RenameColumn` + 两 `RenameIndex`，`Down` 反向，索引名与实际既有 migration 逐字一致 | ✅ 已核验 |
| 索引名是否真是 `IX_Schedules_AssignedChildId` / `IX_Schedules_FamilyId_AssignedChildId` | 是，EF Core 自动生成，与 design 一致（InitialCreate.cs:207/217） | ✅ 已核验 |
| 改名范围是否遗漏其它 child 列 | 无遗漏：仅 `Schedules.AssignedChildId`；`FamilyMember.ChildName`/`InvitationCode.TargetChildName` 正确排除 | ✅ 已核验 |
| `RenameColumn` 是否不改数据 | 是（PG `ALTER TABLE RENAME COLUMN` 仅改名，不动行数据） | ✅ 已核验 |
| 生产是否不自动迁移 | 是（`Program.cs:149` 包在 `IsDevelopment()` 内） | ✅ 已核验 |
| 后端是否做 DisplayMode 门槛 | 不做（Decision 2 已确认接受的有意边界） | ✅ 已确认（非缺陷） |
| 双文案按关联成员角色 | 是（Decision 3，与用户拍板决策 #7 一致） | ✅ 已确认 |
| streak 是否仅孩子维度 | 是（Decision 4，逐 schedule 反查 role，已复核） | ✅ 已复核 |
| 兼容层新旧并存、error 返回新码 | 是（Decision 6，与用户拍板一致） | ✅ 已确认 |

无新增需人工拍板的阻塞项——用户已拍板的 6 项约束 + 本轮「否决零迁移、改正式迁移」均在设计中正确落档，未发现违反。

---

## 六、审核备注

- 本报告**不代替人工审批**。三层人审批（架构审核）是硬 Gate，本报告仅给出建议，最终由主代理呈交用户决策。
- **结论性意见**：本轮复审聚焦的迁移方案**成立**——`RenameColumn` + 两 `RenameIndex` 的 Up/Down 正确可回滚，索引名与实际既有 migration 逐字一致，改名范围界定完整（唯一落库 child 列为 `Schedules.AssignedChildId`，`FamilyMember.ChildName`/`InvitationCode.TargetChildName` 正确排除），「RenameColumn 不改数据」与「生产不自动迁移」论断均经代码核验属实。上一轮 1 阻塞 + 10 建议项全部修复。仅余 N1（措辞「移除 [Column]」应为「不加 [Column]」）与 N2（Task 0.3 产出文件缺 5 个机械改名消费文件，会导致 `dotnet build` 失败并阻塞 Task 0.4）两处轻微瑕疵，均为局部、可快速补齐，建议 arch-architect 在进入 Stage 3 前一并修订后定稿。
