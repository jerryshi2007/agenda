# Design: 模板系统模块

> 日期：2026-08-19
> 上游：staging `production/staging/2026-08-19-模板系统/`（dev-ready）
> 下游：dev-dotnet + dev-miniapp

---

## Context

家庭日程协作工具当前有 5 个已落地模块（日程管理 / 认证 / 打卡 / 家庭 / 展示模式），家长在创建日程时对常见类型（课后班、日常作息、作业）存在大量重复录入。模板系统通过"内容骨架 + 一键生成"减少重复，但与现有日程管理模块存在概念重合（共享 ScheduleType、TimeSlot 字段语义），需在保持日程模块概念完整性的前提下独立落地。

**当前架构约束**（来自现状对账）：

| 维度 | 现状 | 模板系统适配 |
|------|------|-------------|
| 后端分层 | 单 csproj 按模块目录（Schedule/Checkin/Family/Auth）+ Domain/Infrastructure | 模板系统作为 `api/Template/` 子目录（不新增 csproj） |
| 实体关系 | Entity 通过 EF Core Configuration 映射，AppDbContext 聚合 | 新增 Template / TemplateTimeSlot 实体，单独 Configuration |
| 共享数据 | 跨模块通过 ID 引用（外键）或 Service 接口（依赖反转） | 通过 `IScheduleService.CreateAsync` 组合（DRY 复用日程创建） |
| 共享枚举 | `ScheduleType` 已在 `api/Domain/Enums/` 存在 | 模板复用同枚举（不重复定义），契约 JSON 在 `openspec/contracts/template/enums.json` 中显式镜像（ScheduleType 条目含 sourceRef 指向 `api/Domain/Enums/ScheduleType.cs`） |
| 错误处理 | `DomainException` + 全局中间件 + `ErrorCodes` 常量 | 新增 Template 模块错误码常量 + 契约 errors.json |
| 种子数据 | 现有通过 `HasData()` 写入初始 Migration | 模板用 HostedService 实现幂等种子（避免污染 Migration 事务） |
| 前端 | 小程序原生 + services/api.js 统一封装 + contracts/ 镜像 | 沿用：services/template.js + contracts/template.js |
| 契约共享 | `openspec/contracts/{auth,checkin,family}/` + `app/contracts/*.js` 镜像 | 新增 `openspec/contracts/template/` + `app/contracts/template.js` |

**Stakeholders**：
- 家长：核心用户，使用预设 + 自定义模板
- 孩子：无模板访问权限（与日程管理权限一致）
- 后端/前端开发者：遵循现有模块布局，组合 IScheduleService

---

## Goals / Non-Goals

**Goals**：
- 落地 8 个 Must 需求（参见 staging requirement.md）
- 保持与现有日程管理模块概念正交，模板与日程是"生成时复制"非"引用"
- 复用现有基础设施（EF Core、JWT、FamilyContextService、FluentValidation、ScheduleType 枚举、IScheduleService.CreateAsync）
- 三端契约共享（`openspec/contracts/template/` JSON 为单一真相源）
- 性能：模板列表 ≤ 500ms，从模板生成日程 ≤ 1s

**Non-Goals**（首期不做）：
- 组合模板（每日作息套餐）——二期
- 模板分类/标签 ——二期
- 从预设模板另存为自定义模板 ——二期
- 模板使用统计分析（热度排行、推荐）——二期
- 模板导入/导出 ——二期
- 模板版本控制/历史 ——二期

---

## Decisions

### Decision 1: 限界上下文 = 单一 Template 上下文（独立子目录）

**Context**：模板系统在领域上与 Schedule 高度耦合（共享字段语义），但生命周期独立（模板可独立存在，生成时才复制为 Schedule）。

**Decision**：模板系统作为独立限界上下文 `Template`，但**复用 Schedule 的底层服务**。具体：
- 代码组织：新建 `api/Template/` 子目录（与 `Schedule/Checkin/Family/Auth` 平级）
- 不在 `api/Schedule/` 下建子目录（避免概念混淆，模板不是日程的子类型）
- `ITemplateService.ApplyAsync` 内部**直接调用 `IScheduleService.CreateAsync`**（参考 `CheckinService` 复用 `IScheduleQueryService` 的模式）

**Alternatives Considered**：
- ❌ 合并到 `api/Schedule/Template/`：模板与日程的可见性、权限、生命周期不同，混合在 Schedule 模块会污染其职责
- ❌ 独立 csproj `Agenda.Api.Template`：当前所有模块共享单 csproj（按目录划分），新增项目增加 DI 注册和构建复杂度
- ❌ TemplateService 不复用 IScheduleService.CreateAsync：违反 DRY，重复实现创建日程的 EF Core 逻辑，回归 bug 双倍风险

**Consequences**：
- ✅ 与现有 4 个已落地模块（Schedule/Checkin/Family/Auth）的代码组织对齐
- ✅ ApplyAsync 通过组合保证模板与日程字段语义一致（同一份创建逻辑）
- ⚠️ TemplateService 依赖 IScheduleService，需在 DI 注册时保证顺序

---

### Decision 2: 数据库 = 独立 Templates + TemplateTimeSlots 表

**Context**：模板与日程共享字段（Name/ScheduleType/TimeSlots/Notes/Location），但模板有独立生命周期（IsPreset、CreatedBy、FamilyId、IsDeleted）和独立可见性规则（预设 vs 自定义、家庭隔离）。

**Decision**：
- 新建表 `Templates`（独立实体）
- 新建表 `TemplateTimeSlots`（与 TimeSlot 表结构相同但外键指向 Templates）
- 在 `Schedules` 表新增列 `SourceTemplateId`（Guid?, nullable）用于追溯"由哪个模板生成"
- 新增 EF Migration `AddTemplateModule` 创建上述表/列 + 索引

**ER 图**：

```
┌─────────────────────────┐
│      Families           │
│      (existing)         │
└──────────┬──────────────┘
           │ 1
           │
           │ N
┌──────────▼──────────────┐         N ┌──────────────────────────┐
│      Templates         │◄───────────┤  TemplateTimeSlots        │
│  (NEW)                 │ 1       N │  (NEW)                    │
├─────────────────────────┤           ├──────────────────────────┤
│ Id (PK, Guid)          │           │ Id (PK, Guid)             │
│ Name (varchar 50)      │           │ TemplateId (FK)           │
│ ScheduleType (int)     │           │ DayOfWeek (int)           │
│ IsPreset (bool)        │           │ StartTime (time)          │
│ FamilyId (Guid?, FK)   │           │ EndTime (time)            │
│ CreatedBy (Guid)       │           └──────────────────────────┘
│ RepeatEndDate (date?)  │
│ Location (varchar 100?)│
│ Notes (varchar 500?)   │
│ IsDeleted (bool)       │
│ CreatedAt (timestamptz)│
│ UpdatedAt (timestamptz)│
└──────────┬──────────────┘
           │ N
           │
           │ (逻辑引用)
           │
           │ 1
┌──────────▼──────────────┐
│      Schedules          │
│      (existing)         │
├─────────────────────────┤
│ ... (existing cols)     │
│ SourceTemplateId (Guid?)│  ← NEW column
│ ... (existing cols)     │
└─────────────────────────┘
```

**Templates 表关键约束**：
- `IsPreset=true` → `FamilyId IS NULL`（预设模板不属于任何家庭）
- `IsPreset=false` → `FamilyId IS NOT NULL`（自定义模板必须属于某个家庭）
- 唯一性：`(FamilyId, Name)` 当 `IsPreset=false`（同家庭内模板名唯一）——通过过滤器索引实现
- 预设模板：`Name` 在 `IsPreset=true` 范围内唯一
- 软删除：`IsDeleted=true` 保留数据，`GetList/GetDetail` 查询过滤

**TemplateTimeSlots 表关键约束**：
- `(TemplateId, DayOfWeek)` 唯一（同一天只能有一个时间槽）
- `DayOfWeek` 与 `TimeSlot` 一样使用 `int` 转换（DayOfWeek 枚举）

**Schedules 表新增列**：
- `SourceTemplateId` (Guid, nullable, no FK)——逻辑引用，不级联删除（即使模板被删，日程仍保留引用）
- 索引：`(SourceTemplateId)` 用于 `usageCount` 查询

**Alternatives Considered**：
- ❌ 复用 Schedules 表（加 IsTemplate 列）：破坏 Schedule 概念清晰度，且与"生成时复制"语义冲突——一旦生成，独立 Schedule 与 Template 不应共享行
- ❌ 不加 SourceTemplateId 列：无法实现 `usageCount` 统计（删除确认提示需要）
- ❌ SourceTemplateId 加 FK + 级联删除：违反"模板删除不影响已生成日程"原则

**Consequences**：
- ✅ 模板与日程实体概念清晰，生命周期独立
- ✅ SourceTemplateId 软引用保留追溯链
- ⚠️ 新增 2 张表 + 1 列，Migration 数据量适中
- ⚠️ usageCount 统计需走索引查询（高频读，加 `(SourceTemplateId)` 索引）

---

### Decision 3: 从模板生成 = TemplateService 组合 IScheduleService.CreateAsync

**Context**：从模板生成日程 = "复制模板字段 + 套用孩子和起始日期"。但 ScheduleService.CreateAsync 已经实现"按 children 展开 + 创建 TimeSlot + 事务 + 响应组装"的完整逻辑。

**Decision**：
- `ITemplateService.ApplyAsync(templateId, request, ct)` 实现：
  1. 加载 Template + 验证权限（preset 或同家庭）
  2. 验证 childId 在当前家庭
  3. 验证 startDate >= today
  4. 合并覆盖字段（name/timeSlots/repeatEndDate/location/notes）→ 构造 `CreateScheduleRequest`
  5. 调用 `IScheduleService.CreateAsync(familyId, currentUserId, mergedRequest, ct)`
  6. 在生成的 Schedule 记录上设置 `SourceTemplateId=templateId`（通过 ScheduleService 新增的扩展点或后置更新）

**ScheduleService.CreateAsync 扩展点**：
- 在 `CreateScheduleRequest` 中新增可选字段 `SourceTemplateId: Guid?`
- `CreateAsync` 内部为每个生成的 Schedule 设置 `SourceTemplateId=request.SourceTemplateId`
- 现有 `CreateScheduleRequest` 字段保持向后兼容（新字段 nullable）

**Alternatives Considered**：
- ❌ 前端拉取模板 → 前端构造 CreateScheduleRequest → POST /schedules：两次网络请求，且前端承担字段合并逻辑，违反"服务端权威"
- ❌ TemplateService 独立写 Schedule 创建 SQL/EF 逻辑：重复实现，违反 DRY
- ❌ TemplateService 通过数据库直插 + 走 ScheduleService 的事务：复杂度高，没有收益

**Consequences**：
- ✅ 单一创建逻辑源（ScheduleService.CreateAsync），模板与直创日程的字段语义、并发控制、事务行为完全一致
- ✅ ScheduleService 新增 SourceTemplateId 字段对现有客户端向后兼容（未传则为 null）
- ⚠️ TemplateService 依赖 IScheduleService，需注意 DI 注册顺序

---

### Decision 4: 预设模板种子数据 = HostedService 幂等初始化

**Context**：3 个预设模板（课后班/日常作息/作业）需要应用启动时存在。当前 `Migrations/20260809110306_InitialCreate.cs` 等通过 EF Migration 初始化数据。

**Decision**：
- 不在 Migration 中插入（避免污染事务，3 个预设模板是"业务数据"非"schema 数据"）
- 实现 `TemplateSeedHostedService : IHostedService`，在应用启动时检查 + 插入：
  - 查询 `Templates WHERE IsPreset=true` 计数
  - 若 `< 3`，按 Name+ScheduleType 幂等插入缺失项
  - 启动失败时记 log 但不阻塞应用（种子失败不应导致 API 不可用）
	- 启动后定期重试（每小时一次），直到种子成功
	- 提供健康检查端点 `GET /api/v1/health/seed` 暴露种子状态（`{ seeded: true/false, presets: 3, errors: [...] }`）
- 模板字段：
  - AfterSchoolClass：Name="课后班模板", ScheduleType=AfterSchoolActivity, TimeSlots=[{Wed, 16:00-17:00}], IsPreset=true, FamilyId=null, CreatedBy=Guid.Empty
  - DailyRoutine：Name="日常作息模板", ScheduleType=DailyRoutine, TimeSlots=[{Mon-Sun, 18:00-18:30}], IsPreset=true, FamilyId=null, CreatedBy=Guid.Empty
  - Homework：Name="作业模板", ScheduleType=HomeworkTask, TimeSlots=[], IsPreset=true, FamilyId=null, CreatedBy=Guid.Empty

**Alternatives Considered**：
- ❌ 在 Migration 中用 `migrationBuilder.InsertData`：3 个预设 + N 个 TimeSlot 子行会污染 Migration 文件，且每次新环境部署都需 Migration 包含种子
- ❌ 用户首次访问时懒加载：首次访问延迟（违反"列表加载 ≤ 500ms"）
- ❌ 通过 `HasData()` EF Core Seed：写入 Migration 但与现有模式不一致（现有 Migration 无 HasData）

**Consequences**：
- ✅ 预设模板与业务代码同步（修改预设需改代码，避免 Migration 历史）
- ✅ 幂等：重启应用不重复插入
- ⚠️ HostedService 启动顺序需在 DbContext 初始化之后（依赖 ASP.NET Core 默认服务集合）

---

### Decision 5: 模板编辑 scheduleType 不可变

**Context**：模板生成日程时 scheduleType 决定 TimeSlot 规则。允许编辑时改 scheduleType 会导致：
- 已生成日程的 scheduleType 与模板不一致（虽无功能影响但语义混乱）
- 改 HomeworkTask ↔ 非 HomeworkTask 时 TimeSlot 集合语义翻转

**Decision**：
- `UpdateTemplateRequest` 不包含 `scheduleType` 字段
- 模板创建后 scheduleType 不可变
- 若用户想换类型，需删除原模板 + 新建模板

**Alternatives Considered**：
- ✅ 允许改 scheduleType 但限制为同类型组（AfterSchoolActivity ↔ DailyRoutine）：增加复杂度，价值低（用户直接删建更清晰）
- ❌ 完全禁止改 scheduleType：更严格但用户可能反馈"为什么不让我改"

**Consequences**：
- ✅ UpdateTemplateRequest 简洁（不含 scheduleType 字段）
- ✅ 模板字段变更可控，生成逻辑稳定

---

### Decision 6: Schedule 实体扩展 SourceTemplateId 字段（向后兼容）

**Context**：为实现 "从模板生成" 的追溯链，Schedule 需记录来源模板。

**Decision**：
- 在 `Schedule` 实体新增 `SourceTemplateId: Guid?` 属性
- `CreateScheduleRequest` 新增 `SourceTemplateId: Guid?` 字段（默认 null）
- `CreateScheduleResponse` 不变（响应不暴露来源）
- Schedule 详情 API（GET /api/v1/schedules/{id}）可选地暴露 `SourceTemplateId`（不强制）
- ScheduleConfiguration 新增 `(SourceTemplateId)` 索引
- Migration 加列 + 索引

**Alternatives Considered**：
- ❌ 不加 SourceTemplateId：通过查询 Schedule 是否有匹配 Template 字段推断——不可靠（用户可编辑后字段已变）
- ❌ 加 SourceTemplateId 但加 FK：违反"模板删除不影响日程"
- ❌ 加 SourceTemplateId 且加 NOT NULL：破坏向后兼容（现有创建无 SourceTemplateId）

**Consequences**：
- ✅ usageCount 统计通过 `(SourceTemplateId)` 索引高效查询
- ✅ 字段 nullable，向后兼容现有调用方
- ⚠️ Schedule 实体加一列，Migration 必加

---

### Decision 7: 权限模型 = Parent-only，所有端点统一校验

**Context**：现有日程管理模块的权限模式：
- 孩子角色：仅 GET 自己的日程（ChildScheduleController）
- 家长角色：全功能（含创建/编辑/删除）

模板系统孩子角色完全无访问权限（无模板视图），所有端点必须 `role == UserRole.Parent`。

**Decision**：
- `TemplateController` 所有方法前显式校验 `role != UserRole.Parent` → 返回 403 `CHILD_ACCESS_DENIED`
- `GET /api/v1/templates/{id}` 同样校验（孩子不可查看模板详情）
- `GET /api/v1/templates` 同样校验（孩子不可列出模板）
- 自定义模板的 Update/Delete 额外校验 `CreatedBy == currentUserId`，否则返回 403 `TEMPLATE_NOT_OWNER`
- 预设模板的 Update/Delete 返回 403 `TEMPLATE_PRESET_READONLY`

**Alternatives Considered**：
- ❌ 路由级 `[Authorize(Roles="Parent")]`：现有模式（ScheduleController）是在方法内显式 `if (role != Parent) return ForbidJwt(...)`，保持一致
- ❌ 让孩子可"查看模板列表"（只读）但不能编辑：首期需求明确"孩子不可访问模板管理页面"，无业务价值

**Consequences**：
- ✅ 与现有模块权限模式一致
- ✅ 孩子端零模板代码（无 child-template 端点）
- ✅ 未来若需要让孩子"参考预设模板"作为学习目标，可扩展只读 GET

---

### Decision 8: 前端表单复用 = 抽取 schedule-form 组件

**Context**：模板创建/编辑表单字段 = 日程创建表单字段（Name/ScheduleType/TimeSlots/Notes/Location/RepeatEndDate）的子集，区别仅是不填 ChildIds/StartDate。

**Decision**：
- 抽取 `app/components/schedule-form/` 组件，接收 props：
  - `mode`: 'create' | 'edit' | 'template'
  - `initialValues`: 初始字段
  - `childSelectorVisible`: 是否显示孩子选择（template 模式隐藏）
  - `startDateVisible`: 是否显示起始日期（template 模式隐藏）
  - `onSubmit`: 提交回调
- 现有 `pages/schedule-create/index.wxml` 和 `pages/schedule-edit/index.wxml` 重构为使用 schedule-form 组件
- 新建 `pages/template-create/index.wxml` 和 `pages/template-edit/index.wxml` 也使用 schedule-form（mode=template）

**Alternatives Considered**：
- ❌ 模板创建/编辑独立组件（不抽取）：重复实现 4 份表单逻辑，回归 bug 双倍
- ❌ 抽到 lib/util 层（不抽组件）：表单是 UI 概念，组件更适合复用
- ❌ 不重构现有 schedule-create/edit：技术债累积，未来再加模板变体更痛苦

**Consequences**：
- ✅ 4 处表单（创建日程/编辑日程/创建模板/编辑模板）共享一套字段渲染、校验、TimeSlot 编辑器
- ✅ 现有 schedule-create/edit 重构工作量适中（≈ 0.5d）
- ⚠️ schedule-form 组件需支持 4 种 mode 下的 prop 差异，组件复杂度略增

---

### Decision 9: 列表分区 = 后端不分组 + 前端按 IsPreset 分区渲染

**Context**：模板列表页 UI 设计：预设模板和自定义模板分区展示。

**Decision**：
- 后端 `GET /api/v1/templates` 返回**扁平列表**（已按 `IsPreset DESC, CreatedAt DESC` 排序）
- 前端列表页按 `isPreset` 字段在渲染时分组（reduce 成 2 个数组）
- 列表响应已包含足够排序信息，前端无需再次排序

**Alternatives Considered**：
- ❌ 后端返回分组结构（`{presets: [...], customs: [...]}`）：增加响应结构复杂度，前端切换筛选条件时难复用
- ❌ 前端独立请求两次（`?isPreset=true` 和 `?isPreset=false`）：增加网络请求

**Consequences**：
- ✅ 后端响应结构简洁，列表/搜索/筛选共用同一接口
- ✅ 前端按 IsPreset 分组只是渲染层逻辑，组件可复用

---

## Risks / Trade-offs

| # | 风险 | 影响 | 缓解 |
|---|------|------|------|
| 1 | ScheduleService.CreateAsync 改造影响现有功能 | 现有创建日程 API 行为若变化可能回归 | SourceTemplateId 字段 nullable 且默认 null；CreateAsync 内部设置 `schedule.SourceTemplateId = request.SourceTemplateId` 一行改动；为现有 CreateScheduleRequest 测试加"未传 SourceTemplateId 时为 null"断言 |
| 2 | 模板种子 HostedService 启动失败 | 3 个预设模板缺失 | catch 异常 + log error，应用继续启动；启动后每小时重试直至成功；健康检查端点 `GET /api/v1/health/seed` 暴露种子状态；前端"无预设模板"显示降级提示 |
| 3 | 预设模板被恶意 PUT/DELETE 绕过 | 数据损坏 | 双重防护：路由层校验 `IsPreset` 字段 + Service 层抛 `TEMPLATE_PRESET_READONLY` DomainException |
| 4 | 家庭隔离被 SQL 拼写错误绕过 | 跨家庭数据泄露 | 列表/详情/更新/删除的 EF Core 查询 MUST 包含 `FamilyId == currentFamilyId OR IsPreset` 谓词；code review 检查；单元测试覆盖跨家庭场景 |
| 5 | schedule-form 组件重构引入回归 | 现有创建/编辑日程流程破损 | 抽出 schedule-form 后跑完整 Playwright 套件；保留旧 page-level 表单代码在 git 历史可回滚 |
| 6 | usageCount 计数性能问题 | 删除确认弹窗慢 | `(SourceTemplateId)` 索引 + 仅在 GET /templates/{id} 详情接口统计（不在列表接口），命中缓存友好 |
| 7 | 同家庭重名模板 | UI 困惑 | DB 唯一索引 `(FamilyId, Name) WHERE IsPreset=false AND IsDeleted=false`；Service 层抛 `TEMPLATE_DUPLICATE_NAME` |
| 8 | TimeSlot 重复（同一天多个） | 数据不一致 | `TemplateTimeSlots` 表 `(TemplateId, DayOfWeek)` 唯一索引；Service 层 upsert 前验证 |

---

## Migration Plan

**Migration 步骤**（EF Core 命名 `AddTemplateModule`）：

1. `CREATE TABLE Templates` —— 13 列（含 IsPreset, FamilyId NULL, CreatedBy, IsDeleted 等）
2. `CREATE TABLE TemplateTimeSlots` —— 4 列（TemplateId FK, DayOfWeek, StartTime, EndTime）+ 唯一索引
3. `ALTER TABLE Schedules ADD COLUMN SourceTemplateId UUID NULL` + 索引
4. 不写 INSERT 语句（预设模板由 HostedService 启动时幂等插入）

**部署顺序**：
1. 应用启动 → EF Migration 自动执行（如 `Database.MigrateAsync()`，dev-only）或 CI/CD 手动执行（生产）
2. Migration 完成后 → HostedService 启动 → 检查 + 插入 3 个预设模板
3. API 接受请求 → 模板 CRUD + 生成日程可用

**回滚策略**：
- Migration Down：删 `TemplateTimeSlots` 表 → 删 `Templates` 表 → 删 `Schedules.SourceTemplateId` 列
- 软删除的模板保留数据（IsDeleted=true 行不被 GetList 返回，但 DB 中存在，回滚 Migration 时表消失 = 数据删除）
- 风险：回滚后已生成的 Schedule 仍保留 SourceTemplateId 值但 Template 表不存在——下次查询 usageCount 时会静默失败（LEFT JOIN + null check），不抛错
- 缓解：归档前确认所有用户已升级到含模板系统的版本

**种子数据回滚**：
- 预设模板的删除是应用层动作（不可通过 EF Migration 回滚到"无预设"状态）
- 误操作：手动 `DELETE FROM Templates WHERE IsPreset=true` 后重启应用即重新插入

---

## Open Questions

（无。本设计已基于现有架构和需求做出所有关键决策。Stage 3 实现期间若发现新问题，由 dev-dotnet / dev-miniapp 在 task 层反馈，arch-architect 不再返工 design.md。）

---

## 附录 A：现状对账清单

| 已有代码 | 用途 | 本次变更 | 标注 |
|---------|------|---------|------|
| `api/Domain/Entities/Schedule.cs` | 日程实体 | 扩展：新增 `SourceTemplateId` 字段 | **扩展** |
| `api/Domain/Entities/TimeSlot.cs` | 时间槽实体 | 不变 | **复用**（TemplateTimeSlot 是新表但结构同构） |
| `api/Domain/Enums/ScheduleType.cs` | 日程类型枚举 | 不变 | **复用**（模板类型 = 日程类型） |
| `api/Schedule/Services/IScheduleService.cs` | 日程服务接口 | 扩展：CreateAsync 接受新字段（向后兼容） | **扩展**（创建日程支持 SourceTemplateId） |
| `api/Schedule/Services/ScheduleService.cs` | 日程服务实现 | 扩展：设置新生成 Schedule 的 SourceTemplateId | **扩展** |
| `api/Schedule/Dtos/CreateScheduleRequest.cs` | 创建日程请求 | 扩展：新增 `SourceTemplateId` 字段（nullable） | **扩展** |
| `api/Infrastructure/Data/AppDbContext.cs` | EF Core DbContext | 扩展：新增 `DbSet<Template>` + `DbSet<TemplateTimeSlot>` | **扩展** |
| `api/Infrastructure/Data/Configurations/ScheduleConfiguration.cs` | Schedule EF 配置 | 扩展：新增 `SourceTemplateId` 索引 | **扩展** |
| `api/Schedule/Controllers/ScheduleController.cs` | 日程 Controller | 扩展：在 Create action 透传 SourceTemplateId | **扩展**（几乎无代码改动） |
| `api/Schedule/Services/IFamilyContextService.cs` | 家庭上下文服务 | 不变 | **复用**（TemplateController 直接调用） |
| `api/Infrastructure/ErrorCodes.cs` | 错误码常量 | 扩展：新增 Template 模块错误码 | **扩展** |
| `api/Shared/Extensions/ControllerExtensions.cs` | Controller 扩展（ForbidJwt 等） | 不变 | **复用** |
| `app/services/api.js` | 统一 API 封装 | 不变 | **复用** |
| `app/utils/storage-keys.js` | Storage 键名常量 | 不变 | **复用** |
| `app/contracts/checkin.js` 等 | 契约镜像 | 参考模式新建 `app/contracts/template.js` | **复用模式** |
| `app/pages/schedule-create/index.wxml` | 日程创建页 | 扩展：顶部加"从模板创建"入口 | **扩展** |
| `app/pages/schedule-detail/index.wxml` | 日程详情页 | 扩展：操作菜单加"保存为模板" | **扩展** |
| `app/components/time-slot-picker` | 时间槽选择器 | 不变 | **复用**（schedule-form 组件内引用） |
| `openspec/contracts/checkin/` | 契约 JSON 模式 | 复用模式新建 `openspec/contracts/template/` | **复用模式** |

**新建**（清单）：
- `api/Domain/Entities/Template.cs`
- `api/Domain/Entities/TemplateTimeSlot.cs`
- `api/Template/Controllers/TemplateController.cs`
- `api/Template/Services/ITemplateService.cs`
- `api/Template/Services/TemplateService.cs`
- `api/Template/Dtos/CreateTemplateRequest.cs`
- `api/Template/Dtos/UpdateTemplateRequest.cs`
- `api/Template/Dtos/ApplyTemplateRequest.cs`
- `api/Template/Dtos/TemplateSummary.cs`
- `api/Template/Dtos/TemplateDetail.cs`
- `api/Template/Dtos/ListTemplatesResponse.cs`
- `api/Template/Dtos/DeleteTemplateResponse.cs`
- `api/Template/Dtos/TemplateTimeSlotDto.cs`
- `api/Template/Validators/CreateTemplateRequestValidator.cs`
- `api/Template/Validators/UpdateTemplateRequestValidator.cs`
- `api/Template/Validators/ApplyTemplateRequestValidator.cs`
- `api/Template/Services/TemplateSeedHostedService.cs`
- `api/Infrastructure/Data/Configurations/TemplateConfiguration.cs`
- `api/Infrastructure/Data/Configurations/TemplateTimeSlotConfiguration.cs`
- `api/Migrations/20260819HHMMSS_AddTemplateModule.cs`
- `openspec/contracts/template/enums.json`（已建）
- `openspec/contracts/template/errors.json`（已建）
- `openspec/contracts/template/dto.json`（已建）
- `app/services/template.js`
- `app/contracts/template.js`
- `app/components/schedule-form/`（重构抽取，4 处复用）
- `app/components/use-template-dialog/`
- `app/pages/template-list/`
- `app/pages/template-detail/`（编辑/查看合一）
- `app/pages/template-create/`（使用 schedule-form 组件）

---

## 附录 B：核心时序图

### B.1 创建模板（从零）

```
家长小程序                                       API                              DB
  │                                                │                                │
  │  POST /api/v1/templates                        │                                │
  │  {name, scheduleType, timeSlots, ...}         │                                │
  │ ───────────────────────────────────────────►  │                                │
  │                                                │                                │
  │                                                │ [FluentValidation]             │
  │                                                │  - 名称长度 1-50               │
  │                                                │  - scheduleType 有效            │
  │                                                │  - HomeworkTask 无 timeSlots    │
  │                                                │  - 其他类型 timeSlots ≥ 1      │
  │                                                │                                │
  │                                                │ 查 (FamilyId, Name) 唯一性      │
  │                                                │ ─────────────────────────────► │
  │                                                │ ◄── 冲突？TEMPLATE_DUPLICATE ──│
  │                                                │                                │
  │                                                │ INSERT Template                │
  │                                                │ ─────────────────────────────► │
  │                                                │                                │
  │                                                │ INSERT TemplateTimeSlots (N 行)│
  │                                                │ ─────────────────────────────► │
  │                                                │                                │
  │  201 Created                                   │                                │
  │  { templateId, ... }                           │                                │
  │ ◄───────────────────────────────────────────  │                                │
  │                                                │                                │
```

### B.2 从模板生成日程

```
家长小程序                                       API                              DB
  │                                                │                                │
  │  POST /api/v1/templates/{tid}/apply            │                                │
  │  { childId, startDate, [name?], ... }         │                                │
  │ ───────────────────────────────────────────►  │                                │
  │                                                │                                │
  │                                                │ 加载 Template                  │
  │                                                │ ─────────────────────────────► │
  │                                                │ 权限校验：preset OR 同家庭      │
  │                                                │                                │
  │                                                │ 校验 childId 在家庭内          │
  │                                                │ ─────────────────────────────► │
  │                                                │ 校验 startDate >= today        │
  │                                                │                                │
  │                                                │ 合并覆盖字段 →                 │
  │                                                │   CreateScheduleRequest {      │
  │                                                │     ... fields from template   │
  │                                                │     SourceTemplateId=tid  ← ★ │
  │                                                │   }                            │
  │                                                │                                │
  │                                                │ IScheduleService.CreateAsync   │
  │                                                │ ────────────────────────────► │
  │                                                │  事务：                        │
  │                                                │   - INSERT Schedule (SourceTemplateId=tid) │
  │                                                │   - INSERT TimeSlot(s)         │
  │                                                │                                │
  │  201 Created                                   │                                │
  │  { groupKey, schedules: [...] }                │                                │
  │ ◄───────────────────────────────────────────  │                                │
  │                                                │                                │
  │ wx.showToast("创建成功")                        │                                │
  │ wx.redirectTo /pages/schedule-detail?id=...   │                                │
```

### B.3 编辑/删除模板不影响已生成日程

```
家长小程序                                       API                              DB
  │                                                │                                │
  │  DELETE /api/v1/templates/{tid}                │                                │
  │ ───────────────────────────────────────────►  │                                │
  │                                                │                                │
  │                                                │ 校验：IsPreset=false            │
  │                                                │ 校验：CreatedBy=currentUser   │
  │                                                │                                │
  │                                                │ UPDATE Templates               │
  │                                                │  SET IsDeleted=true            │
  │                                                │ ─────────────────────────────► │
  │                                                │                                │
  │  200 OK { deleted=true }                       │                                │
  │ ◄───────────────────────────────────────────  │                                │
  │                                                │                                │
  │ 已生成的 Schedule 行不受影响                     │                                │
  │ - Schedule.SourceTemplateId 仍指向 tid         │                                │
  │ - usageCount 统计需 WHERE IsDeleted=false 但   │                                │
  │   当前查询：usageCount = COUNT(schedules WHERE │                                │
  │   SourceTemplateId=tid AND IsDeleted=false)    │                                │
  │   即"曾被使用的数量"                            │                                │
  │                                                │                                │
```

### B.4 异常路径：跨家庭访问模板

```
FamilyA 家长                                    API                              DB
  │                                                │                                │
  │  GET /api/v1/templates/{templateB-id}          │                                │
  │ ───────────────────────────────────────────►  │                                │
  │                                                │                                │
  │                                                │ SELECT * FROM Templates        │
  │                                                │  WHERE Id={templateB-id}       │
  │                                                │   AND (IsPreset=true            │
  │                                                │        OR FamilyId=familyA-id) │
  │                                                │ ─────────────────────────────► │
  │                                                │ ◄── NULL row ─────────────────│
  │                                                │                                │
  │  404 Not Found                                 │                                │
  │  { error: "TEMPLATE_NOT_FOUND" }               │                                │
  │ ◄───────────────────────────────────────────  │                                │
```

---

## 附录 C：构建序列（高层）

```
第 0 梯队：基础设施（无依赖）
  - AddTemplateModule EF Migration
  - openspec/contracts/template/* + app/contracts/template.js

第 1 梯队：后端数据层
  - Template + TemplateTimeSlot 实体
  - TemplateConfiguration + TemplateTimeSlotConfiguration
  - AppDbContext 扩展
  - ErrorCodes 新增常量
  - 单元测试：Repository 查询跨家庭隔离

第 2 梯队：后端服务层
  - ITemplateService + TemplateService（CRUD）
  - DTOs
  - FluentValidation
  - Schedule 实体扩展 SourceTemplateId
  - ScheduleService.CreateAsync 接受 SourceTemplateId
  - 单元测试：CRUD 权限 + 边界

第 3 梯队：后端 API 层
  - TemplateController
  - 6 个端点 + DTO 映射
  - 集成测试：HTTP 端到端

第 4 梯队：预设模板种子
  - TemplateSeedHostedService
  - 幂等性测试

第 5 梯队：前端契约 + service
  - app/services/template.js
  - app/contracts/template.js（与 JSON 同步）
  - parity 测试

第 6 梯队：前端 schedule-form 抽取
  - schedule-form 组件
  - 重构 schedule-create / schedule-edit 使用
  - 回归测试

第 7 梯队：前端页面
  - pages/template-list/（分区 + 搜索 + 空态）
  - pages/template-detail/（编辑 + 删除二次确认）
  - pages/template-create/（从零）
  - components/use-template-dialog/（使用模板）
  - schedule-detail 加"保存为模板"按钮
  - schedule-create 顶部加"从模板创建"入口

第 8 梯队：E2E 联调
  - 主代理执行 Playwright（如适用）+ 手动冒烟
```

详细 task 列表见 `tasks.md`。
