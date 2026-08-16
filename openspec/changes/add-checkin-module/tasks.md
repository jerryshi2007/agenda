# Tasks: 打卡与统计模块 (add-checkin-module)

> Change: `add-checkin-module` | Story: CHK-ST-01 | Date: 2026-08-16（B1/B2/B3 修复版）

---

## 总览

| 维度 | 值 |
|------|-----|
| 覆盖 US | CHK-01~06, CHK-26, CHK-27（8 个 Must） |
| 预估总工时 | 3.5 个工作日 |
| 依赖 | auth-module（JWT 中间件）、Schedule 模块（已落地：Schedule/Cancellation/TimeSlot/ScheduleDateExclusion 实体 + `IScheduleQueryService` 接口 + `ScheduleQueryService` 实现） |

### 依赖关系

```
1.数据模型 ──→ 2.复用 IScheduleQueryService(DI) ──→ 3.窗口查询API ──→ 4.打卡API
                 │                         │                  │
                 └──→ 6.结算任务           ├──→ 5.撤销API     │
                                           │                  │
                                           7.前端封装 ←───────┘
                                               │
                                               8.前端按钮增强
                                                  │
                                                  9.集成测试
```

---

## 1. 后端：数据模型与基础设施

**预估工时**：0.5d | **依赖**：auth-module 项目骨架

- [ ] **1.1** `CheckinSource.cs` + `StreakScope.cs` 枚举
  路径：`api/Domain/Enums/CheckinSource.cs`, `api/Domain/Enums/StreakScope.cs`
  内容：`CheckinSource { Parent, Child }`；`StreakScope { Schedule = 1, Child = 2 }`
  验证：编译通过；枚举值与 design.md §3 实体定义一致

- [ ] **1.2** `Checkin.cs` 实体
  路径：`api/Domain/Entities/Checkin.cs`
  字段：`Id (long, PK)`, `ScheduleId (Guid, NOT NULL)`, `Date (DateOnly, NOT NULL)`, `UserId (Guid, NOT NULL)`, `CheckinAt (DateTimeOffset, NOT NULL)`, `Source (CheckinSource, NOT NULL)`, `CreatedAt (DateTimeOffset, NOT NULL)`
  验证：编译通过；字段与 design.md §3 ER 一致；无 Status/IsDeleted 字段

- [ ] **1.3** `CheckinSettlement.cs` + `Streak.cs` 实体
  路径：`api/Domain/Entities/CheckinSettlement.cs`, `api/Domain/Entities/Streak.cs`
  内容：
  - `CheckinSettlement`：`Id (long, PK)`, `ScheduleId (Guid, NOT NULL)`, `Date (DateOnly, NOT NULL)`, `Status (ScheduleStatus, NOT NULL)`, `SettledAt (DateTimeOffset, NOT NULL)`
  - `Streak`：`Id (long, PK)`, `Scope (StreakScope, NOT NULL)`, `SubjectId (Guid, NOT NULL)`, `CurrentStreak (int, NOT NULL)`, `LastSettledDate (DateOnly?)`, `UpdatedAt (DateTimeOffset, NOT NULL)`
  验证：编译通过；字段与 design.md §3 实体定义一致

- [ ] **1.4** EF Core 配置类
  路径：`api/Infrastructure/Data/Configurations/CheckinConfiguration.cs`, `api/Infrastructure/Data/Configurations/CheckinSettlementConfiguration.cs`, `api/Infrastructure/Data/Configurations/StreakConfiguration.cs`
  内容：
  - `CheckinConfiguration`：`.ToTable("CheckinRecords")`（对齐 `AnonymizationService.AnonymizeCheckinRecordsAsync` 引用的表名）、`UNIQUE(ScheduleId, Date)`、索引 `(ScheduleId, Date)`、索引 `(UserId)`
  - `CheckinSettlementConfiguration`：`.ToTable("CheckinSettlements")`、`UNIQUE(ScheduleId, Date)`、索引 `(ScheduleId, Date)`
  - `StreakConfiguration`：`.ToTable("Streaks")`、`UNIQUE(Scope, SubjectId)`
  验证：迁移生成后 DB 中存在对应表/约束/索引

- [ ] **1.5** 扩展 `AppDbContext`
  路径：`api/Infrastructure/Data/AppDbContext.cs`
  内容：仅新增 `DbSet<Checkin> Checkins`、`DbSet<CheckinSettlement> CheckinSettlements`、`DbSet<Streak> Streaks`（Schedule/Cancellation/TimeSlot/ScheduleDateExclusion 等 DbSet 已存在，勿重复添加）
  验证：编译通过

- [ ] **1.6** 创建并应用 EF Core 迁移
  命令：`dotnet ef migrations add AddCheckin` → `dotnet ef database update`
  验证：DB 中 `CheckinRecords`/`CheckinSettlements`/`Streaks` 表存在，UNIQUE 约束和索引已创建

---

## 2. 后端：复用 IScheduleQueryService（DI 注册）

**预估工时**：0.1d | **依赖**：任务 1 完成

> `IScheduleQueryService`（`api/Domain/Interfaces/IScheduleQueryService.cs`）及实现 `ScheduleQueryService`（`api/Schedule/Services/ScheduleQueryService.cs`）已存在（ADR-017 依赖反转），5 个方法 `GetScheduleAsync`/`GetTimeSlotAsync`/`GetCancellationStatusAsync`/`IsDateExcludedAsync`/`GetDueDateAsync` 恰好覆盖打卡窗口判定。**不新建接口、不建 Mock**，仅做 DI 注册。

- [ ] **2.1** DI 注册
  位置：`Program.cs`
  内容：`services.AddScoped<IScheduleQueryService, ScheduleQueryService>()`、`services.AddScoped<ICheckinService, CheckinService>()`
  验证：应用启动无 DI 解析异常；`codegraph explore` 确认 `ScheduleQueryService` 已注册为 `IScheduleQueryService` 实现

---

## 3. 后端：打卡窗口查询 API

**预估工时**：0.5d | **依赖**：任务 2 完成

- [ ] **3.1** `CheckinService.GetCheckinWindowAsync()`
  路径：`api/Checkin/CheckinService.cs`
  实现：注入 `IScheduleQueryService` → 按 design.md §3 五步状态推导（step 1 查 Checkin → step 2 查 Cancellation/Exclusion 合并 cancelled → step 3 查 CheckinSettlement → step 4 课后活动 endTime+2h 即时逾期 → step 5 默认"进行中"）→ 返回 `CheckinWindowResponse`
  验证：单元测试覆盖 6 种状态（未完成/已完成/已取消/已结束/未完成终态/逾期未完成）

- [ ] **3.2** 课后活动即时逾期判定
  位置：`CheckinService` 内联逻辑
  规则：`serverTime > endTime + 2h` 且无 Checkin → status=ended（endTime 经 `IScheduleQueryService.GetTimeSlotAsync` 按 `date.DayOfWeek` 取 TimeSlot.EndTime，非扁平字段）
  验证：单元测试：当前时间 = 19:01, endTime=17:00 → ended

- [ ] **3.3** 日常作息/作业任务逾期判定（含结算记录查询）
  位置：`CheckinService` 内联逻辑
  规则：查 `CheckinSettlement` 存在 → 终态（Status=Ended/Overdue/Incomplete）；日常作息 `date < today` 且无 Checkin 且无结算记录 → 终态"未完成"；作业任务 `dueDate < today` 且无 Checkin 且无结算记录 → "逾期未完成"
  验证：单元测试覆盖两种过期场景 + 结算记录命中场景

- [ ] **3.4** 提前打卡窗口判定
  位置：`CheckinService` 内联逻辑
  规则：`serverTime >= startTime - 30min` → canCheckin=true；`serverTime < startTime - 30min` → canCheckin=false, reason=EARLY, remainingSeconds
  验证：单元测试：startTime=16:00, serverTime=15:31 → canCheckin=true；serverTime=15:29 → canCheckin=false

- [ ] **3.5** `GET /api/v1/checkin/window/{scheduleId}/{date}` 端点
  路径：`api/Checkin/CheckinController.cs`
  认证：`[Authorize]` + JWT
  权限：校验当前用户是否为 Schedule 所属家庭成员（403 `NOT_FAMILY_MEMBER` 否则）
  响应 shape：`{ scheduleId, date, canCheckin, canUndo, reason, remainingSeconds, status, statusLabel, serverTime }`
  **status 枚举**：incomplete, completed, cancelled, ended, overdue（excluded 合并入 cancelled，不单独暴露）
  验证：集成测试覆盖 6 种响应变体

---

## 4. 后端：打卡执行 API

**预估工时**：0.3d | **依赖**：任务 3 完成

- [ ] **4.1** `POST /api/v1/checkin` 端点
  路径：`api/Checkin/CheckinController.cs`
  Request：`{ scheduleId: Guid, date: DateOnly }`
  Response (成功)：`{ checkinId, scheduleId, date, checkinAt, source }`
  Response (幂等)：`{ checkinId, scheduleId, date, alreadyCheckedIn: true, checkinAt }`
  认证：`[Authorize]` + JWT
  权限：校验家庭成员身份（403 `NOT_FAMILY_MEMBER` 否则）

- [ ] **4.2** 打卡幂等逻辑
  位置：`CheckinService`
  实现：SELECT 查 Checkin → 存在则返回 alreadyCheckedIn=true（200 OK，非 409）；不存在 → INSERT + DB UNIQUE 约束兜底
  验证：并发测试：两请求同时打卡，均返回 200，仅创建一条记录

- [ ] **4.3** 打卡时间窗口二次校验
  位置：`CheckinService` —— 服务端以 `DateTimeOffset.UtcNow` 转北京时间为准
  规则：调用 `GetCheckinWindowAsync()` → canCheckin=false 时返回 400 `CHECKIN_WINDOW_CLOSED` 或 `TERMINAL_STATE`；日程已取消/排除返回 400 `SCHEDULE_CANCELLED`
  验证：单元测试：窗口关闭时 POST 返回 400

- [ ] **4.4** FluentValidation 校验
  路径：`api/Checkin/Validators/CheckinRequestValidator.cs`
  规则：`scheduleId` 非空, `date` 非空且不能是未来日期（> today）
  验证：单元测试：空 scheduleId → 400；未来日期 → 400

---

## 5. 后端：撤销打卡 API

**预估工时**：0.2d | **依赖**：任务 4 完成

- [ ] **5.1** `DELETE /api/v1/checkin/{scheduleId}/{date}` 端点
  路径：`api/Checkin/CheckinController.cs`
  Response (成功)：`{ scheduleId, date, undone: true, status: "incomplete" }`
  认证：`[Authorize]` + JWT
  权限：同一家庭成员可撤销（含家长撤销孩子打卡）

- [ ] **5.2** 撤销条件校验
  位置：`CheckinService`
  规则：
  ① Checkin 不存在 → 400 `NOT_CHECKED_IN`
  ② 实例为终态（CheckinSettlement 存在或 date < today）→ 400 `TERMINAL_STATE`
  ③ 课后活动 endTime+2h < serverTime → 400 `WINDOW_CLOSED`
  验证：单元测试覆盖三种拒绝场景

- [ ] **5.3** 撤销执行
  位置：`CheckinService`
  实现：物理 DELETE Checkin 记录 → 返回 undone:true + status:"incomplete"
  验证：撤销后可立即重新 POST 打卡（窗口仍开放时）

---

## 6. 后端：结算任务（Hangfire 定时调度 + 写库）

**预估工时**：0.6d | **依赖**：任务 2 完成（可与任务 3-5 并行）

- [ ] **6.1** NuGet 包安装
  包：`Hangfire.Core`, `Hangfire.Postgres`
  验证：`dotnet list package` 确认版本安装

- [ ] **6.2** `HangfireConfiguration.cs`
  路径：`api/Infrastructure/Hangfire/HangfireConfiguration.cs`
  内容：
  - `AddHangfire(cfg => cfg.UsePostgreSqlStorage(connStr))`
  - `AddHangfireServer(opt => opt.WorkerCount = 1)` —— 单 worker 防并发
  - Dashboard 仅在 Development 环境启用；生产环境加 IP 白名单或禁用（R9 缓解）
  验证：应用启动后 `/hangfire` Dashboard 可访问（开发环境）

- [ ] **6.3** `SettlementJob.cs`（写库完整实现）
  路径：`api/Infrastructure/Jobs/SettlementJob.cs`
  属性：`[AutomaticRetry(Attempts = 3, OnAttemptsExceeded = AttemptsExceededAction.Fail)]`
  实现（对齐 spec `Daily Settlement Execution / Idempotency / Error Recovery / Concurrent Safety / Streak Update`）：
  1. 查询昨日适用的未删除 Schedule（HomeworkTask 按 `DueDate == yesterday`；其余按 `TimeSlots.Any(t => t.DayOfWeek == yesterday.DayOfWeek)`）
  2. 按 `AssignedChildId` 分组，per-child 事务（`BeginTransactionAsync`）
  3. 对每个 (schedule, date)：跳过已打卡（Checkin 存在）、跳过已取消/排除（`IScheduleQueryService` 判定）；计算终态（课后活动→Ended / 日常作息→Incomplete / 作业任务→Overdue）；INSERT `CheckinSettlement`（`UNIQUE(ScheduleId, Date)` + 插入前查重幂等）
  4. 对日常作息 upsert `Streak`（单日程 + 孩子整体，`LastSettledDate` 防重复累加）
  验证：Dashboard 手动触发 Job，DB 中 `CheckinSettlements`/`Streaks` 记录正确；重复触发不产生重复/变更（幂等）

- [ ] **6.4** Recurring Job 注册
  位置：`Program.cs` 中 `ScheduleRecurringJobs()`
  内容：`RecurringJob.AddOrUpdate<SettlementJob>("daily-settlement", job => job.ExecuteAsync(default), "5 0 * * *", new RecurringJobOptions { TimeZone = TimeZoneInfo.FindSystemTimeZoneById("China Standard Time") })`
  验证：Hangfire Dashboard Recurring Jobs 页可见"daily-settlement"，NextExecution 为当天 00:05 CST

- [ ] **6.5** 首期结算范围说明
  当前实现：Hangfire 调度 + 写库 `CheckinSettlement`（未打卡→终态 transition 落盘）+ 幂等 + 错误重试（per-child 事务）+ 并发安全（只处理昨天）+ streak 数据写库 `Streak`
  连续天数前端展示（家长看板/孩子统计页 CHK-07/08/09）留二期，本阶段仅持久化 streak 数据
  验证：Job 执行无异常，Dashboard 显示 Success；重复触发幂等

---

## 7. 前端：打卡 API 封装

**预估工时**：0.1d | **依赖**：任务 3-5 API 完成

> `services/checkin.js` 已存在 stub，方法名 `getWindow/checkin/undo/getRecords` 统一保留（前端内部实现非契约），仅需对齐端点路径。

- [ ] **7.1** `services/checkin.js` — getWindow
  路径：`app/services/checkin.js`
  方法：`getWindow(scheduleId, date)` → `GET /api/v1/checkin/window/{scheduleId}/{date}`
  返回：窗口状态响应 JSON
  错误处理：复用 `services/api.js` 统一拦截器（401 续期 / 网络错误 Toast）

- [ ] **7.2** `services/checkin.js` — checkin
  方法：`checkin(scheduleId, date)` → `POST /api/v1/checkin`
  处理幂等响应：`alreadyCheckedIn: true` 时同样视为成功

- [ ] **7.3** `services/checkin.js` — undo
  方法：`undo(scheduleId, date)` → `DELETE /api/v1/checkin/{scheduleId}/{date}`（路径参数形式）
  错误映射：`TERMINAL_STATE` → "已结算，不可撤销"；`NOT_CHECKED_IN` → "无打卡记录"

---

## 8. 前端：日程详情页打卡按钮增强

**预估工时**：0.5d | **依赖**：任务 7 完成、`pages/schedule-detail/` 页面存在

- [ ] **8.1** 窗口状态查询
  位置：`pages/schedule-detail/index.js` — `onShow()` / `onLoad()`
  实现：从 URL 参数获取 `scheduleId` + `date` → 调用 `getWindow` → 更新 data
  验证：页面打开后按钮状态与 API 返回一致

- [ ] **8.2** 按钮状态机
  实现规则：
  | 条件 | 按钮显示 | 可点击 |
  |------|---------|:--:|
  | canCheckin=true, canUndo=false | 打卡按钮 | ✓ |
  | canCheckin=false, reason=EARLY | 打卡按钮 + 倒计时 | ✗（灰色） |
  | canCheckin=false, canUndo=true | 撤销打卡按钮 | ✓（学龄前除外） |
  | status in {ended, overdue, cancelled} | 仅状态文本 | — |
  验证：每种状态的 UI 表现正确

- [ ] **8.3** 展示模式控制
  学龄前模式：不显示撤销按钮（`module-display-mode.md` 决策 #6）
  小学/高年级模式：canUndo=true 时显示撤销按钮
  实现：从全局状态或页面参数读取展示模式 → 条件渲染

- [ ] **8.4** 倒计时逻辑 + 生命周期管理
  实现：`setInterval` 每 30s 递减 `remainingSeconds`，归零后重新调用 `getWindow` 刷新
  **生命周期管理**（遵循 `dev-miniapp-standards`）：
  - `onShow()`：重新调 `GET /checkin/window` 获取最新状态，若 `remainingSeconds > 0` 则 `setInterval` 启动倒计时
  - `onHide()`：`clearInterval(this._countdownTimer)`
  - `onUnload()`：`clearInterval(this._countdownTimer)`
  验证：切后台再回前台，状态刷新且倒计时重启；离开页面后无定时器泄漏

- [ ] **8.5** 打卡按钮点击
  `onCheckinTap()` → 调用 `checkin` → Toast "打卡成功" → 刷新窗口 → 按钮切换为"撤销打卡"

- [ ] **8.6** 撤销按钮点击
  `onUndoTap()` → 调用 `undo` → Toast "已撤销" → 刷新窗口 → 按钮切换为"打卡确认"

- [ ] **8.7** WXML 条件渲染
  `wx:if="{{canCheckin && !isEarly}}"` → 可点击打卡按钮
  `wx:if="{{isEarly}}"` → 灰色倒计时按钮
  `wx:if="{{canUndo && !isPreschoolMode}}"` → 撤销按钮
  `wx:if="{{isTerminal}}"` → 仅状态文本

- [ ] **8.8** data-id 属性
  按设计文档 data-id 速查表添加完整标识（页面目录为 `schedule-detail`，前缀 `schedule-detail-*`）：

  | 元素 | data-id |
  |------|---------|
  | 打卡按钮（可点击） | `schedule-detail-checkin-btn` |
  | 打卡按钮（灰色禁用） | `schedule-detail-checkin-btn-disabled` |
  | 撤销按钮 | `schedule-detail-undo-btn` |
  | 倒计时文本 | `schedule-detail-checkin-countdown` |
  | 已完成状态 | `schedule-detail-status-completed` |
  | 已结束状态 | `schedule-detail-status-ended` |
  | 未完成状态 | `schedule-detail-status-incomplete` |
  | 逾期状态 | `schedule-detail-status-overdue` |
  | 已取消状态 | `schedule-detail-status-cancelled` |
  | 打卡 loading | `schedule-detail-checkin-loading` |
  | 打卡错误 | `schedule-detail-checkin-error` |

  验证：通过 `data-id` 可唯一定位每个交互元素

---

## 9. 集成与测试

**预估工时**：0.4d | **依赖**：所有前后端任务完成

- [ ] **9.1** 联调：打卡窗口查询
  场景：正常窗口 / 提前窗口未开放 / 课后活动逾期 / 日常作息终态 / 作业逾期 / 已完成
  验证：每种场景返回的 `canCheckin/canUndo/status/statusLabel` 与需求一致

- [ ] **9.2** 联调：打卡执行
  场景：正常打卡（成功） / 幂等打卡（alreadyCheckedIn） / 窗口关闭拒绝 / 终态拒绝
  验证：打卡后刷新窗口显示 canUndo=true

- [ ] **9.3** 联调：撤销打卡
  场景：正常撤销 / 终态阻止 / 未打卡阻止
  验证：撤销后刷新窗口显示 canCheckin=true

- [ ] **9.4** 联调：撤销与结算竞态
  场景：模拟 23:59:50 撤销 → 手动触发结算 Job → 结算写库 `CheckinSettlement(Status=Incomplete)` → 以撤销后状态为准
  验证：结算后状态为"未完成"（终态），`CheckinSettlements` 落盘

- [ ] **9.5** 验证 Hangfire 结算写库
  验证项：Dashboard 可访问、Recurring Job 已注册、手动触发执行成功、`CheckinSettlements`/`Streaks` 记录正确、重复触发幂等、Job History 可见

- [ ] **9.6** 性能验证
  指标：打卡 API 响应时间 ≤ 1s（`CLAUDE.md` 性能底线）
  验证：通过 API 测试工具测量并记录
