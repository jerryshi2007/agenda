# Design: 日程管理模块

> Change: `add-event-module` | Schema: spec-driven | Date: 2026-08-08 | Reviewed: 2026-08-08

---

## Context

### 背景

日程管理是家庭日程协作工具的核心模块，负责日程的完整生命周期（创建/编辑/删除/取消/打卡）。当前 `api/` 和 `app/` 目录仅有骨架文件，auth-module 和 checkin-module 已完成架构设计（Stage 2），但代码尚未建仓。

### 当前状态

- **后端**：`api/` 目录仅有 CLAUDE.md，auth-module design.md 已定义 .NET 10 Web API + PostgreSQL + EF Core 项目结构（单项目、模块按文件夹组织）。checkin-module design.md 已定义 Checkin 实体、打卡窗口判定、结算任务架构。
- **前端**：`app/` 目录仅有 CLAUDE.md，auth-module design.md 已定义微信小程序原生框架的项目骨架（TabBar、页面路由、components/services/styles 目录）。
- **数据库**：PostgreSQL，单数据库模式（auth-module ADR-004）。auth-module 已定义 User 实体；checkin-module 已定义 Checkin 实体（虚拟实例模式 ADR-010）。
- **需求**：staging 目录 `production/staging/2026-08-08-日程管理/` 状态为 `dev-ready`，含 20 个 GWT 用户故事 + 23 条边界异常 + 3 个 Story（EVT-ST-01/02/03）。

### 已有设计对齐

本设计扩展 auth-module 和 checkin-module 的决策，必须与之对齐：

| 决策 | 来源 | 对齐要点 |
|------|------|---------|
| .NET 10 Web API + 单项目 | auth-module ADR-001 | Schedule 模块文件放入 `api/Schedule/` |
| 模块按文件夹组织 | auth-module ADR-002 | Schedule 模块直接放在 `api/` 下 |
| PostgreSQL | auth-module ADR-004 | 共享同一数据库 |
| 微信小程序原生 | auth-module ADR-005 | 前端走原生 WXML/WXSS/JS |
| JWT + 静默续期 | auth-module ADR-003/007 | Schedule API 复用 JWT 中间件 |
| 打卡虚拟实例模式 | checkin-module ADR-010 | Schedule 需提供 (scheduleId, date) 维度的实例展开能力 |
| Hangfire 定时调度 | checkin-module ADR-011 | 结算任务由 Checkin 模块负责，Schedule 模块不建新调度 |
| 打卡幂等 | checkin-module ADR-012 | Schedule 模块确保 UNIQUE(scheduleId, date) 语义正确 |
| 头像存储 | auth-module ADR-009 | 日程模块无文件上传需求 |

### 约束

| 约束 | 来源 |
|------|------|
| 平台：微信小程序（基础库 >= 2.10.0），iOS 12+ / Android 8.0+ | CLAUDE.md |
| 后端：.NET 10，EF Core，PostgreSQL，单项目 | auth-module ADR-001/002/004 |
| 前端：微信小程序原生 | auth-module ADR-005 |
| 认证方式：JWT Bearer，所有 API 需登录态 | auth-module design |
| 数据按家庭隔离，非家庭成员不可访问 | index.md 8.3 |
| 性能底线：创建 <= 2s，视图切换 <= 500ms，打卡 <= 1s | CLAUDE.md |
| 创建流程 <= 3 步，敏感操作二次确认 | index.md |
| openid 前端不可见，密钥环境变量注入 | dev-security rule |
| API 版本：URL 路径 `/api/v1/` | dev-dotnet-standards |
| 异步方法必须含 CancellationToken 参数（dev-dotnet-standards） | .claude/rules/ |

---

## Goals / Non-Goals

### Goals

1. 实现完整的日程 CRUD（三种类型：课后活动/日常作息/作业任务、时间槽模型、冲突检测）
2. 实现日程编辑（仅本次/全部未来实例，分段开关，乐观锁并发控制）与删除（仅本次/本次及之后）
3. 实现日历三视图（月/周/日）数据查询 API，按孩子和类型筛选
4. 实现日程详情页 + 打卡交互（与 checkin-module 联调）
5. 实现临时取消与恢复功能
6. 建立前端完整架构（日历视图页面、日程详情页、创建/编辑页、组件树、状态管理）
7. 实现 checkin-module 定义的 IScheduleQueryService 接口，提供 Schedule 基础信息查询能力

### Non-Goals

- 模板系统对接（US-EVT-04 为 Should，按需求分级列入第一期）
- 快捷打卡按钮（US-EVT-15 为 Should，详细设计由 checkin-module 负责，Schedule 模块仅提供日历卡片上的按钮位）
- 打卡时间窗口判定逻辑（属于 checkin-module 职责，Schedule 模块仅提供 Schedule 基础信息）
- 孩子展示模式差异化渲染（第二期）
- 拖拽调整日程时间（第二期）
- 高年级孩子自主添加日程（第二期）
- 日历数据看板/统计（checkin-module 二期）
- 订阅消息提醒（checkin-module 二期）
- 跨天时间槽 UI 优化（Could）
- 视图切换防抖细节（Could）

---

## Decisions

### 3.1 项目结构与限界上下文划分

#### 整体划分（扩展现有 auth-module + checkin-module 设计）

```
agenda/
├── api/                                    # .NET 10 Web API（单项目）
│   ├── Agenda.Api.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   ├── Auth/                               # 认证模块（已有设计）
│   ├── Checkin/                            # 打卡模块（已有设计）
│   │   ├── IScheduleQueryService.cs           # 接口定义（checkin-module 定义，Schedule 模块实现）
│   │   └── ...
│   ├── Schedule/                              # 日程模块（NEW）
│   │   ├── ScheduleController.cs              # 日程 CRUD + 日历查询
│   │   ├── ScheduleService.cs
│   │   ├── IScheduleService.cs
│   │   ├── TimeSlotService.cs              # 时间槽展开逻辑
│   │   ├── ITimeSlotService.cs
│   │   ├── CalendarQueryService.cs         # 日历视图数据聚合
│   │   ├── ICalendarQueryService.cs
│   │   ├── ConflictDetectionService.cs     # 冲突检测
│   │   ├── IConflictDetectionService.cs
│   │   ├── ScheduleQueryService.cs            # IScheduleQueryService 实现（供 checkin-module 调用）
│   │   ├── Dtos/
│   │   │   ├── CreateScheduleRequest.cs
│   │   │   ├── ScheduleResponse.cs
│   │   │   ├── UpdateScheduleRequest.cs
│   │   │   ├── CalendarQueryRequest.cs
│   │   │   ├── CalendarResponse.cs
│   │   │   ├── ScheduleConflictResponse.cs
│   │   │   └── InstanceStatusResponse.cs
│   │   └── Validators/
│   │       ├── CreateScheduleRequestValidator.cs
│   │       ├── UpdateScheduleRequestValidator.cs
│   │       └── CalendarQueryValidator.cs
│   ├── Domain/                             # 共享领域实体
│   │   ├── Entities/
│   │   │   ├── User.cs                     # 已有（auth-module）
│   │   │   ├── Checkin.cs                  # 已有（checkin-module）
│   │   │   ├── Schedule.cs                    # NEW
│   │   │   ├── TimeSlot.cs                 # NEW
│   │   │   ├── Cancellation.cs             # NEW
│   │   │   └── ScheduleDateExclusion.cs       # NEW
│   │   └── Enums/
│   │       ├── UserStatus.cs               # 已有
│   │       ├── ScheduleType.cs                # 已有（checkin-module 定义，Schedule 模块引用）
│   │       ├── ScheduleStatus.cs              # NEW（Incomplete/Completed/Cancelled/Ended/Overdue）
│   │       └── EditScope.cs                # NEW（ThisOnly/ThisAndFuture）
│   ├── Infrastructure/
│   │   ├── Data/
│   │   │   ├── AppDbContext.cs             # 扩展：新增 Schedule/TimeSlot/Cancellation/ScheduleDateExclusion DbSet
│   │   │   └── Configurations/
│   │   │       ├── ScheduleConfiguration.cs   # NEW
│   │   │       ├── TimeSlotConfiguration.cs # NEW
│   │   │       ├── CancellationConfiguration.cs  # NEW
│   │   │       └── ScheduleDateExclusionConfiguration.cs  # NEW
│   │   └── Middleware/
│   │       └── ExceptionHandlingMiddleware.cs  # 已有
│   └── Migrations/                         # EF Core 迁移
├── app/                                    # 微信小程序原生
│   ├── app.js / app.json / app.wxss
│   ├── pages/
│   │   ├── index/                          # 日历首页（月/周/日三视图）
│   │   ├── schedule-detail/                   # 日程详情页（含打卡交互）
│   │   ├── schedule-create/                   # 创建日程页（选孩子 -> 选类型 -> 填字段 -> 确认）
│   │   ├── schedule-edit/                     # 编辑日程页（复用创建页，预填 + 分段开关）
│   │   └── mine/                           # "我的"页面（已有）
│   ├── components/
│   │   ├── calendar-view/                  # 日历视图容器（三视图切换）
│   │   ├── month-view/                     # 月视图子组件
│   │   ├── week-view/                      # 周视图子组件
│   │   ├── day-view/                       # 日视图子组件
│   │   ├── schedule-card/                     # 日程卡片（日/周视图共用）
│   │   ├── time-slot-picker/              # 时间槽选择器（快速填充 + 逐天微调）
│   │   ├── filter-bar/                     # 筛选栏（按孩子 + 按类型）
│   │   ├── child-selector/                 # 孩子选择器（多选）
│   │   ├── type-selector/                  # 类型选择器（三卡片）
│   │   └── edit-scope-switch/             # 编辑范围分段开关
│   ├── services/
│   │   ├── api.js                          # 已有（auth-module，统一请求封装）
│   │   ├── schedule.js                        # NEW 日程 API 封装
│   │   └── calendar.js                     # NEW 日历查询 API 封装
│   ├── stores/
│   │   └── calendar-store.js               # NEW 日历视图状态管理（当前视图/日期/筛选条件）
│   ├── utils/
│   │   ├── storage-keys.js                 # 已有
│   │   └── date-utils.js                   # NEW 日期计算工具函数
│   └── styles/
│       ├── tokens.wxss                     # 已有
│       └── common.wxss                     # 已有
└── openspec/
```

#### 限界上下文

| 上下文 | 聚合根 | 模块目录 | 本模块关系 |
|--------|--------|---------|-----------|
| Auth（认证） | User | `api/Auth/` | 提供 userId（JWT 中解析）、familyId（Family 上下文） |
| Family（家庭） | Family | `api/Family/`（后续） | 提供 familyId + 孩子列表，Schedule 通过 familyId 隔离数据 |
| **Schedule（日程）** | **Schedule** | `api/Schedule/` | **本模块新建** |
| Checkin（打卡） | Checkin | `api/Checkin/`（已有设计） | 定义 IScheduleQueryService 接口；Schedule 模块实现此接口，提供 schedule 基础信息（类型、时间、取消状态）供 checkin 模块做窗口判定 |

**跨上下文交互规则**：
- Schedule 通过 `familyId` 隔离数据——查询时按 JWT 中的 userId 查 FamilyMember 获取 familyId，再按 familyId 过滤 Schedule
- Checkin 通过 `scheduleId` + `date` 引用 Schedule 实例，不直接持有 Schedule 实体引用
- **IScheduleQueryService 接口由 checkin-module 定义**（放在 `api/Checkin/` 或 `api/Domain/Interfaces/`），Schedule 模块实现它（放在 `api/Schedule/ScheduleQueryService.cs`）。依赖反转：checkin 模块不依赖 Schedule 模块编译。
- Schedule 模块仅提供 schedule 基础信息（类型、时间、截止日期、取消状态），**打卡窗口的时间规则判定**（提前 30 分钟/课后活动 +2h/日常作息当天 24:00/作业截止当天 24:00）属于 checkin 模块职责。
- Cancellation 和 ScheduleDateExclusion 由 Schedule 模块管理——checkin-module 通过 `IScheduleQueryService.GetCancellationStatus(scheduleId, date)` 和 `IScheduleQueryService.IsDateExcluded(scheduleId, date)` 查询，不直接读写这两张表。
- Template 模块读取 Schedule 数据：通过 scheduleId 查询 Schedule 字段保存为模板（US-EVT-04 Should，不在首期 Must）

#### 数据库策略

- **单数据库**，扩展现有 PostgreSQL 数据库
- EF Core Code First，新增 Schedule、TimeSlot、Cancellation、ScheduleDateExclusion 四张表
- 迁移脚本纳入版本控制
- 不新建数据库
- 与 checkin-module 的契约对齐：checkin-module 预定义 Schedule 骨架实体字段，Schedule 模块落地时通过 IScheduleQueryService 接口适配。（详见 ADR-017）
- ScheduleType 枚举：checkin-module 已定义在 `Domain/Enums/ScheduleType.cs`，Schedule 模块直接引用，不重复定义

### 3.2 ADR 决策记录

#### ADR-014: 多孩子模型 -- 创建时展开为 N 条 Schedule 记录

- **Context**: 需求明确 `module-event.md` §4.1 要求"一次创建关联多个孩子，打卡记录各自独立"。checkin-module ADR-010 假设 Schedule 采用"一个日程记录对应一个孩子"模型（`AssignedChildId` 单数），`UNIQUE(ScheduleId, Date)` 约束依赖此假设。若 Schedule 采用"一个日程记录关联多个孩子"模型（ScheduleChild 多对多），则 Checkin 的 UNIQUE 约束须调整为 `(ScheduleId, ChildId, Date)`。

- **Decision**: 采用**展开模型**——家长选择 N 个孩子时，系统内部创建 N 条 Schedule 记录，每条记录有独立的 `AssignedChildId`，共享相同的名称、类型、时间槽、重复规则等模板字段。编辑/删除操作按单条 Schedule 记录独立处理（对应单个孩子）。前端"全孩子编辑"UI 通过批量操作多条 Schedule 记录实现（如编辑时展示"此修改将应用到所有关联孩子"提示）。

- **Consequences**:
  - Positive: checkin-module 的 UNIQUE(ScheduleId, Date) 约束无需调整；每条 Schedule 记录的打卡独立、状态独立、编辑独立；实现简单，无多对多关系表；EF Core 实体关系清晰
  - Negative: 批量操作多孩子场景（编辑"全部日程"同时影响 N 条 Schedule 记录）需事务保障一致性；N 条 Schedule 记录共享相同的 Name/Type/TimeSlot，编辑时需判断是"只改当前孩子"还是"改所有孩子"；月视图中间一日期有多个孩子同日程时需正确聚合显示
  - Mitigation: 同一次创建产生的 N 条 Schedule 记录通过 `GroupKey`（GUID）关联——可快速定位"同一批创建"的记录，支持"编辑所有关联孩子"的批量操作

- **Alternatives Considered**:
  - 多对多 ScheduleChild 桥接表：概念更清晰但增加 JOIN 复杂度，checkin-module UNIQUE 约束需调整
  - 单 Schedule 记录 + ChildIds JSON 数组：违反第一范式，查询和打卡隔离困难
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-015: 虚拟实例模式 -- 不预生成 ScheduleInstance 表

- **Context**: 日程按周重复，每天需确定"某天有哪些日程实例"。checkin-module ADR-010 已选定虚拟实例模式（不建 ScheduleInstance 表，以 ScheduleId+Date 复合键直接关联 Checkin）。Schedule 模块需与之对齐。

- **Decision**: Schedule 模块**不预生成 ScheduleInstance 表**。日历查询时，后端根据 Schedule 的 TimeSlot 按日期范围按需计算虚拟实例（按 RepeatRule 展开）。实例状态由 Schedule + ScheduleDateExclusion（排除标记）+ Checkin（存在性）+ Cancellation（存在性）+ 时间窗口判定联合推导。

- **Consequences**:
  - Positive: 无实例预生成开销（无需每晚 job）、无实例同步问题（编辑日程后未来实例自动生效）、表结构简单、与 checkin-module 的 ADR-010 完全对齐
  - Negative: 月视图查询一个月内所有日程时需计算虚拟实例（SQL 需按日期范围展开 RepeatRule）；大量日程 + 大日期范围可能产生性能瓶颈（缓解：索引覆盖 + 端侧分页）
- **Alternatives Considered**:
  - 预生成 ScheduleInstance 表：每晚生成未来 N 天实例，查询简单但维护复杂（编辑日程需同步更新未来实例）
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-016: 时间槽存储 -- 7 条子记录（每星期几一条）

- **Context**: 需求定义时间槽为"7 天独立配置"（module-event.md §3.1），每天可能有不同的开始/结束时间或标记为"无安排"。需确定存储方式。

- **Decision**: 时间槽存储为 Schedule 的一对多子记录（TimeSlot 表），每条记录 = `(ScheduleId, DayOfWeek, StartTime, EndTime)`。仅存储有安排的天（`DayOfWeek` 值 0-6），不存储"无安排"的天。没有 TimeSlot 记录的天视为无日程。

- **Consequences**:
  - Positive: 一阶范式，查询可按 DayOfWeek 直接过滤；逐天微调无需特殊处理（Upsert 对应记录即可）；创建时的"快速填充"对应 INSERT N 条相同时间的时间槽
  - Negative: 编辑日程时需事务性更新多条记录（DELETE 旧 + INSERT 新）
- **Alternatives Considered**:
  - PostgreSQL JSONB 数组（`timeslots: [{day: 1, start: "16:00", end: "17:00"}]`）：存储单字段但查询需 JSON 函数、EF Core 支持有限
  - 位掩码 + 时间字段（如 7 位 bitmask 存储"哪天有安排"）：不能表达每天的差异化时间
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-017: Schedule 字段与 checkin-module 的契约对齐

- **Context**: checkin-module design 中预定义了 Schedule 骨架实体字段（ID、ScheduleType、StartTime、EndTime、DueDate、RepeatRule、FamilyId、AssignedChildId、IsDeleted），用于打卡窗口判定。Schedule 模块需与之保持契约对齐，避免实现阶段的字段断裂。

- **Decision**: Schedule 模块通过**接口适配**而非字段一一对应来对齐契约。checkin-module 定义 `IScheduleQueryService` 接口（依赖反转），Schedule 模块实现此接口。接口内部根据 Schedule + TimeSlot 子表动态解析 checkin-module 所需的信息：
  - `GetScheduleTypeAsync(scheduleId)` -> 返回 Schedule.ScheduleType
  - `GetTimeSlotAsync(scheduleId, date)` -> 根据 date 计算 dayOfWeek，查询 TimeSlot 返回 (startTime, endTime)；作业任务返回 (suggestedStartTime, suggestedEndTime) 或 null
  - `GetDueDateAsync(scheduleId)` -> 返回 Schedule.DueDate（仅作业任务）
  - `GetCancellationStatus(scheduleId, date)` -> 查询 Cancellation + ScheduleDateExclusion 表返回是否已取消/已排除
  - `IsScheduleExpiredAsync(scheduleId, date, serverTime)` -> 基于时间窗口规则判定（此方法实现在 checkin 模块中，它调用本接口获取 schedule 时间信息后再做判定）

  Schedule 实体字段无需与 checkin-module 骨架完全一致——接口隔离了内部存储结构。但以下字段名保持一致以减少认知负担：`Id`、`ScheduleType`、`FamilyId`、`AssignedChildId`、`IsDeleted`。

- **Consequences**:
  - Positive: 依赖反转——checkin 模块定义接口，Schedule 模块实现；StartTime/EndTime 放入 TimeSlot 子表的内部设计对 checkin 模块透明；checkin 模块可独立 Mock 测试
  - Negative: IScheduleQueryService 接口定义和实现分属两个模块目录；接口变更需同步两模块
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-018: 编辑范围（仅本次/全部）实现 -- 衍生 Schedule 模式

- **Context**: 需求 US-EVT-06/07 要求编辑分为"仅本次"（单实例修改）和"全部日程"（修改 Schedule 的 TimeSlot，仅影响未来实例）。"仅本次"编辑需要在不影响其他实例的情况下，针对单个日期做字段覆盖。

- **Decision**: 采用**衍生 Schedule 模式**——`EditScope=ThisOnly` 时：复制 Schedule 为单日实例（RepeatEndDate=null, 特定日期），并关联 `SourceScheduleId` 指向原 Schedule。`EditScope=ThisAndFuture` 时：修改 Schedule 的 TimeSlot（DELETE 旧 + INSERT 新），Upsert Schedule 字段；删除所有未来衍生 Schedule。本决策含**明确的二期迁移路径**：首期用衍生 Schedule，二期可迁移到 InstanceOverride 表。

- **Consequences**:
  - Positive: 实现简单，无需额外的覆盖表；与 cascading 删除/取消自然兼容；原 Schedule 的历史打卡记录不变
  - Negative: 多次"仅本次"编辑会产生多条衍生 Schedule 记录；需要 `SourceScheduleId` 关联回原 Schedule 用于追溯
- **Alternatives Considered**:
  - InstanceOverride 表：概念干净但需要额外的查询合并逻辑，首期复杂度高
  - 在 TimeSlot 表加 `OverrideDate` 字段：混淆了"时间配置"和"实例覆盖"两个概念
- **Status**: Accepted（首期采用衍生 Schedule 模式，二期可迁移到 InstanceOverride 表）
- **Date**: 2026-08-08

#### ADR-019: 日历数据分页策略 -- 按日期范围拉取

- **Context**: 月视图可能展示 500 条/月（requirement.md §8 性能指标），一次性加载全量不可取。需确定日历数据的分页和缓存策略。

- **Decision**: 日历数据按**日期范围 + 筛选条件**拉取，后端返回最小化数据集。前端缓存策略：月视图仅拉取当月 + 前后各一周（约 6 周范围），周视图拉取当前周 + 前后各一周，日视图拉取当前日。筛选条件变更时重新请求（前端不做二次过滤）。每次视图切换、日期跳转、筛选变更均触发增量请求。

- **Consequences**:
  - Positive: 数据量与视图粒度匹配，月视图数据量可控（约 6 周日期范围 + 筛选 = 每个孩子数十条 Schedule + 每天的虚拟实例展开）；前端无大数据缓存压力
  - Negative: 快速视图切换会产生多次 API 请求（通过 300ms 防抖降低）
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-020: "仅本次"删除 -- ScheduleDateExclusion 表

- **Context**: 需求 US-EVT-09 要求"仅本次"删除。此操作需要阻止当天产生实例但不影响 RepeatEndDate（否则"全部日程"编辑的理解会受影响——RepeatEndDate 已被人为缩短）。检查模块需要在查询时过滤已删除的日期。

- **Decision**: 创建 **ScheduleDateExclusion** 表（ScheduleId + ExcludedDate, UNIQUE 约束）存储"仅本次"删除的日期标记。日历查询时，在虚拟实例展开过程中跳过 ExcludedDate。此方案与 Cancellation 表设计模式一致。"撤销删除"操作等价于物理删除 Exclusion 记录。"本次及之后"删除仍使用修改 RepeatEndDate 方案（截断式，因为它本质上是终止重复，而非排除特定日期）。

- **Consequences**:
  - Positive: RepeatEndDate 不与删除操作耦合，语义清晰；与 Cancellation 表模式一致，开发者认知负担低；撤销简单（DELETE Exclusion 记录）
  - Negative: 新增一张表；日历查询时需要额外 JOIN/过滤 Exclusion；大量"仅本次"删除会产生大量 Exclusion 记录（缓解：Exclusion 仅配合 Schedule.RepeatEndDate 使用——当 RepeatEndDate 已完成或 Schedule 已删除时，关联的 Exclusion 可定期清理）
- **Alternatives Considered**:
  - 修改 RepeatEndDate：简单但副作用大——RepeatEndDate 含义被污染，"全部日程"编辑时需额外判断 RepeatEndDate 缩短是"故意的"还是"删除导致的"
  - 在 Schedule 上存储 ExcludedDates JSONB 数组：单字段但查询需 JSON 函数
- **Status**: Accepted
- **Date**: 2026-08-08

### 3.3 数据模型（ER 图）

#### 实体定义

**核心实体：Schedule**

```
+----------------------------------------------------------------------+
|                            Schedule                                      |
+----------------------------------------------------------------------+
|  Id              : Guid (PK)                                         |
|  Name            : string(50)       NOT NULL                         |
|  ScheduleType       : ScheduleType        NOT NULL                         |
|                  |   AfterSchoolActivity / DailyRoutine / HomeworkTask|
|  FamilyId        : Guid             NOT NULL, INDEXED (FK -> Family) |
|  AssignedChildId : Guid             NOT NULL, INDEXED (FK -> User)   |
|  CreatedBy       : Guid             NOT NULL (FK -> User)            |
|  GroupKey        : Guid             NOT NULL (多孩子创建的关联键)      |
|  RepeatEndDate   : DateOnly?        NULLABLE (null=无限重复)          |
|  Notes           : string(500)?     NULLABLE                         |
|  Location        : string(100)?     NULLABLE (仅课后活动)              |
|  DueDate         : DateOnly?        NULLABLE (仅作业任务)              |
|  SuggestedStartTime: TimeOnly?      NULLABLE (作业任务建议时间段)      |
|  SuggestedEndTime  : TimeOnly?      NULLABLE (作业任务建议时间段)      |
|  SourceScheduleId   : Guid?            NULLABLE (衍生自哪个原Schedule)       |
|  RowVersion      : byte[]           NOT NULL (乐观锁)                |
|  IsDeleted       : bool             NOT NULL, DEFAULT false          |
|  CreatedAt       : DateTimeOffset   NOT NULL                         |
|  UpdatedAt       : DateTimeOffset   NOT NULL                         |
+----------------------------------------------------------------------+
|  INDEX: (FamilyId)                                                   |
|  INDEX: (AssignedChildId)                                            |
|  INDEX: (FamilyId, AssignedChildId)  -- 按家庭+孩子查日程              |
|  INDEX: (GroupKey)                   -- 按批次查多孩子创建的记录       |
+----------------------------------------------------------------------+
```

**子实体：TimeSlot**

```
+----------------------------------------------------------------------+
|                           TimeSlot                                    |
+----------------------------------------------------------------------+
|  Id          : long (PK, auto-increment)                             |
|  ScheduleId     : Guid (FK -> Schedule)                                    |
|  DayOfWeek   : DayOfWeek enum (0=Sunday .. 6=Saturday)               |
|  StartTime   : TimeOnly           NOT NULL                           |
|  EndTime     : TimeOnly           NOT NULL                           |
+----------------------------------------------------------------------+
|  UNIQUE: (ScheduleId, DayOfWeek)  -- 一个日程每天最多一条时间槽           |
|  INDEX: (ScheduleId)                                                    |
+----------------------------------------------------------------------+

注意：
  - 仅课后活动和日常作息有 TimeSlot 记录
  - 作业任务的 Schedule 无关联 TimeSlot 记录
  - 不存储"无安排"的天（无记录 = 无安排）
```

**子实体：Cancellation**

```
+----------------------------------------------------------------------+
|                        Cancellation                                   |
+----------------------------------------------------------------------+
|  Id          : long (PK, auto-increment)                             |
|  ScheduleId     : Guid (FK -> Schedule)                                    |
|  CancelDate  : DateOnly        NOT NULL                              |
|  CancelledBy : Guid (FK -> User)                                     |
|  CancelledAt : DateTimeOffset  NOT NULL                              |
+----------------------------------------------------------------------+
|  UNIQUE: (ScheduleId, CancelDate)  -- 一个日程每天最多取消一次            |
|  INDEX: (ScheduleId)                                                    |
+----------------------------------------------------------------------+

用途：
  - 记录临时取消的日程实例（按日期）
  - 通过 IScheduleQueryService.GetCancellationStatus() 对外暴露取消状态
  - 恢复取消 = 物理删除此记录
```

**子实体：ScheduleDateExclusion**

```
+----------------------------------------------------------------------+
|                     ScheduleDateExclusion                                |
+----------------------------------------------------------------------+
|  Id            : long (PK, auto-increment)                           |
|  ScheduleId       : Guid (FK -> Schedule)                                  |
|  ExcludedDate  : DateOnly        NOT NULL                            |
|  ExcludedBy    : Guid (FK -> User)                                   |
|  CreatedAt     : DateTimeOffset  NOT NULL                            |
+----------------------------------------------------------------------+
|  UNIQUE: (ScheduleId, ExcludedDate)  -- 一个日程每天最多一条排除标记      |
|  INDEX: (ScheduleId)                                                    |
+----------------------------------------------------------------------+

用途：
  - 记录"仅本次"删除操作对特定日期的排除标记
  - 日历查询时在虚拟实例展开中跳过 ExcludedDate
  - 与 Cancellation 并列——取消（暂不参加）+ 排除（永久不参加）
  - 通过 IScheduleQueryService.IsDateExcluded() 对外暴露
  - 恢复删除 = 物理删除此记录（与 Cancellation 恢复模式一致）
```

#### ER 关系

```
+----------+         +---------------+
|   User   |         |     Schedule     |
|          |         |               |
|  Id (PK) |         |  Id (PK)      |
+----------+         |  Name         |
     |               |  ScheduleType    |
     | 1             |  FamilyId     |--FK
     |               |  AssignedChildId |--FK
     |               |  CreatedBy    |--FK
     |               |  GroupKey     |
     | N             |  RowVersion   |
     |               |  IsDeleted    |
     |               +---------------+
     |                      | 1
     |                      |
     |                      | N              +------------------+
     |                      |                | Family (后续模块) |
+----------+         +---------------+      +------------------+
| Checkin  |         |   TimeSlot    |
| (已有)   |         |               |
|          |         | Id (PK)       |
| ScheduleId  |--FK     | ScheduleId (FK)  |
| Date     |         | DayOfWeek     |
| UserId   |--FK     | StartTime     |
| ...      |         | EndTime       |
+----------+         +---------------+

+---------------+    +---------------+    +---------------------+
| Schedule         |    | Cancellation  |    | ScheduleDateExclusion  |
| Id (PK)       |    |               |    |                     |
+---------------+    | Id (PK)       |    | Id (PK)             |
      | 1            | ScheduleId (FK)  |    | ScheduleId (FK)        |
      |              | CancelDate    |    | ExcludedDate        |
      | N            | CancelledBy   |    | ExcludedBy          |
      |              | CancelledAt   |    | CreatedAt           |
      |              +---------------+    +---------------------+
      | 1 ---- 0..N ---- [ScheduleDateExclusion 排除标记]
      |                  "仅本次"删除产生 Exclusion 记录
      |
      | 1 ---- 0..N ---- (衍生Schedule, SourceScheduleId -> Schedule.Id)
      |                  (仅当"仅本次编辑"产生覆盖时使用)
      |
      v
  +---------------+
  | Schedule (衍生)   |
  | SourceScheduleId |
  | RepeatEndDate = null (单日)
  +---------------+
```

#### 关系基数推导

| 关系 | 基数 | 推导来源 |
|------|:----:|---------|
| Schedule -- TimeSlot | 1 : 0..7 | US-EVT-01: 一个日程最多 7 天时间槽（7 天独立配置）。作业任务 0 条。 |
| Schedule -- Cancellation | 1 : 0..N | US-EVT-12: 一个日程可被取消多次（不同日期）。每天最多一条（UNIQUE约束）。 |
| Schedule -- ScheduleDateExclusion | 1 : 0..N | US-EVT-09: 一个日程可按日期多次"仅本次"删除。每天最多一条（UNIQUE约束）。 |
| Schedule -- Schedule (SourceScheduleId) | 1 : 0..N | US-EVT-06: "仅本次"编辑产生衍生Schedule。每次编辑一条。 |
| Schedule -- Checkin | 1 : 0..N | checkin-module: 每个日程每天一条打卡记录。一个日程多个日期多条。 |
| Schedule.AssignedChildId -- User | N : 1 | ADR-014: 一个孩子可有多条Schedule记录。一条Schedule只属于一个孩子。 |
| Schedule.FamilyId -- Family | N : 1 | 数据隔离：一个家庭有多条Schedule。一条Schedule只属于一个家庭。 |
| Schedule.GroupKey -- Schedule (同批) | 1 : 1..N | ADR-014: 同一次多孩子创建产生 N 条 Schedule，通过 GroupKey 关联。 |

#### 级联规则

| 操作 | 规则 |
|------|------|
| 创建日程（多孩子） | 1 次事务中创建 N 条 Schedule + 各自的 TimeSlot，共享 GroupKey。N 次 INSERT 全成功或全回滚。 |
| 编辑"仅本次" | 创建衍生 Schedule（SourceScheduleId 指向原 Schedule，RepeatEndDate=null，覆盖字段）。**不影响原 Schedule**。 |
| 编辑"全部日程" | 更新原 Schedule 的 TimeSlot（DELETE 旧 + INSERT 新），Upsert Schedule 字段。删除所有未来衍生 Schedule。**历史打卡记录不变**。 |
| 删除"仅本次" | **插入 ScheduleDateExclusion 记录**（ScheduleId + ExcludedDate）。不修改 RepeatEndDate。历史打卡记录保留。 |
| 撤销"仅本次"删除 | **物理删除对应的 ScheduleDateExclusion 记录**。日历重新显示该日实例。 |
| 删除"本次及之后" | 更新原 Schedule 的 `RepeatEndDate` 为当前日前一天。**同时删除晚于该日的所有 ScheduleDateExclusion 记录**（已无意义）。历史打卡记录保留。 |
| 删除作业任务 | 软删除（Schedule.IsDeleted = true）。打卡记录保留（checkin-module 通过 IsDeleted 过滤）。 |
| 临时取消 | 插入 Cancellation 记录。**不删除 Checkin**。先打卡后取消的实例视作已完成（状态推导先行命中 Checkin）。 |
| 恢复取消 | 物理删除 Cancellation 记录。 |
| 孩子移出家庭 | 保留 Schedule 记录，AssignedChildId 不变。打卡记录标记"已离群"（checkin-module 负责）。前端打卡按钮不可用。 |
| 级联删除 Schedule（物理） | **不执行**。Schedule 使用软删除（IsDeleted）。Checkin 保留。关联的 ScheduleDateExclusion/Cancellation 保留用于历史追溯。 |

### 3.4 API 契约

所有 API 端点使用 URL 路径版本 `/api/v1/`（与 auth-module、checkin-module 一致）。

#### 端点清单

| 方法 | 路径 | 认证 | 说明 |
|------|------|:--:|------|
| POST | `/api/v1/schedules` | 是 | 创建日程（含多孩子展开） |
| GET | `/api/v1/schedules/{scheduleId}` | 是 | 获取日程详情（含实例状态） |
| PUT | `/api/v1/schedules/{scheduleId}` | 是 | 编辑日程（含编辑范围 scope） |
| DELETE | `/api/v1/schedules/{scheduleId}` | 是 | 删除日程（含删除范围 scope） |
| POST | `/api/v1/schedules/{scheduleId}/cancel` | 是 | 临时取消本次实例 |
| POST | `/api/v1/schedules/{scheduleId}/restore` | 是 | 恢复已取消/已删除实例 |
| GET | `/api/v1/calendar` | 是 | 日历视图数据查询（月/周/日） |
| POST | `/api/v1/schedules/check-conflict` | 是 | 冲突检测（可选，先调后调均可） |

#### 请求/响应形状

**创建日程：**
```
POST /api/v1/schedules

Request:
{
  "name": "钢琴课",
  "scheduleType": "AfterSchoolActivity",
  "childIds": ["guid1", "guid2"],
  "timeSlots": [
    { "dayOfWeek": 2, "startTime": "16:00", "endTime": "17:00" },
    { "dayOfWeek": 4, "startTime": "16:00", "endTime": "17:00" }
  ],
  "repeatEndDate": "2026-12-31",
  "location": "少年宫3楼钢琴教室",
  "notes": "记得带琴谱"
}

Response 201:
{
  "groupKey": "guid-batch",
  "schedules": [
    {
      "scheduleId": "guid-schedule-1",
      "assignedChildId": "guid1",
      "name": "钢琴课",
      "scheduleType": "AfterSchoolActivity",
      "timeSlots": [...],
      "repeatEndDate": "2026-12-31",
      "location": "少年宫3楼钢琴教室",
      "notes": "记得带琴谱",
      "createdAt": "2026-10-27T10:00:00+08:00"
    },
    { "scheduleId": "guid-schedule-2", "assignedChildId": "guid2", ... }
  ]
}

Errors: 400 (CHILD_NOT_SELECTED / SCHEDULE_NAME_EMPTY / SCHEDULE_NAME_TOO_LONG
            / TIME_SLOT_INVALID / NO_DAY_SELECTED / NOTES_TOO_LONG
            / DUE_DATE_INVALID / REPEAT_END_DATE_INVALID),
         401, 403 (NOT_FAMILY_MEMBER)
```

**获取日程详情：**
```
GET /api/v1/schedules/{scheduleId}?date=2026-10-27

Response 200:
{
  "scheduleId": "guid",
  "name": "钢琴课",
  "scheduleType": "AfterSchoolActivity",
  "date": "2026-10-27",
  "timeSlots": [
    { "dayOfWeek": 2, "startTime": "16:00", "endTime": "17:00" }
  ],
  "repeatEndDate": "2026-12-31",
  "repeatRule": "每周二、周四",
  "location": "少年宫3楼钢琴教室",
  "assignedChildId": "guid-child",
  "assignedChildName": "小明",
  "notes": "记得带琴谱",
  "instanceStatus": "incomplete",
  "isCancelled": false,
  "isExcluded": false,
  "checkinRecords": [
    {
      "childId": "guid-child",
      "childName": "小明",
      "status": "completed",
      "checkedInBy": "guid-parent",
      "checkedInAt": "2026-10-27T16:05:00+08:00"
    }
  ],
  "canEdit": true,
  "canCancel": true,
  "canDelete": true,
  "canCheckin": true,
  "canUndo": false,
  "rowVersion": "AAAAAAAB+EQ="
}

Errors: 401, 403, 404 (SCHEDULE_NOT_FOUND)
```

**编辑日程：**
```
PUT /api/v1/schedules/{scheduleId}

Request:
{
  "scope": "ThisOnly",
  "date": "2026-10-27",
  "name": "钢琴课补课",
  "timeSlots": [
    { "dayOfWeek": 2, "startTime": "17:00", "endTime": "18:00" }
  ],
  "location": "少年宫4楼",
  "notes": "补上周的课",
  "rowVersion": "AAAAAAAB+EQ="
}

Response 200:
{
  "scheduleId": "guid-original",
  "scope": "ThisOnly",
  "updated": true
}

Errors: 400 (SCHEDULE_NAME_EMPTY / CONCURRENT_EDIT_CONFLICT / CHILD_NOT_IN_FAMILY),
         401, 403, 404, 409 (CONCURRENT_EDIT_CONFLICT)
```

**删除日程：**
```
DELETE /api/v1/schedules/{scheduleId}?scope=ThisOnly&date=2026-10-27

Query params:
  scope: ThisOnly | ThisAndFuture (default: ThisOnly)
  date: 目标日期（ThisOnly 时必填）

Response 200 (ThisOnly):
{
  "deleted": true,
  "scope": "ThisOnly",
  "date": "2026-10-27",
  "method": "exclusion"
}

Response 200 (ThisAndFuture):
{
  "deleted": true,
  "scope": "ThisAndFuture",
  "date": "2026-10-27",
  "method": "truncate",
  "truncatedRepeatEndDate": "2026-10-26"
}

Errors: 400 (INVALID_SCOPE), 401, 403, 404
```

**临时取消：**
```
POST /api/v1/schedules/{scheduleId}/cancel
Request: { "date": "2026-10-27" }

Response 200:
{
  "scheduleId": "guid",
  "date": "2026-10-27",
  "cancelled": true,
  "cancelledAt": "2026-10-27T08:00:00+08:00"
}

Errors: 400 (SCHEDULE_ALREADY_CANCELLED / HOMEWORK_NO_CANCEL), 401, 403, 404
```

**恢复（取消或删除）：**
```
POST /api/v1/schedules/{scheduleId}/restore
Request: { "date": "2026-10-27" }

Response 200:
{
  "scheduleId": "guid",
  "date": "2026-10-27",
  "restored": true,
  "restoredFrom": "cancellation"  // or "exclusion"
}

Errors: 400 (NOT_CANCELLED_OR_EXCLUDED), 401, 403, 404
```

**冲突检测：**
```
POST /api/v1/schedules/check-conflict
Request:
{
  "childId": "guid-child",
  "date": "2026-10-27",
  "startTime": "16:00",
  "endTime": "17:00"
}

Response 200:
{
  "hasConflict": true,
  "conflicts": [
    { "scheduleId": "guid-existing", "name": "钢琴课",
      "startTime": "16:00", "endTime": "17:00" }
  ]
}

Errors: 400, 401
```

**日历视图查询：**
```
GET /api/v1/calendar?view=month&startDate=2026-10-01&endDate=2026-11-07
                    &childId=guid-child&scheduleTypes=AfterSchoolActivity,DailyRoutine

Query params:
  view       : month | week | day (必需)
  startDate  : 起始日期 (必需)
  endDate    : 截止日期 (必需)
  childId    : 按孩子筛选 (可选，不传=全部)
  scheduleTypes : 按类型筛选 (可选，逗号分隔，不传=全部)

Response 200: {
  "view": "month",
  "startDate": "2026-10-01",
  "endDate": "2026-11-07",
  "totalScheduleCount": 45,
  "dates": [
    {
      "date": "2026-10-27",
      "scheduleCount": 3,
      "dots": [
        { "scheduleType": "AfterSchoolActivity", "color": "blue" },
        { "scheduleType": "DailyRoutine", "color": "green" },
        { "scheduleType": "HomeworkTask", "color": "orange" }
      ],
      "schedules": [
        {
          "scheduleId": "guid-1",
          "name": "钢琴课",
          "scheduleType": "AfterSchoolActivity",
          "startTime": "16:00",
          "endTime": "17:00",
          "childName": "小明",
          "childAvatarUrl": "https://...",
          "status": "incomplete",
          "location": "少年宫3楼",
          "notes": "记得带琴谱"
        }
      ]
    }
  ]
}

注：schedule 详情按视图粒度不同：
  - month: 仅 dots 数组
  - week: schedules 含 name, startTime, endTime, childName, childAvatarUrl, status
  - day: schedules 含完整字段

Errors: 400 (INVALID_VIEW / DATE_RANGE_TOO_LARGE), 401
```

#### 错误码枚举

| HTTP Status | 错误码 | 说明 |
|:--:|------|------|
| 400 | `CHILD_NOT_SELECTED` | 未选择任何孩子 |
| 400 | `SCHEDULE_NAME_EMPTY` | 名称为空 |
| 400 | `SCHEDULE_NAME_TOO_LONG` | 名称超过 50 字符 |
| 400 | `TIME_SLOT_INVALID` | 开始时间晚于结束时间 |
| 400 | `NO_DAY_SELECTED` | 未选任何一天 |
| 400 | `NOTES_TOO_LONG` | 备注超过 500 字符 |
| 400 | `DUE_DATE_INVALID` | 截止日期早于今天 |
| 400 | `REPEAT_END_DATE_INVALID` | 重复结束日期早于今天 |
| 400 | `CHILD_NOT_IN_FAMILY` | 关联孩子已不在家庭中 |
| 400 | `SCHEDULE_ALREADY_CANCELLED` | 该日已取消 |
| 400 | `HOMEWORK_NO_CANCEL` | 作业任务不支持取消 |
| 400 | `NOT_CANCELLED_OR_EXCLUDED` | 该日未取消/未排除，无法恢复 |
| 400 | `INVALID_SCOPE` | 无效的编辑/删除范围 |
| 400 | `INVALID_VIEW` | 无效的视图类型 |
| 400 | `DATE_RANGE_TOO_LARGE` | 日期范围过大（> 90 天） |
| 401 | `TOKEN_INVALID` | JWT 无效/过期（auth-module 复用） |
| 403 | `NOT_FAMILY_MEMBER` | 当前用户不是该日程的家庭成员 |
| 403 | `CHILD_ACCESS_DENIED` | 孩子端试图执行家长操作 |
| 404 | `SCHEDULE_NOT_FOUND` | 日程不存在或已删除 |
| 409 | `SCHEDULE_CONFLICT` | 时间冲突（软提示，不阻止创建） |
| 409 | `CONCURRENT_EDIT_CONFLICT` | 并发编辑冲突，需刷新 |

#### 鉴权逻辑

| 接口 | 家长 | 孩子 |
|------|:--:|:--:|
| GET /schedules/{id} | 可查看所有关联孩子信息 | 仅看到自己信息 |
| POST /schedules | 可创建 | 不可创建 |
| PUT /schedules/{id} | 可编辑 | 不可编辑 |
| DELETE /schedules/{id} | 可删除 | 不可删除 |
| POST /schedules/{id}/cancel | 可取消 | 不可取消 |
| POST /schedules/{id}/restore | 可恢复 | 不可恢复 |
| GET /calendar | 按家庭隔离 | 按 familyId + 仅自己 |
| POST /schedules/check-conflict | 可调用 | 不适用 |

#### 安全约束

- 所有接口通过 `[Authorize]` + JWT Bearer 校验
- Schedule 查询按 `familyId` 隔离
- 编辑/删除操作：校验当前用户是家庭家长
- 乐观锁：PUT 请求携带 `rowVersion`
- 冲突检测在创建/编辑时均触发
- API 版本：所有端点统一使用 `/api/v1/`

### 3.5 前端架构

#### 页面路由与 TabBar

```json
{
  "pages": [
    "pages/index/index",
    "pages/schedule-detail/index",
    "pages/schedule-create/index",
    "pages/schedule-edit/index",
    "pages/mine/index",
    "pages/profile-edit/index",
    "pages/settings/index",
    "pages/deleted-recovery/index",
    "pages/privacy-prompt/index"
  ],
  "tabBar": {
    "list": [
      { "pagePath": "pages/index/index", "text": "日历" },
      { "pagePath": "pages/mine/index", "text": "我的" }
    ]
  }
}
```

| 页面 | 路由 | 类型 | 说明 |
|------|------|------|------|
| 日历首页 | `pages/index/index` | Tab | 月/周/日三视图 + 筛选栏。家长默认周视图，孩子默认日视图。 |
| 日程详情 | `pages/schedule-detail/index` | 普通 | 完整信息 + 操作按钮。接收 query: scheduleId + date。 |
| 创建日程 | `pages/schedule-create/index` | 普通 | 4 步：选孩子 -> 选类型 -> 填字段 -> 确认 |
| 编辑日程 | `pages/schedule-edit/index` | 普通 | 复用创建页 + 预填数据 + 分段开关 |

#### 组件树

```
App
├── pages/index/index                       # 日历首页
│   ├── filter-bar
│   │   ├── child-selector (单选 + "全部")   # 筛选场景单选，创建场景多选
│   │   └── type-selector (多选 + "全部")
│   ├── calendar-view
│   │   ├── month-view → month-cell (wx:for)
│   │   ├── week-view → schedule-card (wx:for)
│   │   └── day-view → schedule-card (wx:for)
│   ├── view-switcher [月 | 周 | 日]
│   └── date-navigator
│
├── pages/schedule-detail/index
│   ├── status-bar (已完成✓ / 未完成○ / 已取消 — / 已逾期 ✗)
│   ├── basic-info (日期/时间/地点/孩子/备注)
│   ├── repeat-info (仅重复日程)
│   ├── checkin-records (每个孩子的打卡状态)
│   └── action-bar
│       ├── checkin-btn (状态机驱动)
│       ├── edit-btn (仅家长)
│       ├── cancel-btn (仅家长，已取消→"恢复本次")
│       └── delete-btn (仅家长)
│
├── pages/schedule-create/index (4 步向导)
│   ├── step-child-select → child-selector (多选)
│   ├── step-type-select → type-selector (3 卡片)
│   ├── step-fill-fields (按类型动态表单)
│   └── step-confirm → preview-card
│
└── pages/schedule-edit/index
    ├── edit-scope-switch ("仅本次 / 全部日程")
    └── (复用 step-fill-fields)
```

#### 状态管理

微信小程序原生不支持 Pinia，采用**页面级 data + 全局变量 app.globalData** 模式：

```javascript
App({
  globalData: {
    calendarState: {
      currentView: 'week',
      currentDate: new Date(),
      selectedChildId: null,
      selectedScheduleTypes: [],
    },
    userRole: null,
    currentFamilyId: null
  }
})
```

#### 数据流

```
首页 onShow → 恢复 calendarState → GET /calendar → 渲染视图
点击卡片 → wx.navigateTo schedule-detail?scheduleId=xxx&date=xxx
  → GET /schedules/{id} + GET /checkin/window/{id}/{date}
  → 渲染详情 + 按钮状态

打卡/撤销 → checkin API → 刷新窗口 → 更新按钮
编辑 → PUT /schedules/{id} → 200 → wx.navigateBack + 刷新
删除 → DELETE /schedules/{id} → 200 → wx.navigateBack + 刷新
取消/恢复 → POST /schedules/{id}/cancel|restore → 刷新详情

创建 → 4 步向导 → POST /schedules → 冲突检测 → 201 → 跳转首页
```

#### 前端 data-id（关键元素）

| 页面 | 元素 | data-id |
|------|------|---------|
| `index` | 视图切换 [月/周/日] | `calendar-view-switch-month|week|day` |
| `index` | 筛选栏 | `calendar-filter-child`, `calendar-filter-type` |
| `index` | 今天按钮 | `calendar-today-btn` |
| `index` | 日期导航 | `calendar-date-next`, `calendar-date-prev` |
| `index` | 月视图日期格 | `calendar-month-cell-{{date}}` |
| `index` | 日程卡片 | `calendar-schedule-card-{{scheduleId}}` |
| `index` | 快捷打卡 | `calendar-schedule-card-checkin-btn-{{scheduleId}}` |
| `schedule-create` | 类型卡片 | `schedule-create-type-afterschool|daily|homework` |
| `schedule-create` | 名称输入 | `schedule-create-name-input` |
| `schedule-create` | 时间槽 | `schedule-create-timeslot-quick`, `schedule-create-timeslot-tune-{{day}}` |
| `schedule-create` | 创建按钮 | `schedule-create-submit-btn` |
| `schedule-create` | 冲突弹窗 | `schedule-create-conflict-dialog` |
| `schedule-edit` | 范围开关 | `schedule-edit-scope-this-only`, `schedule-edit-scope-all` |
| `schedule-detail` | 打卡按钮 | `schedule-detail-checkin-btn` |
| `schedule-detail` | 撤销打卡 | `schedule-detail-undo-btn` |
| `schedule-detail` | 编辑/删除/取消/恢复 | `schedule-detail-edit-btn|delete-btn|cancel-btn|restore-btn` |
| `schedule-detail` | 删除确认弹窗 | `schedule-detail-delete-dialog` |

### 3.6 核心时序图

#### 时序 1: 创建日程正常流程（多孩子）

```
家长              小程序前端                        Backend API                   DB
 |                   |                                |                          |
 |  Step 1-3 本地步骤  |                                |                          |
 |  Step 4 确认      |                                |                          |
 |------------------>|                                |                          |
 |                   |-- POST /schedules {childIds:[a,b]}|                          |
 |                   |------------------------------->|                          |
 |                   |                                |-- BEGIN TRANSACTION      |
 |                   |                                |-- Validate inputs        |
 |                   |                                |-- Check conflicts (soft) |
 |                   |                                |-- INSERT Schedule A (child a)|
 |                   |                                |-- INSERT TimeSlots (A)   |
 |                   |                                |-- INSERT Schedule B (child b)|
 |                   |                                |-- INSERT TimeSlots (B)   |
 |                   |                                |-- COMMIT                 |
 |                   |  <-- 201 {schedules:[...]}       |                          |
 |                   |-- wx.redirectTo 首页            |                          |
```

#### 时序 2: 冲突检测（软提示不阻止）

```
小程序前端                        Backend API
 |                                |
 |-- POST /schedules {...}           |
 |------------------------------->|
 |                                |-- 检测同孩子同时段重叠
 |                                |-- 发现冲突 → 返回 409
 |  <-- 409 {hasConflict:true}    |
 |-- 弹窗"是否继续创建？"          |
 |  用户选择"继续"                 |
 |-- POST /schedules {ignoreConflict: true}
 |------------------------------->|
 |  <-- 201 创建成功              |
```

#### 时序 3: 编辑"仅本次"（衍生 Schedule）

```
家长              小程序前端                        Backend API
 |                   |                                |
 |  点击"保存"        |                                |
 |------------------>|                                |
 |                   |-- PUT /schedules/{id}             |
 |                   |   {scope:ThisOnly, date,        |
 |                   |    name:"钢琴课补课"}            |
 |                   |------------------------------->|
 |                   |                                |-- Verify rowVersion
 |                   |                                |-- Create derivative Schedule
 |                   |                                |   (SourceScheduleId=origId,
 |                   |                                |    RepeatEndDate=null)
 |                   |  <-- 200 {updated:true}        |
 |                   |-- wx.navigateBack + 刷新        |
```

#### 时序 4: 编辑"全部日程"（并发冲突）

```
家长A             小程序前端A          Backend API
 |                   |                    |
 |  编辑"全部日程"    |                    |
 |------------------>|                    |
 |                   |-- PUT (scope=ThisAndFuture, rowVersion=v1)
 |                   |------------------->|
 |                   |                    |-- UPDATE WHERE RowVersion=v1
 |                   |                    |-- 匹配 → 更新, RowVersion→v2
 |                   |  <-- 200 OK       |

家长B (同时操作)    小程序前端B
 |------------------>|
 |                   |-- PUT (scope=ThisAndFuture, rowVersion=v1) ← 过期
 |                   |------------------->|
 |                   |                    |-- 0 rows affected → 冲突
 |                   |  <-- 409 CONCURRENT_EDIT_CONFLICT
 |                   |-- 弹窗"已被其他用户修改，请刷新"|
```

#### 时序 5: 日历查询（月视图 + ExcludedDate 过滤）

```
小程序前端                        Backend API
 |                                |
 |-- GET /calendar                |
 |   ?view=month                  |
 |   &startDate=2026-10-01        |
 |   &endDate=2026-11-07          |
 |------------------------------->|
 |                                |-- 校验 familyId
 |                                |-- 查询 Schedule (WHERE FamilyId, IsDeleted=false)
 |                                |-- 按 RepeatRule 在日期范围展开虚拟实例
 |                                |-- JOIN ScheduleDateExclusion: 排除 excluded 日期
 |                                |-- JOIN Checkin: 获取打卡状态
 |                                |-- JOIN Cancellation: 获取取消状态
 |                                |-- 合并 → 实例状态推导
 |                                |-- 按日期分组 → dots/schedules
 |  <-- 200 {dates:[...]}        |
 |-- 渲染月视图网格 + 色点         |
```

#### 时序 6: 日程详情 + 打卡协同

```
小程序前端                 Backend API              Checkin Module
 |                         |                        |
 |-- GET /schedules/{id}?date |                        |
 |------------------------>|                        |
 |                         |-- Query Schedule + TS    |
 |                         |-- Query Checkin       |
 |                         |-- Query Cancellation   |
 |                         |-- Query Exclusion     |
 |  <-- 200 {详情 + 状态}  |                        |
 |                         |                        |
 |-- GET /checkin/window/  |                        |
 |   {scheduleId}/{date}      |                        |
 |------------------------------------------------->|
 |                         |  checkin-module:       |
 |                         |  → IScheduleQueryService  |  ← 接口由 checkin 定义
 |                         |    .GetScheduleAsync()    |     Schedule 模块实现
 |                         |    .GetTimeSlotAsync() |
 |                         |  → 时间窗口判定        |
 |  <-- {canCheckin, ...} |                        |
 |-- 渲染按钮状态           |                        |
```

#### 时序 7: "仅本次"删除与恢复（ScheduleDateExclusion）

```
家长              小程序前端                        Backend API
 |                   |                                |
 |  点击"删除"        |                                |
 |  选择"仅本次"      |                                |
 |------------------>|                                |
 |                   |-- DELETE /schedules/{id}           |
 |                   |   ?scope=ThisOnly&date=...      |
 |                   |------------------------------->|
 |                   |                                |-- INSERT ScheduleDateExclusion
 |                   |                                |   (ScheduleId, ExcludedDate)
 |                   |  <-- 200 {deleted:true,        |
 |                   |           method:"exclusion"}   |
 |                   |-- wx.navigateBack + 刷新        |
 |                                                    |
 |  (后续：用户想撤销删除)                               |
 |  在详情页点击"恢复"  |                                |
 |------------------>|                                |
 |                   |-- POST /schedules/{id}/restore    |
 |                   |   {date:"2026-10-27"}          |
 |                   |------------------------------->|
 |                   |                                |-- DELETE ScheduleDateExclusion
 |                   |                                |   WHERE ScheduleId+Date
 |                   |  <-- 200 {restored:true}       |
 |                   |-- 刷新 → 日程恢复正常显示        |
```

### 3.7 构建序列与模块依赖

```
认证模块 (Auth) ──────────────┐
                              ├──> Schedule 模块 ──> 实现 IScheduleQueryService (checkin 定义的接口)
家庭模块 (Family) ────────────┘         │
                                        │
                              Checkin 模块 ← 通过 IScheduleQueryService 获取 Schedule 信息
                              (接口由 checkin 定义，Schedule 实现；依赖反转)
```

**构建顺序**：
1. Auth 模块（JWT 中间件、User 实体、异常中间件）——已完成设计
2. Schedule 模块基础（Schedule + TimeSlot + Cancellation + ScheduleDateExclusion 实体、迁移、基础 CRUD）——本设计
3. IScheduleQueryService 接口——由 checkin-module 定义（放在 `api/Checkin/` 或 `api/Domain/Interfaces/`），Schedule 模块实现
4. Checkin 模块（打卡记录、窗口判定、结算任务）——已有设计，通过 Mock IScheduleQueryService 与 Schedule 模块并行开发
5. 日历视图 API + 前端——依赖 Schedule 基础 CRUD 完成
6. 编辑/删除/取消操作——依赖基础 CRUD + checkin 模块窗口判定

---

## Risks / Trade-offs

### 风险清单

| # | 风险 | 影响 | 可能性 | 缓解措施 |
|---|------|------|:--:|---------|
| R1 | 多孩子展开模型导致 Schedule 记录膨胀（N x M） | 中 | 中 | GroupKey 索引定位；10 人 x 20 日程 = 200 条，远未达瓶颈 |
| R2 | 虚拟实例展开月视图性能（500 条/月） | 中 | 低 | 单次 500 条 x JOIN 在 50ms 内；索引覆盖；可加 Redis 缓存 |
| R3 | "仅本次"编辑产生衍生 Schedule 记录累积 | 低 | 低 | 每次 1 条衍生记录；操作频率低；二期可迁移 InstanceOverride |
| R4 | checkin UNIQUE(scheduleId, date) 与多孩子模型 | 高 | 已解决 | ADR-014 展开模型，无需调整约束 |
| R5 | Schedule Type 变更时 checkin 语义需同步 | 低 | 低 | 编辑字段 → 更新 ScheduleType；checkin 下次窗口查询感知新类型 |
| R6 | 筛选条件跨视图一致性 | 低 | 低 | app.globalData 存储；筛选变更即时 API 重新请求 |
| R7 | 孩子端 vs 家长端权限控制在前端 | 中 | 低 | 前端 UI 隐藏 + 后端 API 校验双重防护 |
| R8 | 乐观锁（RowVersion）在批量编辑多孩子时的复杂交互 | 中 | 低 | 事务 + 逐条乐观锁；任一条冲突全部回滚 |
| R9 | checkin-module 开发时 Schedule 实体未就绪 | 高 | 中 | Mock IScheduleQueryService 可独立开发 |
| R10 | ScheduleDateExclusion 记录累积（大量"仅本次"删除） | 低 | 低 | 当 Schedule 被整体删除或 RepeatEndDate 过期后，可定期清理关联 Exclusion |

### 已知权衡

| 权衡 | 选择 | 代价 |
|------|------|------|
| 多孩子展开 vs ScheduleChild 桥接表 | 展开模型 | 编辑多孩子需事务遍历 N 条 |
| 虚拟实例 vs 预生成表 | 虚拟实例 | 查询需按 RepeatRule 展开 + JOIN |
| "仅本次"编辑 = 衍生 Schedule vs InstanceOverride | 衍生 Schedule（首期） | 多次编辑产生多条衍生记录 |
| "仅本次"删除 = ScheduleDateExclusion vs 修改 RepeatEndDate | ScheduleDateExclusion 表 | 多一张表；RepeatEndDate 语义保持干净 |
| 日历范围查询 vs 全量缓存 | 按日期范围分页 | 快速切换时多次请求（300ms 防抖缓解） |
| IScheduleQueryService 由 checkin 定义 vs Schedule 定义 | checkin 定义（依赖反转） | Schedule 模块实现 checkin 的接口 |

---

## Handoff to dev-planning

### 模块到 Story/Task 映射建议

| Story | 后端 Task | 前端 Task | 集成 Task |
|-------|----------|----------|----------|
| **EVT-ST-01** | Schedule + TimeSlot 实体、POST /schedules、冲突检测、Validators、EF 迁移 | 创建页 4 步向导、各子组件 | 创建全流程联调 |
| **EVT-ST-02** | GET /calendar（三视图聚合）、实例展开+Exclusion 过滤 | calendar-view/month/week/day/filter-bar 组件 | 日历数据联调 |
| **EVT-ST-03** | 编辑/删除/取消/恢复 API、衍生 Schedule、ScheduleDateExclusion、乐观锁 | schedule-detail 详情页、edit-scope-switch、删除弹窗 | 全操作联调 |
| **跨模块** | IScheduleQueryService 实现（checkin 接口定义 -> Schedule 实现） | schedule-detail 打卡按钮状态机 | Schedule+Checkin 联调 |

### 集成 Task 时机

1. Schedule 实体 + 基础 CRUD 完成 → checkin-module 可 Mock IScheduleQueryService 并行开发
2. IScheduleQueryService 实现完成 → checkin-module 切真实接口联调
3. 日历 API 完成 → 前端日历视图独立开发
4. 编辑/删除/取消 API 完成 → 前端详情页操作独立开发
5. 全部 API 就绪 → Schedule + Checkin 全流程集成测试

### 前置依赖

- **MUST 完成**：auth-module（JWT 中间件、User 实体、异常中间件）
- **MUST 完成**：Family 模块最小化骨架（Family 表 + FamilyMember 表 + familyId 查询）
- **推荐**：checkin-module 定义 IScheduleQueryService 接口（Schedule 模块实现）——可并行
- .NET 10 SDK、PostgreSQL、微信小程序开发者工具

### 后端实现注意事项

- 所有异步 Service 方法 MUST 含 `CancellationToken ct = default` 参数并传给下游调用（dev-dotnet-standards）
- ScheduleType 枚举：checkin-module 已在 `Domain/Enums/ScheduleType.cs` 定义，Schedule 模块直接引用，不重复定义
- FluentValidation 校验器集中放在 `api/Schedule/Validators/` 下
- EF Core 迁移通过 `dotnet ef migrations add` 生成，纳入 git 版本控制

### API 接口汇总

| 方法 | 路径 | 用途 | 首期状态 |
|------|------|------|:--:|
| POST | `/api/v1/schedules` | 创建日程（多孩子展开） | 实现 |
| GET | `/api/v1/schedules/{scheduleId}` | 获取日程详情 | 实现 |
| PUT | `/api/v1/schedules/{scheduleId}` | 编辑日程 | 实现 |
| DELETE | `/api/v1/schedules/{scheduleId}` | 删除日程 | 实现 |
| POST | `/api/v1/schedules/{scheduleId}/cancel` | 取消本次 | 实现 |
| POST | `/api/v1/schedules/{scheduleId}/restore` | 恢复（取消或删除） | 实现 |
| GET | `/api/v1/calendar` | 日历视图查询 | 实现 |
| POST | `/api/v1/schedules/check-conflict` | 冲突检测 | 实现 |

---

## Open Questions

| # | 问题 | 当前状态 | 建议 |
|---|------|---------|------|
| 1 | Family 模块 familyId 查询 API 由谁先提供？ | Schedule 模块需要 familyId 隔离 | Family 模块提供最小化骨架或 Schedule 用 Mock |
| 2 | 衍生 Schedule 是否需在 UI 标注来源？ | US-EVT-06 | SourceScheduleId 后端追溯；UI 卡片名称区分即可 |
| 3 | ~~"仅本次"删除方案~~ | **CLOSED** | 决策：ScheduleDateExclusion 表（ADR-020）。RepeatEndDate 不耦合。 |
| 4 | Schedule 模块是否需要"收藏/常用"？ | 未提及 | 首期不做 |
