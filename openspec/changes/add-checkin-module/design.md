# Design: 打卡与统计模块

> Change: `add-checkin-module` | Schema: spec-driven | Date: 2026-08-08

---

## Context

### 背景

打卡与统计模块是日程管理模块的下游模块。日程管理模块已定义了打卡按钮交互（`module-event.md` 第 8.4、10 节）和 4 种视觉状态（已完成/未完成/已取消/已逾期），但打卡的时间边界规则（提前窗口、三种类型的差异化逾期判定、终态不可逆）、撤销打卡时序规则、每日自动结算机制尚未实现。

本设计聚焦首期 Story CHK-ST-01 范围（Must 优先级，3 个工作日）：

| US | 内容 | 说明 |
|----|------|------|
| CHK-01 | 提前打卡窗口 | 开始前 30 分钟可打卡 |
| CHK-02 | 课后活动逾期判定 | 结束时间 + 2h 后不可打卡 |
| CHK-03 | 日常作息逾期判定 | 当天 24:00 结算后终态 |
| CHK-04 | 作业任务逾期判定 | 截止日期 24:00 结算后终态 |
| CHK-05 | 逾期后不可补打卡 | 终态不显示打卡按钮 |
| CHK-06 | 跨天打卡以服务器时间为准 | 服务器时间为判定依据 |
| CHK-26 | 每日结算任务 | 凌晨 00:05，幂等，并发安全 |
| CHK-27 | 撤销打卡与时序规则 | 结算前可撤销，终态不可撤销 |

### 当前状态

- **后端**：`api/` 已有 .NET 10 Web API（单项目，Schedule + Auth + Family 模块全流程落地），含 EF Core Migration（`api/Migrations/`）。Schedule 模块已含 `Schedule`/`TimeSlot`/`Cancellation`/`ScheduleDateExclusion` 实体与 CRUD/日历查询 API。
- **前端**：`app/` 已有微信小程序原生代码（9 页面 + 12 组件 + 5 Service），日程管理 + 认证页面就绪。`schedule-detail` 页面已含打卡按钮/倒计时/撤销按钮的 data-id 与交互代码，`services/checkin.js` 已有打卡 API 封装 stub。
- **数据库**：PostgreSQL，单数据库模式（`AppDbContext` 已含 Users/Families/FamilyMembers/Schedules/TimeSlots/Cancellations/ScheduleDateExclusions 七个 DbSet）
- **需求**：staging 目录 `production/staging/2026-08-08-打卡/` 状态为 `dev-ready`

### 现状对账清单

> 依据 `.claude/rules/dev-codegraph.md`：设计前 MUST 用 codegraph 探查已有代码，逐项标注本次变更是复用 / 扩展 / 新建。以下清单基于 `api/` / `app/` 真实现状（2026-08-16 探查）。

#### 后端 `api/`

| 已有资产 | 真实结构（探查） | 本模块处置 |
|---------|----------------|-----------|
| `Schedule` 实体 | `api/Domain/Entities/Schedule.cs`：Id(Guid)/Name/ScheduleType/FamilyId/AssignedChildId/CreatedBy/GroupKey/RepeatEndDate/Notes/Location/DueDate/SuggestedStartTime/SuggestedEndTime/SourceScheduleId/OverrideDate/RowVersion(byte[])/IsDeleted/CreatedAt/UpdatedAt；导航 TimeSlots/Cancellations/DateExclusions/SourceSchedule/DerivativeSchedules | **复用**：Checkin.ScheduleId 弱引用 Id(Guid)，打卡窗口经 TimeSlots + ScheduleType + DueDate 计算 |
| `TimeSlot` 实体 | `api/Domain/Entities/TimeSlot.cs`：ScheduleId/DayOfWeek/StartTime(TimeOnly)/EndTime(TimeOnly)，UNIQUE(ScheduleId, DayOfWeek) | **复用**：课后活动/日常作息当天起止时间来源（按 date.DayOfWeek 匹配） |
| `Cancellation` 实体 | `api/Domain/Entities/Cancellation.cs`：Id(long)/ScheduleId(Guid)/CancelDate/CancelledBy/CancelledAt，UNIQUE(ScheduleId, CancelDate) | **复用**：实例"已取消"判定 |
| `ScheduleDateExclusion` 实体 | `api/Domain/Entities/ScheduleDateExclusion.cs`：ScheduleId/ExcludedDate/ExcludedBy/CreatedAt，UNIQUE(ScheduleId, ExcludedDate) | **复用**：实例"已排除"判定。打卡窗口将 excluded 与 cancelled **合并**（同等对待，统一返回 `cancelled`，不单独暴露 `excluded` 状态值，见 §3 状态推导 step 2） |
| `User` 实体 | `api/Domain/Entities/User.cs`：Id(Guid)/OpenId/Nickname/AvatarUrl/Role/Status/CreatedAt/LastLoginAt/DeletedAt | **复用**：Checkin.UserId 弱引用 Id(Guid) |
| `Family` / `FamilyMember` 实体 | `api/Domain/Entities/Family.cs`（Id/Name/CreatedAt）、`FamilyMember.cs`（FamilyId/UserId/Role/JoinedAt） | **复用**：家庭隔离与成员校验 |
| `AppDbContext` | `api/Infrastructure/Data/AppDbContext.cs`：已含 7 个 DbSet（Users/Families/FamilyMembers/Schedules/TimeSlots/Cancellations/ScheduleDateExclusions） | **扩展**：新增 `Checkin` DbSet + `CheckinConfiguration` |
| `ScheduleType` 枚举 | `api/Domain/Enums/ScheduleType.cs`：AfterSchoolActivity=1/DailyRoutine=2/HomeworkTask=3 | **复用**（替代旧术语 `EventType`） |
| `ScheduleStatus` 枚举 | `api/Domain/Enums/ScheduleStatus.cs`：Incomplete=1/Completed=2/Cancelled=3/Ended=4/Overdue=5 | **复用**：作为 `CheckinSettlement.Status` 字段类型（结算只写 Ended/Overdue/Incomplete 三种终态） |
| `UserRole`/`UserStatus`/`EditScope` 枚举 | `api/Domain/Enums/`：Parent=1/Child=2、Active=0/Deleted=1、ThisOnly=1/ThisAndFuture=2 | **复用**（UserRole 用于 Child 权限校验） |
| `ScheduleService`/`IScheduleService` | `api/Schedule/Services/`：GetByIdAsync 已返回 CanCheckin/CanUndo/InstanceStatus/IsCancelled/IsExcluded | **复用**：打卡窗口判定可复用其状态推导 |
| `CalendarQueryService`/`ScheduleStatusHelper` | `api/Schedule/Services/`：已实现虚拟实例展开 + `DeriveInstanceStatus`（返回 excluded/cancelled/overdue/ended/incomplete 字符串） | **参考（非对齐）**：`DeriveInstanceStatus` 的 `ended`/`overdue` 来自 `RepeatEndDate`/`DueDate`，是重复期/截止期语义，**不含** checkin 的「课后活动 endTime+2h 即时逾期」规则；CheckinService 自带 endTime+2h 即时判定，此 helper 仅作参考 |
| `IFamilyContextService` | `api/Schedule/Services/`：GetFamilyContextAsync 返回 (FamilyId, Role)，非成员抛 NOT_FAMILY_MEMBER | **复用**：CheckinService 注入此接口做家庭隔离 |
| `ErrorCodes`/`ExceptionHandlingMiddleware` | `api/Infrastructure/`：TOKEN_INVALID(401) 等 auth 错误码 + 全局异常中间件 | **复用**：鉴权错误码走 auth 契约 |
| `IScheduleQueryService` + `ScheduleQueryService` | `api/Domain/Interfaces/IScheduleQueryService.cs`（接口，注释「供 checkin-module 调用」+「ADR-017 依赖反转」）+ `api/Schedule/Services/ScheduleQueryService.cs`（实现）。5 个方法 `GetScheduleAsync`/`GetTimeSlotAsync`/`GetCancellationStatusAsync`/`IsDateExcludedAsync`/`GetDueDateAsync` 恰好覆盖打卡窗口判定（类型/时间槽/取消/排除/截止日） | **复用**：CheckinService 注入 `IScheduleQueryService`（DI 注册 `ScheduleQueryService` 为实现），无需新建接口或 Mock |

#### 前端 `app/`

| 已有资产 | 真实结构（探查） | 本模块处置 |
|---------|----------------|-----------|
| `pages/schedule-detail/` | 4 文件（index.js/wxml/wxss/json），已含 data-id：`schedule-detail-checkin-btn`/`schedule-detail-checkin-btn-disabled`/`schedule-detail-undo-btn`/`schedule-detail-checkin-record-{childId}`，已实现倒计时 + getWindow/checkin/undo 调用 | **扩展**：对接打卡窗口/结算终态判定，补齐 4 种状态 |
| `services/checkin.js` | 已存在 stub：getWindow/checkin/undo/getRecords（方法名统一保留此名，见裁决 #2；undo 路径改为 `DELETE /api/v1/checkin/{scheduleId}/{date}`） | **扩展**：对齐契约与真实端点路径 |
| `services/api.js` | 统一请求封装（401 拦截续期） | **复用** |
| `contracts/auth.js` | auth 枚举/错误码/DTO 镜像 | **复用**（错误码、HTTP 状态引用） |

#### 契约 `openspec/contracts/`

| 已有资产 | 真实结构（探查） | 本模块处置 |
|---------|----------------|-----------|
| `contracts/auth/`（enums/errors/dto） | 已存在，TOKEN_INVALID(401) 等 | **复用**：鉴权错误码 |
| `contracts/checkin/`（enums/errors/dto） | 不存在 | **新建**：本模块产出 CheckinSource 枚举、打卡错误码、DTO |

### 约束

| 约束 | 来源 |
|------|------|
| 平台：微信小程序（基础库 >= 2.10.0），iOS 12+ / Android 8.0+ | CLAUDE.md |
| 后端：.NET 10，EF Core，PostgreSQL，单项目 | auth-module design ADR-001/002/004 |
| 前端：微信小程序原生 | auth-module design ADR-005 |
| 认证方式：JWT Bearer，所有 API 需登录态 | auth-module design |
| 打卡时间判定以服务器时间为准 | requirement.md US-CHK-06 |
| 多端同时打卡幂等处理 | requirement.md BE-05 |
| 结算任务幂等性 | requirement.md US-CHK-26 |
| 结算任务执行 <= 5 分钟 | requirement.md 第 8 节 |
| 打卡响应 <= 1s | CLAUDE.md |
| 数据按家庭隔离 | index.md 第 8.3 节 |

---

## Goals / Non-Goals

### Goals

1. 实现三种日程类型的打卡时间窗口判定（提前 30 分钟 / 课后活动 +2h 缓冲 / 日常作息当天 24:00 / 作业任务截止当天 24:00）
2. 实现撤销打卡时序规则（结算前可撤 / 终态不可撤 / 竞态保护）
3. 实现每日结算定时任务（凌晨 00:05，写库终态 transition + 连续天数持久化，幂等，失败重试，并发安全）
4. 建立 Checkin 数据实体与 API（创建打卡 / 查询打卡窗口 / 撤销打卡）
5. 增强日程详情页前端打卡按钮逻辑（倒计时 / 灰显不可点击 / 不显示）

### Non-Goals

- 连续完成统计（CHK-07~10，二期）
- 完成率统计（CHK-11~14，二期）
- 家长端数据看板（CHK-15~18，二期）
- 孩子端我的统计（CHK-19~21，二期）
- 订阅消息提醒（CHK-22~25，二期）
- 成就徽章（二期/三期）
- 事件实例预生成（首期采用虚拟实例模式，按需计算）

---

## Decisions

### 1. 项目结构与限界上下文划分

#### 整体划分（扩展现有 auth-module 设计）

```
agenda/
├── api/                                    # .NET 10 Web API（单项目）
│   ├── Auth/                               # 认证模块（已有设计）
│   ├── Checkin/                            # 打卡模块（NEW）
│   │   ├── CheckinController.cs
│   │   ├── CheckinService.cs
│   │   ├── ICheckinService.cs
│   │   ├── Dtos/
│   │   │   ├── CheckinStatusResponse.cs
│   │   │   ├── CheckinRequest.cs
│   │   │   ├── CheckinResponse.cs
│   │   │   └── UndoCheckinResponse.cs
│   │   └── Validators/
│   │       └── CheckinRequestValidator.cs
│   ├── Domain/                             # 共享领域实体
│   │   ├── Entities/
│   │   │   ├── User.cs                     # 已有
│   │   │   ├── Checkin.cs                  # NEW（映射表 CheckinRecords）
│   │   │   ├── CheckinSettlement.cs        # NEW（结算终态锚点）
│   │   │   ├── Streak.cs                   # NEW（连续完成天数）
│   │   │   └── Schedule.cs                 # 已有（Schedule 模块已落地，Checkin 通过 ID 引用）
│   │   ├── Interfaces/
│   │   │   └── IScheduleQueryService.cs    # 已有（供 checkin 消费，ADR-017）
│   │   └── Enums/
│   │       ├── UserStatus.cs               # 已有
│   │       ├── ScheduleType.cs             # 已有（复用，替代旧 EventType）
│   │       ├── ScheduleStatus.cs           # 已有（复用为结算记录 Status）
│   │       ├── CheckinSource.cs            # NEW（Parent / Child）
│   │       └── StreakScope.cs              # NEW（Schedule / Child）
│   ├── Infrastructure/
│   │   ├── Data/
│   │   │   ├── AppDbContext.cs             # 扩展：新增 Checkin DbSet
│   │   │   └── Configurations/
│   │   │       └── CheckinConfiguration.cs # NEW
│   │   ├── Jobs/
│   │   │   └── SettlementJob.cs            # NEW 结算任务（Hangfire 调度）
│   │   ├── Hangfire/
│   │   │   └── HangfireConfiguration.cs    # NEW Hangfire 配置（存储、Dashboard、Cron 注册）
│   │   └── Middleware/
│   │       └── ExceptionHandlingMiddleware.cs  # 已有
│   └── Migrations/                         # EF Core 迁移
├── app/                                    # 微信小程序原生
│   ├── services/
│   │   └── checkin.js                      # NEW 打卡 API 封装
│   └── pages/
│       └── schedule-detail/                # 增强：打卡按钮时间窗口逻辑（页面已存在）
│           └── index.js                    # 增强：倒计时、按钮状态切换
└── openspec/
```

#### 限界上下文

| 上下文 | 聚合根 | 模块目录 | 本模块关系 |
|--------|--------|---------|-----------|
| Auth（认证） | User | `api/Auth/` | 提供 userId（JWT 中解析） |
| Schedule（日程） | Schedule | 已有模块 | 提供 scheduleId + scheduleType + timeSlots(startTime/endTime) + dueDate，本模块通过 ID 弱引用 |
| **Checkin（打卡）** | **Checkin** | `api/Checkin/` | **本模块新建** |
| Family（家庭） | Family | 已有模块 | 数据隔离（familyId 来自 Schedule） |

**跨上下文交互规则**：
- Checkin 通过 `scheduleId` + `date` 引用 Schedule，不直接持有 Schedule 实体引用
- Checkin 通过 JWT 中解析的 `userId` 识别当前用户
- 打卡时间窗口判定需查询 Schedule 的类型/时间信息——复用 Schedule 模块既有 `IScheduleQueryService`/`ScheduleQueryService`（5 个方法覆盖类型/时间槽/取消/排除/截止日），并参考 `ScheduleResponse` 已预置的 `CanCheckin`/`CanUndo`/`InstanceStatus`/`IsCancelled`/`IsExcluded`/`CheckinRecords` 字段做状态推导
- 数据隔离：Checkin 查询时，通过 Schedule -> Family 链确保家庭隔离
- **多孩子模型假设（已确认）**：真实 Schedule 模型即"一个日程记录对应一个孩子"——`AssignedChildId`(单数) + `GroupKey`(多孩子创建批次键)，N 孩子 = N 条 Schedule 记录。`UNIQUE(ScheduleId, Date)` 约束成立，无需调整。

#### 数据库策略

- **单数据库**，扩展现有 PostgreSQL 数据库
- EF Core Code First，新增 `Checkin` 实体和对应迁移
- 迁移脚本纳入版本控制
- 不新建数据库

### 2. ADR 决策记录

#### ADR-010: 打卡记录存储 -- 虚拟实例模式（ScheduleId + Date 复合键）

- **Context**: 日程是重复的（按周重复），需要为每个具体日期的日程记录打卡状态。传统做法是预生成实例表（ScheduleInstance），但这会增加维护成本和存储开销。
- **Decision**: 首期采用**虚拟实例模式**——不建 ScheduleInstance 表，打卡记录以 `(ScheduleId, Date)` 为复合唯一键直接关联。打卡时前端传入 `scheduleId` + 当天日期 `date`，后端根据 Schedule 的时间信息计算时间窗口。实例状态由 Schedule 的取消记录（Cancellation 表，由 Schedule 模块定义）+ Checkin 记录 + 结算状态联合判定。「结算状态」由新增 `CheckinSettlement` 表物化（结算任务写库终态锚点，见 §7），而非 ScheduleInstance 表——虚拟实例模式不变。
- **Consequences**:
  - Positive: 无实例预生成开销、表结构简单、查询直接走复合索引、无实例同步问题
  - Negative: 打卡窗口判定需额外查询 Schedule 表获取时间信息（一次 JOIN，性能可接受）；未来如需回查"某天有哪些日程实例"，需联表计算（二期可考虑物化视图或预生成实例表）
- **Alternatives Considered**:
  - 预生成 ScheduleInstance 表：每晚生成未来 7 天实例，数据完整性好但增加维护复杂度（编辑日程需同步更新未来实例）
  - 物化视图：PostgreSQL 物化视图自动维护实例投影，但 EF Core 支持有限
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-011: 结算任务触发 -- Hangfire 定时调度

- **Context**: 每日结算任务需在凌晨 00:05 自动触发，需确定调度机制。要求具备 Dashboard 监控、自动重试、持久化 Job 存储、支持 Cron 表达式。
- **Decision**: 采用 **Hangfire** 框架做定时任务调度。Job `SettlementJob.ExecuteAsync()` 注册为 Recurring Job，Cron 表达式 `5 0 * * *`（每天 00:05）。Job 存储使用同一个 PostgreSQL 数据库（Hangfire.Postgres 扩展包），不引入额外存储。
- **Consequences**:
  - Positive: 内置 Dashboard 监控（`/hangfire` 端点，仅开发/运维环境可访问）、自动重试机制（`[AutomaticRetry(Attempts = 3)]`）、持久化 Job 存储（PostgreSQL，无需 Redis 或 MSMQ）、管理界面可手动触发和查看历史执行记录；auth-module 的账户注销 30 天清理定时任务也可复用 Hangfire 调度。
  - Negative: 增加 NuGet 包依赖（Hangfire、Hangfire.Postgres）；Dashboard 需额外配置访问控制（开发环境可开放，生产环境需 IP 白名单或 Basic Auth）；Hangfire 在进程中轮询 Job 队列，单实例场景无额外开销，多实例部署时注意 Worker Count 配置。
- **Alternatives Considered**:
  - .NET BackgroundService + Cron 定时器：零外部依赖但无 Dashboard 监控、无自动重试机制、需自行实现日志追踪和手动触发
  - Quartz.NET：功能强大但配置复杂，单任务场景过度；无内置 Dashboard
  - 外部 CronJob（k8s CronJob）：需要容器化部署和运维基础设施，首期不需要
  - 微信云函数定时触发器：绑定微信云生态，丧失自主可控性
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-012: 打卡幂等性 -- 数据库唯一约束 + 业务层判断

- **Context**: 多端同时打卡（家长+孩子同时点击）需保证幂等——首次请求成功，后续返回"已完成"而非报错。
- **Decision**: 数据库层设置唯一约束 `UNIQUE (ScheduleId, Date)` 防止重复写。业务层在写入前先查询 Checkin 是否存在：已存在 → 返回 `alreadyCheckedIn: true`（200 OK，非 409 冲突）；不存在 → INSERT。两者结合保证并发安全。
- **Consequences**:
  - Positive: 数据库唯一约束是最可靠的最后防线；业务层提前判断避免无效写和异常日志噪音；幂等返回 200（非 409）让前端统一处理
  - Negative: 每次打卡多一次 SELECT（可用 INSERT ... ON CONFLICT 优化为单次 SQL）
- **Alternatives Considered**:
  - 仅业务层判断无 DB 约束：并发 INSERT 可能重复写入，不安全
  - 分布式锁（Redis）：增加外部依赖，打卡场景频率低不需要
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-013: 打卡时间窗口判定 -- 服务端统一计算

- **Context**: 打卡窗口依赖日程类型、开始时间、结束时间、截止日期等参数，需确定判定逻辑的执行位置。
- **Decision**: 时间窗口判定在服务端 `CheckinService.CanCheckinAsync(scheduleId, date, serverTime)` 中统一计算。前端仅做乐观预判（客户端时间预判窗口 + 倒计时），以减少无效请求，但最终判定以服务端为准。客户端时间偏差 > 5 分钟时，前端展示 serverTime 而非 clientTime。
- **Consequences**:
  - Positive: 判定逻辑集中、可测试、不受客户端时钟偏差影响；前端乐观 UI 优化体验（提前窗口灰色按钮 + 倒计时无需每次都调 API）
  - Negative: 前端需单独请求获取窗口状态（`GET /api/v1/checkin/window/{scheduleId}/{date}`），增加一次网络调用
- **Alternatives Considered**:
  - 前端计算窗口：必须依赖服务器时间，需额外 API 获取 serverTime，且多端逻辑重复
  - 仅打卡时判定（不提前展示状态）：用户体验差，看不到倒计时和灰显提示
- **Status**: Accepted
- **Date**: 2026-08-08

### 3. 数据模型（ER 图）

#### 实体定义

**新增实体：Checkin**

```
+----------------------------------------------------------------------+
|                            Checkin                                   |
+----------------------------------------------------------------------+
|  Id          : long          PK, auto-increment                      |
|  ScheduleId     : Guid          NOT NULL, INDEXED (FK -> Schedule 模块)     |
|  Date        : DateOnly       NOT NULL, INDEXED                      |
|  UserId      : Guid          NOT NULL, INDEXED (FK -> User)          |
|  CheckinAt   : DateTimeOffset NOT NULL (server time)                 |
|  Source      : CheckinSource  NOT NULL (Parent / Child)               |
|  CreatedAt   : DateTimeOffset NOT NULL                               |
+----------------------------------------------------------------------+
|  UNIQUE: (ScheduleId, Date)  -- 每个日程每天最多一条打卡记录             |
|  INDEX: (ScheduleId, Date)   -- 按日程+日期查询打卡状态                  |
|  INDEX: (UserId)          -- 按用户查询打卡历史                      |
|                                                                      |
|  CheckinSource enum: { Parent, Child }                               |
+----------------------------------------------------------------------+

注：Checkin 表无 `Status` 或 `IsDeleted` 字段。
  - 打卡 = 创建记录
  - 撤销 = 删除记录（物理删除，而非软删除标记）
  - 撤销后若窗口仍开放，可重新打卡（新记录）
  - 终态实例：Checkin 表无记录 + 结算记录（CheckinSettlement）或 Cancellation/Exclusion 存在 = 终态
  - ⚠️ 表名映射为 `CheckinRecords`（EF 配置 `.ToTable("CheckinRecords")`）——`AnonymizationService.AnonymizeCheckinRecordsAsync` 已以原始 SQL 引用 `"CheckinRecords"` 表做注销用户打卡记录匿名化，表名须对齐避免匿名化静默失效
```

**新增实体：CheckinSettlement（结算记录——结算任务写库的终态锚点）**

```
+----------------------------------------------------------------------+
|                     CheckinSettlement                                 |
+----------------------------------------------------------------------+
|  Id          : long          PK, auto-increment                      |
|  ScheduleId  : Guid          NOT NULL, INDEXED (FK -> Schedule)      |
|  Date        : DateOnly      NOT NULL                                |
|  Status      : ScheduleStatus NOT NULL (Ended / Overdue / Incomplete)|
|  SettledAt   : DateTimeOffset NOT NULL (server time)                 |
+----------------------------------------------------------------------+
|  UNIQUE: (ScheduleId, Date)  -- 幂等锚点：每个实例最多一条结算记录     |
|  INDEX: (ScheduleId, Date)   -- 按日程+日期查结算状态                  |
+----------------------------------------------------------------------+
|  语义：结算记录的存在 = 实例已终态（未打卡→终态已写库）。              |
|    Status 取值（复用 ScheduleStatus 枚举，只写三种终态）：             |
|      Ended      = 课后活动「已结束」                                  |
|      Overdue    = 作业任务「逾期未完成」                              |
|      Incomplete = 日常作息「未完成」终态（结算写库后不可再打卡）        |
+----------------------------------------------------------------------+
```

**新增实体：Streak（连续完成天数——结算任务写库的 streak 数据）**

```
+----------------------------------------------------------------------+
|                            Streak                                    |
+----------------------------------------------------------------------+
|  Id              : long          PK, auto-increment                  |
|  Scope           : StreakScope   NOT NULL (Schedule / Child)         |
|  SubjectId       : Guid          NOT NULL (ScheduleId 或 ChildId)    |
|  CurrentStreak   : int           NOT NULL default 0                  |
|  LastSettledDate : DateOnly?     (上次结算日期，幂等锚点)              |
|  UpdatedAt       : DateTimeOffset NOT NULL                           |
+----------------------------------------------------------------------+
|  UNIQUE: (Scope, SubjectId)                                          |
+----------------------------------------------------------------------+
|  StreakScope enum: { Schedule = 1, Child = 2 }                       |
|    Schedule = 单日程连续打卡天数（SubjectId = ScheduleId）            |
|    Child    = 孩子整体连续打卡天数（SubjectId = AssignedChildId）      |
|  连续天数仅对日常作息（DailyRoutine）计算（spec Streak Update 约定）    |
+----------------------------------------------------------------------+
```

**依赖实体（Schedule 模块，本模块通过 ID 引用）**

```
+----------------------------------------------------------------------+
|                    Schedule（日程，来自 Schedule 模块）                      |
+----------------------------------------------------------------------+
|  Id            : Guid (PK)                                          |
|  Name          : string                                             |
|  ScheduleType  : ScheduleType (AfterSchoolActivity / DailyRoutine / |
|                                HomeworkTask)                        |
|  FamilyId      : Guid      (家庭隔离)                                |
|  AssignedChildId: Guid     (关联孩子，N 孩子 = N 条记录)              |
|  CreatedBy     : Guid                                                |
|  GroupKey      : Guid      (多孩子创建批次键)                        |
|  RepeatEndDate : DateOnly? (重复结束日期，null = 无限重复)            |
|  Notes         : string?                                             |
|  Location      : string?                                             |
|  DueDate       : DateOnly? (作业任务截止日期)                        |
|  SuggestedStartTime: TimeOnly? (作业任务建议开始时间)                 |
|  SuggestedEndTime  : TimeOnly? (作业任务建议结束时间)                 |
|  SourceScheduleId : Guid?  (ThisOnly 编辑的衍生来源)                 |
|  OverrideDate  : DateOnly? (衍生日程覆盖日期)                        |
|  RowVersion    : byte[]    (乐观锁)                                 |
|  IsDeleted     : bool      (软删除标记)                             |
|  CreatedAt / UpdatedAt : DateTimeOffset                             |
|  导航: TimeSlots[] / Cancellations[] / DateExclusions[] /           |
|        SourceSchedule / DerivativeSchedules[]                       |
+----------------------------------------------------------------------+
|  ⚠️ 时间不以 Schedule.StartTime/EndTime 扁平字段表达：                |
|   课后活动/日常作息 → TimeSlots(DayOfWeek+StartTime+EndTime)          |
|   作业任务 → SuggestedStartTime/SuggestedEndTime + DueDate            |
|   周重复天数由 TimeSlots 的 DayOfWeek 推导（无 RepeatRule 字段）      |
+----------------------------------------------------------------------+

+----------------------------------------------------------------------+
|              Cancellation（取消记录，来自 Schedule 模块）                  |
+----------------------------------------------------------------------+
|  Id          : long (PK)                                             |
|  ScheduleId  : Guid (FK -> Schedule)                                 |
|  CancelDate  : DateOnly                                              |
|  CancelledBy : Guid (FK -> User)                                     |
|  CancelledAt : DateTimeOffset                                        |
+----------------------------------------------------------------------+
|  UNIQUE: (ScheduleId, CancelDate)                                    |
+----------------------------------------------------------------------+

+----------------------------------------------------------------------+
|              TimeSlot（时间槽，来自 Schedule 模块）                        |
+----------------------------------------------------------------------+
|  Id          : long (PK)                                             |
|  ScheduleId  : Guid (FK -> Schedule)                                 |
|  DayOfWeek   : DayOfWeek (周几，存储为 int)                            |
|  StartTime   : TimeOnly (开始时间)                                    |
|  EndTime     : TimeOnly (结束时间)                                    |
+----------------------------------------------------------------------+
|  UNIQUE: (ScheduleId, DayOfWeek)                                     |
+----------------------------------------------------------------------+

+----------------------------------------------------------------------+
|       ScheduleDateExclusion（日期排除记录，来自 Schedule 模块）            |
+----------------------------------------------------------------------+
|  Id          : long (PK)                                             |
|  ScheduleId  : Guid (FK -> Schedule)                                 |
|  ExcludedDate: DateOnly                                              |
|  ExcludedBy  : Guid (FK -> User)                                     |
|  CreatedAt   : DateTimeOffset                                        |
+----------------------------------------------------------------------+
|  UNIQUE: (ScheduleId, ExcludedDate)                                  |
+----------------------------------------------------------------------+
```

**状态推导逻辑**：

后端 `CheckinService` 通过五个数据源联合推导实例状态（`ScheduleStatusHelper.DeriveInstanceStatus` 仅作参考——其 `ended`/`overdue` 来自 `RepeatEndDate`/`DueDate`，是重复期/截止期语义，**不含** checkin 的「课后活动 endTime+2h 即时逾期」规则，CheckinService 自带该规则）：

```
给定 (scheduleId, date, serverTime):

1. 查 Checkin: WHERE ScheduleId = @scheduleId AND Date = @date
   → 存在 → 实例状态 = "已完成"

2. 查 Cancellation + ScheduleDateExclusion:
   - Cancellation: WHERE ScheduleId = @scheduleId AND CancelDate = @date
   - ScheduleDateExclusion: WHERE ScheduleId = @scheduleId AND ExcludedDate = @date
   → 存在任一 + 无 Checkin 记录 → 实例状态 = "已取消"（cancelled）
   （excluded 合并入 cancelled，不单独暴露 excluded 状态值——契约 status 枚举仅 5 值）
   （若同时存在 Checkin + 取消/排除（先打卡后取消），步骤 1 先行命中返回"已完成"）

3. 查 CheckinSettlement（结算记录，写库终态锚点）:
   WHERE ScheduleId = @scheduleId AND Date = @date
   → 存在 → 终态（status = 结算记录的 Status：Ended / Overdue / Incomplete）

4. 课后活动即时逾期判定（无需结算，当天实时生效）:
   - 课后活动: 当天 TimeSlot.EndTime + 2h < serverTime AND date = 今天 AND 无 Checkin
     → "已结束"（ended）

5. 未命中以上 → "未完成"（进行中，窗口开放）
```

> ⚠️ 修正说明：原设计只查 Cancellation 而忽略 ScheduleDateExclusion；"课后活动 endTime" 原取自 Schedule.StartTime/EndTime 扁平字段，实为 TimeSlots 中 DayOfWeek 匹配当天的 EndTime；终态判定新增 CheckinSettlement 结算记录作为写库锚点（B2 修复）。

**设计要点**：
- 课后活动的"已结束"在 API 层即时判定（step 4），也由结算任务次日写库（step 3 结算记录 Status=Ended），两条路径殊途同归
- 日常作息和作业任务依赖结算任务写库标记终态（当天 24:00 之前都可打卡，结算后 CheckinSettlement 落盘）
- 已结算的日程通过 CheckinSettlement 记录显式判定为终态（不再仅靠"Checkin 无记录 + 日期已过"的隐式推导）

#### ER 关系

```
+----------+         +------------------+
|   User   |         |     Schedule     |
|          |         |                  |
|  Id (PK) |         |  Id (PK)         |
+----------+         |  ScheduleType    |
     |               |  TimeSlots[]     |
     |               |  DueDate         |
     | 1             |  FamilyId        |
     |               |  AssignedChildId |
     |               |  GroupKey        |
     |               +------------------+
     |                      |                |
     |                      | 1              | 1
     |                      |                |
     | N                    | N              | N
     |                      |                |
+----------+         +------------------+   +------------------+
| Checkin  |         | Cancellation     |   |CheckinSettlement |
|          |         |                  |   |                  |
| Id (PK)  |         | Id (PK)          |   | Id (PK)          |
|ScheduleId|--FK     | ScheduleId       |--FK| ScheduleId      |--FK
| Date     |         | CancelDate       |   | Date             |
| UserId   |--FK     | CancelledBy      |--FK| Status           |
| CheckinAt|         | CancelledAt      |   | SettledAt        |
| Source   |         +------------------+   | UNIQUE(Sched,Date)|
+----------+                                 +------------------+

+------------------+
|     Streak       |  SubjectId 多态：Scope=Schedule → ScheduleId；Scope=Child → AssignedChildId
| Id (PK)          |
| Scope            |
| SubjectId        |
| CurrentStreak    |
| LastSettledDate  |
| UNIQUE(Scope,SubjectId) |
+------------------+
```

#### 关系基数推导

| 关系 | 基数 | 推导来源 |
|------|:----:|---------|
| User -- Checkin | 1 : N | 一个用户可进行多次打卡（US 未限制） |
| Schedule -- Checkin | 1 : N | 每个日程每天一条打卡记录（US-CHK-01），一个日程多个日期多条记录 |
| Schedule -- Cancellation | 1 : N | 一个日程可被取消多次（不同日期），US-CHK-07 提到周三取消 |
| Schedule -- CheckinSettlement | 1 : N | 每个日程每天最多一条结算记录（spec Settlement Execution 逐实例写库） |
| Schedule/Child -- Streak (SubjectId 多态) | 1 : N | 单日程 streak 按 ScheduleId 计，孩子整体 streak 按 AssignedChildId 计（spec Streak Update） |
| Checkin (ScheduleId, Date) | UNIQUE | BE-05 多端同时打卡防重 |
| CheckinSettlement (ScheduleId, Date) | UNIQUE | spec Settlement Idempotency 幂等锚点 |
| Streak (Scope, SubjectId) | UNIQUE | 每个 subject 一条 streak 记录（spec Streak Update） |

#### 级联规则

| 操作 | 规则 |
|------|------|
| 删除 Schedule | 打卡记录保留（BE-11：历史打卡记录保留，已删除日程不参与后续统计）。通过 Schedule.IsDeleted 软删除实现，不级联物理删除 Checkin。 |
| 取消 Schedule 实例 | 不影响已有 Checkin 记录。取消是创建 Cancellation 记录，不删除 Checkin。"先打卡后取消"的实例视作已完成（状态推导步骤 1 先行命中 Checkin）。 |
| 编辑 Schedule 时间 | 仅影响未来实例（BE-10：历史实例统计不受影响）。Checkin 记录以打卡时的服务器时间为准（BE-22）。 |
| 孩子从家庭移除 | 保留历史 Checkin 记录（BE-12：历史统计可查询）。通过 Schedule.FamilyId 路径阻断未来查询。 |
| 结算写库 | CheckinSettlement 按 (ScheduleId, Date) 幂等插入，存在即跳过（终态不变，spec Settlement Idempotency）。 |
| Streak 更新 | 每日结算按孩子分组事务内 upsert Streak；取消实例不改 streak（spec Streak Update：cancelled 不增不减）。 |

### 4. API 契约

所有 API 端点使用 URL 路径版本 `/api/v1/`（与 auth-module 一致）。

#### 端点清单

| 方法 | 路径 | 认证 | 说明 |
|------|------|:--:|------|
| GET | `/api/v1/checkin/window/{scheduleId}/{date}` | 是 | 查询打卡窗口状态（canCheckin / canUndo / reason） |
| POST | `/api/v1/checkin` | 是 | 执行打卡（创建 Checkin 记录） |
| DELETE | `/api/v1/checkin/{scheduleId}/{date}` | 是 | 撤销打卡（删除 Checkin 记录） |

#### 请求/响应形状

**查询打卡窗口状态：**
```
GET /api/v1/checkin/window/{scheduleId}/{date}

Response:
{
  "scheduleId": "guid",
  "date": "2026-10-27",
  "canCheckin": true,
  "canUndo": false,
  "reason": null,
  "remainingSeconds": null,
  "status": "incomplete",
  "statusLabel": "未完成",
  "serverTime": "2026-10-27T15:29:00+08:00"
}

-- or 提前窗口未开放 --
{
  "scheduleId": "guid",
  "date": "2026-10-27",
  "canCheckin": false,
  "canUndo": false,
  "reason": "EARLY",
  "remainingSeconds": 120,
  "status": "incomplete",
  "statusLabel": "2 分钟后可打卡",
  "serverTime": "2026-10-27T15:28:00+08:00"
}

-- or 已完成 --
{
  "scheduleId": "guid",
  "date": "2026-10-27",
  "canCheckin": false,
  "canUndo": true,
  "reason": null,
  "remainingSeconds": null,
  "status": "completed",
  "statusLabel": "已完成",
  "serverTime": "2026-10-27T16:35:00+08:00"
}

-- or 终态 "已结束" --
{
  "scheduleId": "guid",
  "date": "2026-10-27",
  "canCheckin": false,
  "canUndo": false,
  "reason": "TERMINAL_STATE",
  "remainingSeconds": null,
  "status": "ended",
  "statusLabel": "已结束",
  "serverTime": "2026-10-27T19:01:00+08:00"
}

-- or 终态 "逾期未完成" --
{
  "scheduleId": "guid",
  "date": "2026-10-27",
  "canCheckin": false,
  "canUndo": false,
  "reason": "TERMINAL_STATE",
  "remainingSeconds": null,
  "status": "overdue",
  "statusLabel": "逾期未完成",
  "serverTime": "2026-10-28T00:01:00+08:00"
}

Errors: 401 (token invalid/expired), 404 (schedule not found), 403 (not family member)
```

**执行打卡：**
```
POST /api/v1/checkin

Request:
{
  "scheduleId": "guid",
  "date": "2026-10-27"
}

Response (成功):
{
  "checkinId": 42,
  "scheduleId": "guid",
  "date": "2026-10-27",
  "checkinAt": "2026-10-27T16:05:32+08:00",
  "source": "Parent"
}

Response (幂等, 已打卡):
{
  "checkinId": 42,
  "scheduleId": "guid",
  "date": "2026-10-27",
  "alreadyCheckedIn": true,
  "checkinAt": "2026-10-27T16:05:32+08:00"
}

Errors: 400 (CHECKIN_WINDOW_CLOSED / TERMINAL_STATE),
        401, 403, 404 (schedule not found),
        400 (SCHEDULE_CANCELLED — schedule is cancelled/excluded on this date)
```

**撤销打卡：**
```
DELETE /api/v1/checkin/{scheduleId}/{date}

Response (成功):
{
  "scheduleId": "guid",
  "date": "2026-10-27",
  "undone": true,
  "status": "incomplete"
}

Errors: 400 (TERMINAL_STATE / WINDOW_CLOSED / NOT_CHECKED_IN), 401, 403

注：撤销执行物理删除 Checkin 记录。
    撤销后若窗口仍开放，客户端可重新 POST /checkin 打卡。
```

#### 错误码枚举

> 全部错误码已沉淀到 `openspec/contracts/checkin/errors.json`（单一真相源）。下表为 design 视角的语义说明，具体值以 errors.json 为准。

| HTTP Status | 错误码 | 说明 |
|:--:|------|------|
| 400 | `CHECKIN_WINDOW_CLOSED` | 打卡时间窗口已关闭 |
| 400 | `TERMINAL_STATE` | 实例处于终态，不可打卡/撤销 |
| 400 | `NOT_CHECKED_IN` | 该实例无打卡记录，不可撤销 |
| 400 | `WINDOW_CLOSED` | 撤销时窗口已关闭 |
| 400 | `SCHEDULE_CANCELLED` | 该日程在该日期已被取消/排除（Checkin 域新建） |
| 401 | `TOKEN_INVALID` | JWT 无效/过期（复用 auth-module 错误码，与 `contracts/auth/errors.json` 一致） |
| 403 | `NOT_FAMILY_MEMBER` | 当前用户不是该日程的家庭成员（注意 `CHILD_ACCESS_DENIED` 是「孩子角色无权」语义，打卡权限边界是「家庭成员」而非「角色」。⚠️ 抛出机制见下方「错误码枚举」⚠️：须由 CheckinService 主动抛 `DomainException("NOT_FAMILY_MEMBER")`，不可依赖 FamilyContextService 的 `UnauthorizedAccessException`，否则被映射为 401） |
| 404 | `SCHEDULE_NOT_FOUND` | 日程不存在或已删除（复用 Schedule 模块既有错误码，见 ScheduleController） |

> 裁决 #1 落地：废弃 "Event" 术语。`EVENT_CANCELLED`/`NOT_EVENT_PARTICIPANT`/`EVENT_NOT_FOUND` 全部替换为 Schedule/Family 术语。`SCHEDULE_CANCELLED` 为 Checkin 域新建；`NOT_FAMILY_MEMBER`/`SCHEDULE_NOT_FOUND`/`TOKEN_INVALID` 复用既有错误码。
> ⚠️ 抛出机制：Checkin 错误码 MUST 经 `DomainException(errorCode)` 抛出（由 `ExceptionHandlingMiddleware` 的 `catch (DomainException ex)` 映射为 HTTP 状态 + 错误信封）。注意 `UnauthorizedAccessException` 会被中间件统一映射为 401 `TOKEN_INVALID`、`KeyNotFoundException` 会落入 `catch (Exception)` 映射为 500——`NOT_FAMILY_MEMBER`(403) 与 `SCHEDULE_NOT_FOUND`(404) 不可用这两类异常抛出。dev-dotnet 需将 checkin 错误码合并进 `ErrorCodes.cs`（该文件从 contracts 生成，当前仅含 auth 错误码）。

#### 鉴权拒绝路径说明

| HTTP Status | 错误码 | 处理方式 |
|:--:|------|------|
| 401 | `TOKEN_INVALID` | 由 auth-module JWT 中间件统一拦截，前端 `services/api.js` 拦截器自动续期或跳登录页。后端 Checkin API 无需额外处理。 |
| 403 | `NOT_FAMILY_MEMBER` | 由 `CheckinService` 经 `IScheduleQueryService.GetScheduleAsync` 取 Schedule.FamilyId，与用户家庭比对（用户家庭经 `IFamilyContextService.GetFamilyContextAsync` 获取），不匹配时**主动抛 `DomainException("NOT_FAMILY_MEMBER")`** → 中间件 `catch (DomainException)` 映射为 403。⚠️ 不可依赖 `GetFamilyContextAsync` 在「零家庭」时抛的 `UnauthorizedAccessException`（中间件 `catch (UnauthorizedAccessException)` 映射为 401 `TOKEN_INVALID`）——须 catch 后转 `DomainException("NOT_FAMILY_MEMBER")` 或改用直接 FamilyMember 查询判定。403 错误不单独建时序图，由异常中间件统一处理。 |
| 400 | `SCHEDULE_CANCELLED` | 日程在该日期已被取消/排除，前端 Toast "该日程已取消"，打卡按钮不显示。 |

#### 安全约束

- 所有接口通过 `[Authorize]` + JWT Bearer 校验
- 打卡/撤销操作校验：当前用户必须是日程关联家庭的成员
- 撤销只能由打卡人或同一家庭的其他成员操作
- serverTime 使用 `DateTimeOffset.UtcNow` 转为北京时间

### 5. 前端架构

#### 页面增强（日程详情页）

打卡与统计模块首期不新建页面，仅增强已有日程详情页的打卡按钮逻辑。

```
pages/schedule-detail/index.js
    │
    │ onShow() / onLoad():
    │   1. 获取 scheduleId + date（从 URL 参数）
    │   2. 调用 GET /api/v1/checkin/window/{scheduleId}/{date}
    │   3. 根据返回的 { canCheckin, canUndo, status, remainingSeconds }
    │      更新按钮状态
    │
    │ 按钮状态机:
    │
    │   canCheckin=true, canUndo=false  → 显示打卡按钮（可点击）
    │   canCheckin=false, reason=EARLY  → 显示打卡按钮（灰色 + 倒计时）
    │   canCheckin=false, canUndo=true  → 显示撤销打卡按钮（可点击）
    │   status in {ended,overdue,cancelled} → 不显示打卡按钮，仅显示状态文本
    │
    │ 撤销按钮显隐同时受展示模式控制:
    │   学龄前模式 → 不显示撤销按钮（module-display-mode.md 决策#6）
    │   小学/高年级模式 → 显示撤销按钮（canUndo=true 时）
    │
    │ 倒计时逻辑:
    │   setInterval 每 30 秒递减，归零后刷新窗口状态
    │   生命周期管理（遵循 dev-miniapp-standards 定时器规范）:
    │     onShow(): 重新调用 GET /checkin/window 获取最新状态，
    │              若 window 返回 remainingSeconds > 0 则启动倒计时
    │     onHide():  clearInterval(this._countdownTimer)
    │     onUnload(): clearInterval(this._countdownTimer)
    │
    └── 微信原生导航栏（返回 + 标题）
```

#### 新增服务文件

```
app/services/checkin.js（⚠️ 已存在 stub，方法名 getWindow/checkin/undo/getRecords 为前端内部实现非契约，统一保留此名；undo 路径统一为路径参数形式，见裁决 #2。其中 getRecords 为二期 CHK-07 统计端点，首期不实现）

模块功能:
  - getWindow(scheduleId, date)          —— GET    /api/v1/checkin/window/{scheduleId}/{date}
  - checkin(scheduleId, date)            —— POST   /api/v1/checkin
  - undo(scheduleId, date)               —— DELETE /api/v1/checkin/{scheduleId}/{date}
  - getRecords(scheduleId, date)         —— ⚠️ 二期（CHK-07 统计）：GET /api/v1/checkin/records（首期 §4 端点清单无此端点，读取由窗口查询 status + ScheduleResponse.CheckinRecords 覆盖，前端不实现，stub 残留保留但标注二期）

错误处理: 401 由 services/api.js 统一拦截器处理续期
```

#### 前端 data-id（打卡相关元素）

> 页面目录为 `schedule-detail`（非 `event-detail`）。`checkin-btn` / `checkin-btn-disabled` / `undo-btn` / `checkin-record-{childId}` 已存在于 `app/pages/schedule-detail/index.wxml`；其余状态元素为本次新增。

| 页面/组件 | 元素 | data-id | 状态 |
|----------|------|---------|:--:|
| `schedule-detail` | 打卡按钮 | `schedule-detail-checkin-btn` | 已有 |
| `schedule-detail` | 撤销打卡按钮 | `schedule-detail-undo-btn` | 已有 |
| `schedule-detail` | 打卡按钮（灰色禁用） | `schedule-detail-checkin-btn-disabled` | 已有 |
| `schedule-detail` | 打卡记录行 | `schedule-detail-checkin-record-{childId}` | 已有 |
| `schedule-detail` | 倒计时文本 | `schedule-detail-checkin-countdown` | 新建 |
| `schedule-detail` | 状态文本（已完成） | `schedule-detail-status-completed` | 新建 |
| `schedule-detail` | 状态文本（已结束） | `schedule-detail-status-ended` | 新建 |
| `schedule-detail` | 状态文本（未完成） | `schedule-detail-status-incomplete` | 新建 |
| `schedule-detail` | 状态文本（逾期未完成） | `schedule-detail-status-overdue` | 新建 |
| `schedule-detail` | 状态文本（已取消） | `schedule-detail-status-cancelled` | 新建 |
| `schedule-detail` | 打卡中（ loading） | `schedule-detail-checkin-loading` | 新建 |
| `schedule-detail` | 打卡错误提示 | `schedule-detail-checkin-error` | 新建 |

#### 数据流

```
页面 onShow
  → GET /checkin/window/{scheduleId}/{date}
  → { canCheckin, canUndo, status, remainingSeconds }
  → 按钮状态机：可点击 / 灰色倒计时 / 撤销 / 不显示

用户点击打卡 → POST /checkin → 200 → 刷新窗口 → 按钮切换为"撤销打卡"
用户点击撤销 → DELETE /checkin → 200 → 刷新窗口 → 按钮切换为"打卡确认"
倒计时每 30s 递减 → 归零后刷新窗口
```

### 6. 核心时序图

#### 时序 1: 打卡正常流程

```
用户              小程序前端                        Backend API                   DB
 |                   |                                |                          |
 |  查看日程详情      |                                |                          |
 |------------------>|                                |                          |
 |                   |-- GET /checkin/window/{id}/{date}                         |
 |                   |------------------------------->|                          |
 |                   |                                |-- Query Schedule            |
 |                   |                                |-- Query Checkin (not found)
 |                   |                                |-- Query Cancellation (not found)
 |                   |                                |-- serverTime 判定        |
 |                   |  <-- 200 {canCheckin: true}    |                          |
 |                   |                                |                          |
 |                   |-- 渲染: 打卡按钮可点击          |                          |
 |                   |                                |                          |
 |  点击打卡          |                                |                          |
 |------------------>|                                |                          |
 |                   |-- POST /checkin {scheduleId,date} |                          |
 |                   |------------------------------->|                          |
 |                   |                                |-- 校验 + INSERT Checkin |
 |                   |  <-- 200 {checkinId, ...}      |                          |
 |                   |-- 刷新窗口 → 按钮切换为"撤销打卡" |                          |
```

#### 时序 2: 打卡 -- 时间窗口已关闭

```
小程序前端                        Backend API
 |                                |
 |-- POST /checkin {scheduleId,date} |
 |------------------------------->|
 |                                |-- 课后活动 endTime+2h < serverTime
 |  <-- 400 WINDOW_CLOSED        |
 |-- Toast: "打卡窗口已关闭"       |
 |-- 刷新 → 按钮消失               |
```

#### 时序 3: 多端同时打卡（幂等）

```
家长手机                          后端 API                        孩子手机
 |                                |                                |
 |-- POST /checkin {scheduleId,date} |                                |
 |------------------------------->|                                |
 |                                |-- SELECT → not found           |
 |                                |-- INSERT → 成功 (id=42)       |
 |                                |                                |
 |                                |  << 同时 >> POST /checkin      |
 |                                |<-------------------------------|
 |                                |-- SELECT → 找到 (id=42)       |
 |                                |-- 跳过 INSERT (幂等)          |
 |                                |                                |
 |  <-- 200 {checkinId:42}       |                                |
 |                                |  -- 200 {alreadyCheckedIn}    |
 |                                |------------------------------->|
 |              双方都正常展示"已完成"状态                            |
```

#### 时序 4: 撤销打卡 -- 正常流程

```
用户              小程序前端                        Backend API                   DB
 |                   |                                |                          |
 |  点击撤销打卡      |                                |                          |
 |------------------>|                                |                          |
 |                   |-- DELETE /checkin/{id}/{date}  |                          |
 |                   |------------------------------->|                          |
 |                   |                                |-- 验证窗口开放 → DELETE |
 |                   |  <-- 200 {undone:true}         |                          |
 |                   |-- 刷新 → 按钮切换为"打卡确认"    |                          |
```

#### 时序 5: 撤销打卡 -- 终态不可撤销

```
小程序前端                        Backend API
 |                                |
 |-- DELETE /checkin/{id}/{date}  |
 |------------------------------->|
 |                                |-- 日常作息 date=yesterday, Checkin 存在
 |                                |-- serverTime > 昨天 24:00 → 终态
 |  <-- 400 TERMINAL_STATE       |
 |-- Toast: "已结算，不可撤销"     |
 |-- 刷新 → 按钮不显示, 红色"未完成"
```

#### 时序 6: 撤销与结算竞态（US-CHK-27）

```
用户                                 Backend API                        Hangfire
 |                                      |                                |
 |  23:59:30 打卡 → success             |                                |
 |  23:59:50 撤销 → success             |                                |
 |  状态 = "未完成"（撤销后）             |                                |
 |                                      |    00:05 Hangfire 触发结算    |
 |                                      |<-------------------------------|
 |                                      |-- 查 Checkin: 无记录(已删除)   |
 |                                      |-- 查 Cancellation: 无         |
 |                                      |-- 日常作息, date=yesterday     |
 |                                      |-- 写库 CheckinSettlement       |
 |                                      |   Status=Incomplete(终态)      |
 |                                      |  结果正确，无竞态错误          |
```

#### 时序 7: 每日结算任务（Hangfire 调度）

```
Hangfire Scheduler                    SettlementJob                    DB
 |                                      |                              |
 │  每天 00:05 Cron 触发                |                              |
 │  "5 0 * * *"                        |                              |
 |=====================================>|                              |
 |                                      |                              |
 |                                      |-- Query Schedules (yesterday)  |
 |                                      |----------------------------->|
 |                                      |<--- schedule list              |
 |                                      |                              |
 |                                      |-- FOR EACH child:           |
 |                                      |   Per-child transaction     |
 |                                      |   1. 查 Checkin/Cancellation |
 |                                      |   2. 按类型判定终态          |
 |                                      |   3. INSERT CheckinSettlement|
 |                                      |   4. upsert Streak           |
 |                                      |-------------------------->   |
 |                                      |<--- commit                  |
 |                                      |                              |
 |  执行完成, 记录 Hangfire 历史         |                              |
 |<=====================================|                              |
 |                                      |                              |
 |  异常处理 (Hangfire 内置):           |                              |
 |  - Job 失败 → 自动重试 (3次)         |                              |
 |  - Dashboard 可查看失败详情          |                              |
 |  - 可手动触发重新执行                |                              |
```

### 7. 结算任务设计细节

#### Hangfire Job 注册

```csharp
// HangfireConfiguration.cs —— 注册 Recurring Job

public static class HangfireConfiguration
{
    public static void ConfigureHangfire(this IServiceCollection services,
                                          IConfiguration configuration)
    {
        services.AddHangfire(config =>
            config.UsePostgreSqlStorage(
                configuration.GetConnectionString("DefaultConnection")));

        services.AddHangfireServer(options =>
        {
            options.WorkerCount = 1; // 单 worker，防止并发执行
        });
    }

    public static void ScheduleRecurringJobs(this IApplicationBuilder app)
    {
        RecurringJob.AddOrUpdate<SettlementJob>(
            "daily-settlement",
            job => job.ExecuteAsync(default),
            "5 0 * * *",  // 每天 00:05 (北京时间)
            new RecurringJobOptions
            {
                TimeZone = TimeZoneInfo.FindSystemTimeZoneById("China Standard Time")
            });
    }
}
```

```csharp
// SettlementJob.cs —— Hangfire Job 实现（写库完整实现）

public class SettlementJob
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<SettlementJob> _logger;

    public SettlementJob(AppDbContext dbContext, ILogger<SettlementJob> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [AutomaticRetry(Attempts = 3, OnAttemptsExceeded = AttemptsExceededAction.Fail)]
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var yesterday = DateOnly.FromDateTime(
            DateTime.UtcNow.AddHours(8).AddDays(-1)); // 北京时间昨天

        _logger.LogInformation("Settlement started for {Date}", yesterday);

        // 昨日适用的未删除日程：HomeworkTask 按 DueDate==昨天；其余按昨天 DayOfWeek 匹配 TimeSlot 且重复期未结束（RepeatEndDate==null 或 >= 昨天，过滤「重复期已结束」的日程，对齐 ScheduleStatusHelper 的 ended 终态语义）
        // （并发安全：只处理昨天，不触碰今天实例，见 spec Settlement Concurrent Safety）
        var schedules = await _dbContext.Schedules
            .Where(e => !e.IsDeleted)
            .Where(e =>
                (e.ScheduleType == ScheduleType.HomeworkTask && e.DueDate == yesterday) ||
                (e.ScheduleType != ScheduleType.HomeworkTask &&
                 e.TimeSlots.Any(t => t.DayOfWeek == yesterday.DayOfWeek) &&
                 (e.RepeatEndDate == null || e.RepeatEndDate >= yesterday)))
            .ToListAsync(ct);

        foreach (var childGroup in schedules.GroupBy(e => e.AssignedChildId))
        {
            using var tx = await _dbContext.Database
                .BeginTransactionAsync(ct);
            try
            {
                await ProcessChildSettlementAsync(
                    childGroup.Key, childGroup.ToList(),
                    yesterday, ct);
                await tx.CommitAsync(ct);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(ex,
                    "Settlement failed for child {ChildId}", childGroup.Key);
                throw; // Hangfire 自动重试（spec Settlement Error Recovery）
            }
        }

        _logger.LogInformation("Settlement completed for {Date}", yesterday);
    }
}
```

#### 结算写库算法

`ProcessChildSettlementAsync` 对每个孩子分组的昨日实例执行（per-child 事务内）：

1. 跳过已打卡实例：查 `Checkin` `(ScheduleId, Date)` 存在 → 已完成，不结算（spec「结算不修改已完成」）
2. 跳过取消/排除实例：经 `IScheduleQueryService.GetCancellationStatusAsync`/`IsDateExcludedAsync` 判定 → 已取消，不结算（spec「结算不修改已取消」）
3. 计算终态：按类型推导（课后活动→`Ended` / 日常作息→`Incomplete` 终态 / 作业任务→`Overdue`）
4. 写库终态：INSERT `CheckinSettlement`（Status=终态, SettledAt=now）；`UNIQUE(ScheduleId, Date)` 约束 + 插入前查重保证幂等（spec Settlement Idempotency）
5. 更新 streak：对日常作息计算单日程 + 孩子整体连续天数，upsert `Streak`（spec Streak Update）

#### 幂等性保障

- **终态写库幂等**：`CheckinSettlement` 表 `UNIQUE(ScheduleId, Date)` 兜底 + 插入前查当前状态（`Checkin` 无记录且 `CheckinSettlement` 无记录才插入）。重复执行对已结算实例不产生任何变化（spec Settlement Idempotency「transition 前查当前状态」）。
- **streak 幂等**：`Streak.LastSettledDate` 记录上次结算日期，同日重复结算跳过（避免连续天数重复累加）。

#### 错误重试与并发安全

- **错误重试**：Hangfire `[AutomaticRetry(Attempts = 3)]`；per-child 事务隔离——单个孩子写库失败只回滚该孩子事务，不影响其他孩子（spec Settlement Error Recovery）。
- **并发安全**：只处理昨天数据（`yesterday`），不触碰今天实例（spec Settlement Concurrent Safety）；`WorkerCount = 1` 单 worker 防重入（Hangfire DB 轮询锁兜底）。

#### streak 更新规则（仅日常作息 DailyRoutine）

| 场景 | 单日程 streak | 孩子整体 streak |
|------|--------------|----------------|
| 昨日已打卡 | +1 | 该孩子完成 ≥1 个有效日常作息 → +1 |
| 昨日未打卡（有效实例） | 重置为 0 | 有 ≥1 个有效实例但完成 0 → 重置为 0 |
| 已取消/排除实例 | 不变（不增不减） | 全部实例均取消 → 不变 |

#### 首期结算范围

1. Hangfire Job 注册 `5 0 * * *`（每天 00:05 北京时间）
2. 遍历昨日实例，按类型计算终态并**写库** `CheckinSettlement`（未打卡→终态 transition 落盘）
3. 幂等 + 错误重试（per-child 事务）+ 并发安全（只处理昨天）
4. 连续天数（streak）数据写库更新 `Streak`（前端展示 CHK-07/08/09 留二期，本阶段仅持久化数据）
5. Dashboard 可查看 Job 执行历史和状态

---

### 8. Risks / Trade-offs

#### 风险清单

| # | 风险 | 影响 | 可能性 | 缓解措施 |
|---|------|------|:--:|---------|
| R1 | 打卡窗口计算依赖 Schedule 表 JOIN，高频查询可能产生性能瓶颈 | 中 | 低 | 虚拟实例模式避免了实例预生成开销；Checkin 窗口仅需一次 Schedule + Checkin + Cancellation 三表查询，索引覆盖（ScheduleId+Date），单次 < 50ms |
| R2 | 结算任务多实例并发执行导致数据不一致 | 高 | 低 | Hangfire Server `WorkerCount=1` 保证单 worker 执行；即使多实例，每个实例的 Hangfire Server 各跑独立 worker pool，Recurring Job 由 Hangfire 内置机制保证同一时刻只有一个实例执行（通过 DB 轮询锁） |
| R3 | 服务器时钟偏差导致结算触发时机不准确 | 低 | 低 | Hangfire Cron 使用配置的时区（`China Standard Time`），服务器 NTP 时间同步 |
| R4 | 撤销与结算竞态（23:59:50 撤销，00:05 结算） | 中 | 低 | CHECK-DO 模式：Checkin 记录物理删除 + 结算时 SELECT 当前状态 = 最终一致。无"中间态"问题。详见时序 6。 |
| R5 | Schedule 模块已实现，Checkin 窗口判定复用 `IScheduleQueryService`/`ScheduleQueryService` | 低 | 低 | 无需 Mock；若需隔离测试，对 `IScheduleQueryService` 做接口替身（Moq） |
| R6 | 课后活动"已结束"即时判定与结算任务写库的关系 | 低 | 低 | 查询 API 当天实时判定（endTime+2h，§3 step 4）；结算任务次日写库 `CheckinSettlement(Status=Ended)` 做持久化锚点（§3 step 3），两条路径终态一致 |
| R7 | 客户端倒计时不准确（页面切后台后 setInterval 暂停） | 中 | 中 | 小程序 `onShow` 时重新调用窗口查询 API 刷新；`onHide`/`onUnload` 中 `clearInterval` 清除定时器防止内存泄漏（遵循 dev-miniapp-standards） |
| R8 | 打卡按钮交互逻辑复杂 | 低 | 低 | 封装为独立 `checkin-status.js` 工具模块 |
| R9 | Hangfire Dashboard 暴露在生产环境 | 中 | 低 | Dashboard 仅在开发环境开放；生产环境禁用或加 IP 白名单 + Basic Auth |

#### 已知权衡

| 权衡 | 选择 | 代价 |
|------|------|------|
| 虚拟实例模式 vs 预生成实例表 | 虚拟实例（ScheduleId+Date 复合键） | 终态判定需联表查询（`CheckinSettlement` 提供显式终态锚点） |
| 结算写库（CheckinSettlement 终态锚点 + Streak）vs 纯实时推导 | 写库完整实现（审批人拍板 B2） | 新增两张表 + 结算事务，换取幂等/错误恢复/streak 持久化 |
| 撤销 = 物理删除 vs 软删除 | 物理删除 Checkin 记录 | 无法追溯撤销历史 |
| Hangfire vs BackgroundService | Hangfire（内置重试 + Dashboard + 持久化存储） | 增加 NuGet 依赖 + 需配置 Dashboard 访问控制 |

---

## Handoff to arch-planning

### 模块到 Task 映射建议

| 模块/Story | 后端 Task | 前端 Task | 集成 Task |
|------------|----------|----------|----------|
| 打卡窗口判定 API | CheckinService、GET /checkin/window 端点、复用 `IScheduleQueryService`/`ScheduleQueryService` 查询 + CheckinService 自带状态推导 | services/checkin.js、schedule-detail 按钮状态查询 | 联调窗口查询 |
| 打卡执行 API | POST /checkin 端点（幂等处理）、Checkin 实体 + 迁移 | schedule-detail 打卡按钮交互（四种状态） | 联调打卡全流程 |
| 撤销打卡 API | DELETE /checkin/{scheduleId}/{date} 端点（终态检测） | schedule-detail 撤销按钮交互 | 联调撤销全流程 |
| 结算任务 | SettlementJob（Hangfire 调度）、HangfireConfiguration（存储 + Dashboard + Cron 注册）、CheckinSettlement + Streak 实体 + 迁移 | 无 | 验证定时触发 + Dashboard |
| 跨模块接口 | 复用 `IScheduleQueryService`/`ScheduleQueryService`（DI 注册），无新造接口 | 无 | 已就绪（Schedule 模块已落地） |

### 集成 Task 时机

- 打卡窗口查询 API 完成后即可联调（倒计时 + 按钮状态）
- 打卡执行 API 在窗口查询基础上叠加
- 撤销打卡 API 可独立开发
- 结算任务 Hangfire 骨架可在后端 API 完成后独立验证

### 前置依赖

- .NET 10 SDK、PostgreSQL 实例、微信小程序开发者工具
- **关键依赖**：`api/Auth/` 模块的 JWT 中间件就绪
- **关键依赖**：`api/Domain/Entities/Schedule.cs` + `Cancellation.cs` 已存在（Schedule 模块已落地，无需最小化骨架）
- **定时任务依赖**：NuGet 包 Hangfire + Hangfire.Postgres
- **Hangfire 存储**：PostgreSQL（Hangfire 自动建表，无需手动迁移）

### API 接口汇总

| 方法 | 路径 | 用途 | 首期状态 |
|------|------|------|:--:|
| GET | `/api/v1/checkin/window/{scheduleId}/{date}` | 查询打卡窗口 | 实现 |
| POST | `/api/v1/checkin` | 执行打卡 | 实现 |
| DELETE | `/api/v1/checkin/{scheduleId}/{date}` | 撤销打卡 | 实现 |

---

## Open Questions

| # | 问题 | 当前状态 | 建议 |
|---|------|---------|------|
| 1 | （已解决）Schedule 模块对外查询接口 | 复用 `IScheduleQueryService`/`ScheduleQueryService`（ADR-017 依赖反转已就绪） | 无 Mock 需求 |
| 2 | 首期结算任务是否写库？ | 已由审批人拍板：**写库完整实现**（状态 transition 落 CheckinSettlement + streak 落 Streak） | 前端展示 CHK-07/08/09 留二期 |
| 3 | 打卡操作来源是否需要更细分？ | 需求已明确 Parent/Child | 已在 Checkin.Source 枚举中定义 |
| 4 | 撤销打卡是否允许家长撤销孩子的打卡？ | 同一家庭成员即可操作 | 权限校验基于家庭隔离 |
| 5 | Schedule 模块错误码硬编码（未进 contracts） | 属既有技术债，不属本次范围（裁决 #3） | Schedule 模块错误码进 contracts 应单独提 issue，不在 checkin 变更内阻塞 |
