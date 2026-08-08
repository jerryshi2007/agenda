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

- **后端**：`api/` 已有 auth-module design.md（.NET 10 Web API + PostgreSQL + EF Core），项目骨架尚未建仓
- **前端**：`app/` 已有 auth-module design.md（微信小程序原生），项目骨架尚未建仓
- **数据库**：PostgreSQL，单数据库模式
- **需求**：staging 目录 `production/staging/2026-08-08-打卡/` 状态为 `dev-ready`

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
3. 实现每日结算定时任务（凌晨 00:05，幂等，失败重试）
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
│   │   │   ├── UndoCheckinRequest.cs
│   │   │   └── UndoCheckinResponse.cs
│   │   └── Validators/
│   │       └── CheckinRequestValidator.cs
│   ├── Domain/                             # 共享领域实体
│   │   ├── Entities/
│   │   │   ├── User.cs                     # 已有
│   │   │   ├── Checkin.cs                  # NEW
│   │   │   └── Event.cs                    # 后续（Event 模块定义，Checkin 通过 ID 引用）
│   │   └── Enums/
│   │       ├── UserStatus.cs
│   │       └── EventType.cs                # NEW（课后活动/日常作息/作业任务）
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
│       └── event-detail/                   # 增强：打卡按钮时间窗口逻辑
│           └── index.js                    # 增强：倒计时、按钮状态切换
└── openspec/
```

#### 限界上下文

| 上下文 | 聚合根 | 模块目录 | 本模块关系 |
|--------|--------|---------|-----------|
| Auth（认证） | User | `api/Auth/` | 提供 userId（JWT 中解析） |
| Event（日程） | Event | 后续模块 | 提供 eventId + eventType + startTime/endTime，本模块通过 ID 弱引用 |
| **Checkin（打卡）** | **Checkin** | `api/Checkin/` | **本模块新建** |
| Family（家庭） | Family | 后续模块 | 数据隔离（familyId 来自 Event） |

**跨上下文交互规则**：
- Checkin 通过 `eventId` + `date` 引用 Event，不直接持有 Event 实体引用
- Checkin 通过 JWT 中解析的 `userId` 识别当前用户
- 打卡时间窗口判定需查询 Event 的类型/时间信息——通过 `IEventQueryService` 接口获取（Event 模块提供，本模块定义接口契约）
- 数据隔离：Checkin 查询时，通过 Event -> Family 链确保家庭隔离
- **多孩子模型假设**：Checkin 模块假定 Event 模块采用"一个日程记录对应一个孩子"模型（`AssignedChildId` 单数），`UNIQUE(EventId, Date)` 约束依赖此假设。若 Event 模块改为多孩子共享单一日程记录，则 Checkin 的 UNIQUE 约束须调整为 `(EventId, ChildId, Date)`。需求 `module-event.md` §4.1 支持多选孩子，此假设需在 Event 模块设计中确认对齐。

#### 数据库策略

- **单数据库**，扩展现有 PostgreSQL 数据库
- EF Core Code First，新增 `Checkin` 实体和对应迁移
- 迁移脚本纳入版本控制
- 不新建数据库

### 2. ADR 决策记录

#### ADR-010: 打卡记录存储 -- 虚拟实例模式（EventId + Date 复合键）

- **Context**: 日程是重复的（按周重复），需要为每个具体日期的日程记录打卡状态。传统做法是预生成实例表（EventInstance），但这会增加维护成本和存储开销。
- **Decision**: 首期采用**虚拟实例模式**——不建 EventInstance 表，打卡记录以 `(EventId, Date)` 为复合唯一键直接关联。打卡时前端传入 `eventId` + 当天日期 `date`，后端根据 Event 的时间信息计算时间窗口。实例状态由 Event 的取消记录（Cancellation 表，由 Event 模块定义）+ Checkin 记录 + 结算状态联合判定。
- **Consequences**:
  - Positive: 无实例预生成开销、表结构简单、查询直接走复合索引、无实例同步问题
  - Negative: 打卡窗口判定需额外查询 Event 表获取时间信息（一次 JOIN，性能可接受）；未来如需回查"某天有哪些日程实例"，需联表计算（二期可考虑物化视图或预生成实例表）
- **Alternatives Considered**:
  - 预生成 EventInstance 表：每晚生成未来 7 天实例，数据完整性好但增加维护复杂度（编辑日程需同步更新未来实例）
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
- **Decision**: 数据库层设置唯一约束 `UNIQUE (EventId, Date)` 防止重复写。业务层在写入前先查询 Checkin 是否存在：已存在 → 返回 `alreadyCheckedIn: true`（200 OK，非 409 冲突）；不存在 → INSERT。两者结合保证并发安全。
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
- **Decision**: 时间窗口判定在服务端 `CheckinService.CanCheckinAsync(eventId, date, serverTime)` 中统一计算。前端仅做乐观预判（客户端时间预判窗口 + 倒计时），以减少无效请求，但最终判定以服务端为准。客户端时间偏差 > 5 分钟时，前端展示 serverTime 而非 clientTime。
- **Consequences**:
  - Positive: 判定逻辑集中、可测试、不受客户端时钟偏差影响；前端乐观 UI 优化体验（提前窗口灰色按钮 + 倒计时无需每次都调 API）
  - Negative: 前端需单独请求获取窗口状态（`GET /api/v1/checkin/window/{eventId}/{date}`），增加一次网络调用
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
|  EventId     : Guid          NOT NULL, INDEXED (FK -> Event 模块)     |
|  Date        : DateOnly       NOT NULL, INDEXED                      |
|  UserId      : Guid          NOT NULL, INDEXED (FK -> User)          |
|  CheckinAt   : DateTimeOffset NOT NULL (server time)                 |
|  Source      : CheckinSource  NOT NULL (Parent / Child)               |
|  CreatedAt   : DateTimeOffset NOT NULL                               |
+----------------------------------------------------------------------+
|  UNIQUE: (EventId, Date)  -- 每个日程每天最多一条打卡记录             |
|  INDEX: (EventId, Date)   -- 按日程+日期查询打卡状态                  |
|  INDEX: (UserId)          -- 按用户查询打卡历史                      |
|                                                                      |
|  CheckinSource enum: { Parent, Child }                               |
+----------------------------------------------------------------------+

注：Checkin 表无 `Status` 或 `IsDeleted` 字段。
  - 打卡 = 创建记录
  - 撤销 = 删除记录（物理删除，而非软删除标记）
  - 撤销后若窗口仍开放，可重新打卡（新记录）
  - 已结算的实例：Checkin 表无记录 + Event/Cancellation 状态 = 终态
```

**依赖实体（Event 模块，本模块通过 ID 引用）**

```
+----------------------------------------------------------------------+
|                    Event（日程，来自 Event 模块）                      |
+----------------------------------------------------------------------+
|  Id          : Guid (PK)                                             |
|  Name        : string                                                |
|  EventType   : EventType  (AfterSchoolActivity / DailyRoutine /      |
|                              HomeworkTask)                           |
|  StartTime   : TimeOnly?   (课后活动/日常作息)                        |
|  EndTime     : TimeOnly?   (课后活动/日常作息)                        |
|  DueDate     : DateOnly?   (作业任务截止日期)                          |
|  RepeatRule  : DayOfWeek[] (周重复天数)                               |
|  RepeatEndDate: DateOnly?  (重复结束日期，null = 无限重复)              |
|  FamilyId    : Guid        (家庭隔离)                                |
|  AssignedChildId: Guid     (关联孩子)                                |
|  IsDeleted   : bool        (软删除标记)                              |
+----------------------------------------------------------------------+

+----------------------------------------------------------------------+
|              Cancellation（取消记录，来自 Event 模块）                  |
+----------------------------------------------------------------------+
|  Id          : long (PK)                                             |
|  EventId     : Guid (FK -> Event)                                   |
|  CancelDate  : DateOnly                                              |
|  CancelledBy : Guid (FK -> User)                                    |
|  CancelledAt : DateTimeOffset                                        |
+----------------------------------------------------------------------+
|  UNIQUE: (EventId, CancelDate)                                       |
+----------------------------------------------------------------------+
```

**状态推导逻辑**：

后端 `CheckinService` 通过三个数据源联合推导实例状态：

```
给定 (eventId, date, serverTime):

1. 查 Checkin: WHERE EventId = @eventId AND Date = @date
   → 存在 → 实例状态 = "已完成"

2. 查 Cancellation: WHERE EventId = @eventId AND CancelDate = @date
   → 存在 + 无 Checkin 记录 → 实例状态 = "已取消"
   （若同时存在 Checkin + Cancellation（先打卡后取消），步骤 1 先行命中返回"已完成"）

3. 检查是否已结算（终态判定）:
   - 日常作息: date < today AND 无 Checkin → "未完成"（终态）
   - 作业任务: dueDate < today AND 无 Checkin → "逾期未完成"
   - 课后活动: endTime + 2h < serverTime AND date = 今天 AND 无 Checkin
     → "已结束"（当天逾期即时判定，无需等到次日结算）

4. 未命中以上 → "未完成"（进行中，窗口开放）
```

**设计要点**：
- 课后活动的"已结束"在 API 层即时判定，不需要结算任务介入
- 日常作息和作业任务依赖结算任务标记终态（当天 24:00 之前都可打卡）
- 已结算的日程通过"Checkin 无记录 + 日期已过"判定为终态

#### ER 关系

```
+----------+         +---------------+
|   User   |         |     Event     |
|          |         |               |
|  Id (PK) |         |  Id (PK)      |
+----------+         |  EventType    |
     |               |  StartTime    |
     |               |  EndTime      |
     | 1             |  DueDate      |
     |               |  RepeatRule   |
     |               |  FamilyId     |
     |               |  AssignedChildId |
     |               +---------------+
     |                      |
     |                      | 1
     |                      |
     | N                    | N
     |                      |
+----------+         +---------------+
| Checkin  |         | Cancellation  |
|          |         |               |
| Id (PK)  |         | Id (PK)       |
| EventId  |--FK     | EventId       |--FK
| Date     |         | CancelDate    |
| UserId   |--FK     | CancelledBy   |--FK
| CheckinAt|         | CancelledAt   |
| Source   |         +---------------+
+----------+
```

#### 关系基数推导

| 关系 | 基数 | 推导来源 |
|------|:----:|---------|
| User -- Checkin | 1 : N | 一个用户可进行多次打卡（US 未限制） |
| Event -- Checkin | 1 : N | 每个日程每天一条打卡记录（US-CHK-01），一个日程多个日期多条记录 |
| Event -- Cancellation | 1 : N | 一个日程可被取消多次（不同日期），US-CHK-07 提到周三取消 |
| Checkin (EventId, Date) | UNIQUE | BE-05 多端同时打卡防重 |

#### 级联规则

| 操作 | 规则 |
|------|------|
| 删除 Event | 打卡记录保留（BE-11：历史打卡记录保留，已删除日程不参与后续统计）。通过 Event.IsDeleted 软删除实现，不级联物理删除 Checkin。 |
| 取消 Event 实例 | 不影响已有 Checkin 记录。取消是创建 Cancellation 记录，不删除 Checkin。"先打卡后取消"的实例视作已完成（状态推导步骤 1 先行命中 Checkin）。 |
| 编辑 Event 时间 | 仅影响未来实例（BE-10：历史实例统计不受影响）。Checkin 记录以打卡时的服务器时间为准（BE-22）。 |
| 孩子从家庭移除 | 保留历史 Checkin 记录（BE-12：历史统计可查询）。通过 Event.FamilyId 路径阻断未来查询。 |

### 4. API 契约

所有 API 端点使用 URL 路径版本 `/api/v1/`（与 auth-module 一致）。

#### 端点清单

| 方法 | 路径 | 认证 | 说明 |
|------|------|:--:|------|
| GET | `/api/v1/checkin/window/{eventId}/{date}` | 是 | 查询打卡窗口状态（canCheckin / canUndo / reason） |
| POST | `/api/v1/checkin` | 是 | 执行打卡（创建 Checkin 记录） |
| DELETE | `/api/v1/checkin/{eventId}/{date}` | 是 | 撤销打卡（删除 Checkin 记录） |

#### 请求/响应形状

**查询打卡窗口状态：**
```
GET /api/v1/checkin/window/{eventId}/{date}

Response:
{
  "eventId": "guid",
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
  "eventId": "guid",
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
  "eventId": "guid",
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
  "eventId": "guid",
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
  "eventId": "guid",
  "date": "2026-10-27",
  "canCheckin": false,
  "canUndo": false,
  "reason": "TERMINAL_STATE",
  "remainingSeconds": null,
  "status": "overdue",
  "statusLabel": "逾期未完成",
  "serverTime": "2026-10-28T00:01:00+08:00"
}

Errors: 401 (token invalid/expired), 404 (event not found), 403 (not event participant)
```

**执行打卡：**
```
POST /api/v1/checkin

Request:
{
  "eventId": "guid",
  "date": "2026-10-27"
}

Response (成功):
{
  "checkinId": 42,
  "eventId": "guid",
  "date": "2026-10-27",
  "checkinAt": "2026-10-27T16:05:32+08:00",
  "source": "parent"
}

Response (幂等, 已打卡):
{
  "checkinId": 42,
  "eventId": "guid",
  "date": "2026-10-27",
  "alreadyCheckedIn": true,
  "checkinAt": "2026-10-27T16:05:32+08:00"
}

Errors: 400 (CHECKIN_WINDOW_CLOSED / TERMINAL_STATE),
        401, 403, 404 (event not found),
        422 (event is cancelled on this date)
```

**撤销打卡：**
```
DELETE /api/v1/checkin/{eventId}/{date}

Response (成功):
{
  "eventId": "guid",
  "date": "2026-10-27",
  "undone": true,
  "status": "incomplete"
}

Errors: 400 (TERMINAL_STATE / WINDOW_CLOSED / NOT_CHECKED_IN), 401, 403

注：撤销执行物理删除 Checkin 记录。
    撤销后若窗口仍开放，客户端可重新 POST /checkin 打卡。
```

#### 错误码枚举

| HTTP Status | 错误码 | 说明 |
|:--:|------|------|
| 400 | `CHECKIN_WINDOW_CLOSED` | 打卡时间窗口已关闭 |
| 400 | `TERMINAL_STATE` | 实例处于终态，不可打卡/撤销 |
| 400 | `NOT_CHECKED_IN` | 该实例无打卡记录，不可撤销 |
| 400 | `WINDOW_CLOSED` | 撤销时窗口已关闭 |
| 400 | `EVENT_CANCELLED` | 该日程在该日期已被取消 |
| 401 | `TOKEN_INVALID` | JWT 无效/过期（复用 auth-module 错误码） |
| 403 | `NOT_EVENT_PARTICIPANT` | 当前用户不是该日程的家庭成员 |
| 404 | `EVENT_NOT_FOUND` | 日程不存在或已删除 |

#### 鉴权拒绝路径说明

| HTTP Status | 错误码 | 处理方式 |
|:--:|------|------|
| 401 | `TOKEN_INVALID` / `TOKEN_EXPIRED` | 由 auth-module JWT 中间件统一拦截，前端 `services/api.js` 拦截器自动续期或跳登录页。后端 Checkin API 无需额外处理。 |
| 403 | `NOT_EVENT_PARTICIPANT` / `NOT_FAMILY_MEMBER` | 由 `CheckinService` 查询 Event.FamilyId → 与当前用户所属家庭比对 → 不匹配则返回 403。403 错误不单独建时序图，由异常中间件统一处理。 |
| 422 | `EVENT_CANCELLED` | 日程在该日期已被取消，前端 Toast "该日程已取消"，打卡按钮不显示。 |

#### 安全约束

- 所有接口通过 `[Authorize]` + JWT Bearer 校验
- 打卡/撤销操作校验：当前用户必须是日程关联家庭的成员
- 撤销只能由打卡人或同一家庭的其他成员操作
- serverTime 使用 `DateTimeOffset.UtcNow` 转为北京时间

### 5. 前端架构

#### 页面增强（日程详情页）

打卡与统计模块首期不新建页面，仅增强已有日程详情页的打卡按钮逻辑。

```
pages/event-detail/index.js
    │
    │ onShow() / onLoad():
    │   1. 获取 eventId + date（从 URL 参数）
    │   2. 调用 GET /api/v1/checkin/window/{eventId}/{date}
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
app/services/checkin.js

模块功能:
  - getCheckinWindow(eventId, date)
  - doCheckin(eventId, date)
  - undoCheckin(eventId, date)

错误处理: 401 由 services/api.js 统一拦截器处理续期
```

#### 前端 data-id（打卡相关元素）

| 页面/组件 | 元素 | data-id |
|----------|------|---------|
| `event-detail` | 打卡按钮 | `event-detail-checkin-btn` |
| `event-detail` | 撤销打卡按钮 | `event-detail-undo-btn` |
| `event-detail` | 打卡按钮（灰色禁用） | `event-detail-checkin-btn-disabled` |
| `event-detail` | 倒计时文本 | `event-detail-checkin-countdown` |
| `event-detail` | 状态文本（已完成） | `event-detail-status-completed` |
| `event-detail` | 状态文本（已结束） | `event-detail-status-ended` |
| `event-detail` | 状态文本（未完成） | `event-detail-status-incomplete` |
| `event-detail` | 状态文本（逾期未完成） | `event-detail-status-overdue` |
| `event-detail` | 状态文本（已取消） | `event-detail-status-cancelled` |
| `event-detail` | 打卡中（ loading） | `event-detail-checkin-loading` |
| `event-detail` | 打卡错误提示 | `event-detail-checkin-error` |

#### 数据流

```
页面 onShow
  → GET /checkin/window/{eventId}/{date}
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
 |                   |                                |-- Query Event            |
 |                   |                                |-- Query Checkin (not found)
 |                   |                                |-- Query Cancellation (not found)
 |                   |                                |-- serverTime 判定        |
 |                   |  <-- 200 {canCheckin: true}    |                          |
 |                   |                                |                          |
 |                   |-- 渲染: 打卡按钮可点击          |                          |
 |                   |                                |                          |
 |  点击打卡          |                                |                          |
 |------------------>|                                |                          |
 |                   |-- POST /checkin {eventId,date} |                          |
 |                   |------------------------------->|                          |
 |                   |                                |-- 校验 + INSERT Checkin |
 |                   |  <-- 200 {checkinId, ...}      |                          |
 |                   |-- 刷新窗口 → 按钮切换为"撤销打卡" |                          |
```

#### 时序 2: 打卡 -- 时间窗口已关闭

```
小程序前端                        Backend API
 |                                |
 |-- POST /checkin {eventId,date} |
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
 |-- POST /checkin {eventId,date} |                                |
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
 |                                      |-- → 终态 "未完成"             |
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
 |                                      |-- Query Events (yesterday)  |
 |                                      |----------------------------->|
 |                                      |<--- event list              |
 |                                      |                              |
 |                                      |-- FOR EACH child:           |
 |                                      |   Per-child transaction     |
 |                                      |   1. 查 Checkin/Cancellation |
 |                                      |   2. 按类型判定终态          |
 |                                      |   3. 更新连续天数(二期)      |
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
// SettlementJob.cs —— Hangfire Job 实现

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

        var events = await _dbContext.Events
            .Where(e => !e.IsDeleted && e.FamilyId != null)
            .ToListAsync(ct);

        foreach (var childGroup in events.GroupBy(e => e.AssignedChildId))
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
                throw; // Hangfire 会自动重试
            }
        }

        _logger.LogInformation("Settlement completed for {Date}", yesterday);
    }
}
```

#### 幂等性保障

- 终态由查询 API 实时计算（不需要写库），因此无需"终态标记"的幂等性
- 结算任务的职责聚焦于**连续天数更新**（二期）
- 首期结算任务：建立 Hangfire Job 骨架 + 定时调度 + 重试机制 + Dashboard 监控，业务逻辑仅做验证性遍历
- **设计理由**：基于 ADR-010 虚拟实例模式，Phase 1 终态判定在查询时实时计算，无需 DB 写入。`module-checkin.md` §8.1 定义的"状态变更为已结束/未完成/逾期未完成"在 virtual instance 模式下等价于查询 API 返回的终态 status 值——状态的"真相源"由 (Checkin 记录有无 + 日期) 决定，不需要额外的 DB 终态列。Phase 2 连续天数更新将引入 DB 写入逻辑。

#### 首期结算范围

1. Hangfire Job 注册 `5 0 * * *`（每天 00:05 北京时间）
2. 遍历昨日实例，按类型判定（不写库——终态由查询 API 实时计算）
3. 连续天数更新 → 二期实现
4. Dashboard 可查看 Job 执行历史和状态

---

### 8. Risks / Trade-offs

#### 风险清单

| # | 风险 | 影响 | 可能性 | 缓解措施 |
|---|------|------|:--:|---------|
| R1 | 打卡窗口计算依赖 Event 表 JOIN，高频查询可能产生性能瓶颈 | 中 | 低 | 虚拟实例模式避免了实例预生成开销；Checkin 窗口仅需一次 Event + Checkin + Cancellation 三表查询，索引覆盖（EventId+Date），单次 < 50ms |
| R2 | 结算任务多实例并发执行导致数据不一致 | 高 | 低 | Hangfire Server `WorkerCount=1` 保证单 worker 执行；即使多实例，每个实例的 Hangfire Server 各跑独立 worker pool，Recurring Job 由 Hangfire 内置机制保证同一时刻只有一个实例执行（通过 DB 轮询锁） |
| R3 | 服务器时钟偏差导致结算触发时机不准确 | 低 | 低 | Hangfire Cron 使用配置的时区（`China Standard Time`），服务器 NTP 时间同步 |
| R4 | 撤销与结算竞态（23:59:50 撤销，00:05 结算） | 中 | 低 | CHECK-DO 模式：Checkin 记录物理删除 + 结算时 SELECT 当前状态 = 最终一致。无"中间态"问题。详见时序 6。 |
| R5 | Event 模块未实现时 Checkin 模块无法独立测试 | 高 | 高 | `IEventQueryService` Mock 实现可返回硬编码 Event 数据 |
| R6 | 课后活动"已结束"即时判定与结算任务冲突 | 低 | 低 | 课后活动由查询 API 即时判定，结算任务不做额外处理 |
| R7 | 客户端倒计时不准确（页面切后台后 setInterval 暂停） | 中 | 中 | 小程序 `onShow` 时重新调用窗口查询 API 刷新；`onHide`/`onUnload` 中 `clearInterval` 清除定时器防止内存泄漏（遵循 dev-miniapp-standards） |
| R8 | 打卡按钮交互逻辑复杂 | 低 | 低 | 封装为独立 `checkin-status.js` 工具模块 |
| R9 | Hangfire Dashboard 暴露在生产环境 | 中 | 低 | Dashboard 仅在开发环境开放；生产环境禁用或加 IP 白名单 + Basic Auth |

#### 已知权衡

| 权衡 | 选择 | 代价 |
|------|------|------|
| 虚拟实例模式 vs 预生成实例表 | 虚拟实例（EventId+Date 复合键） | 终态判定需联表查询 |
| 首期结算任务最小化 vs 完整结算 | 最小化：终态查询实时计算，Hangfire Job 仅建骨架 | 二期需在骨架中填充连续更新逻辑 |
| 撤销 = 物理删除 vs 软删除 | 物理删除 Checkin 记录 | 无法追溯撤销历史 |
| Hangfire vs BackgroundService | Hangfire（内置重试 + Dashboard + 持久化存储） | 增加 NuGet 依赖 + 需配置 Dashboard 访问控制 |

---

## Handoff to dev-planning

### 模块到 Task 映射建议

| 模块/Story | 后端 Task | 前端 Task | 集成 Task |
|------------|----------|----------|----------|
| 打卡窗口判定 API | CheckinService、GET /checkin/window 端点、IEventQueryService 接口定义、Event 最小化骨架 | services/checkin.js、event-detail 按钮状态查询 | 联调窗口查询 |
| 打卡执行 API | POST /checkin 端点（幂等处理）、Checkin 实体 + 迁移 | event-detail 打卡按钮交互（四种状态） | 联调打卡全流程 |
| 撤销打卡 API | DELETE /checkin 端点（终态检测） | event-detail 撤销按钮交互 | 联调撤销全流程 |
| 结算任务 | SettlementJob（Hangfire 调度）、HangfireConfiguration（存储 + Dashboard + Cron 注册） | 无 | 验证定时触发 + Dashboard |
| 跨模块接口 | IEventQueryService 接口定义在 Checkin/ 中 | 无 | Event 模块后续实现 |

### 集成 Task 时机

- 打卡窗口查询 API 完成后即可联调（倒计时 + 按钮状态）
- 打卡执行 API 在窗口查询基础上叠加
- 撤销打卡 API 可独立开发
- 结算任务 Hangfire 骨架可在后端 API 完成后独立验证

### 前置依赖

- .NET 10 SDK、PostgreSQL 实例、微信小程序开发者工具
- **关键依赖**：`api/Auth/` 模块的 JWT 中间件就绪
- **关键依赖**：`api/Domain/Entities/Event.cs` 最小化骨架 + Cancellation.cs
- **定时任务依赖**：NuGet 包 Hangfire + Hangfire.Postgres
- **Hangfire 存储**：PostgreSQL（Hangfire 自动建表，无需手动迁移）

### API 接口汇总

| 方法 | 路径 | 用途 | 首期状态 |
|------|------|------|:--:|
| GET | `/api/v1/checkin/window/{eventId}/{date}` | 查询打卡窗口 | 实现 |
| POST | `/api/v1/checkin` | 执行打卡 | 实现 |
| DELETE | `/api/v1/checkin/{eventId}/{date}` | 撤销打卡 | 实现 |

---

## Open Questions

| # | 问题 | 当前状态 | 建议 |
|---|------|---------|------|
| 1 | Event 模块开发时，IEventQueryService 由谁实现？ | Event 模块开发时需实现 | 首期用 Mock 实现 |
| 2 | 首期结算任务是否写库？ | 决策为"不需要"，终态查询实时计算 | 若产品要求 DB 中需有明确终态标记，改为需写库 |
| 3 | 打卡操作来源是否需要更细分？ | 需求已明确 Parent/Child | 已在 Checkin.Source 枚举中定义 |
| 4 | 撤销打卡是否允许家长撤销孩子的打卡？ | 同一家庭成员即可操作 | 权限校验基于家庭隔离 |
