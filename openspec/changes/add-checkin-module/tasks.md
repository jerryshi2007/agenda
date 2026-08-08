## 1. 后端：数据模型与基础设施

- [ ] 1.1 在 `api/Domain/Enums/` 中新建 `EventType.cs` 枚举（AfterSchoolActivity / DailyRoutine / HomeworkTask）
- [ ] 1.2 在 `api/Domain/Enums/` 中新建 `CheckinSource.cs` 枚举（Parent / Child）
- [ ] 1.3 在 `api/Domain/Entities/` 中新建 `Checkin.cs` 实体，字段：Id, EventId, Date, UserId, CheckinAt, Source, CreatedAt
- [ ] 1.4 在 `api/Infrastructure/Data/Configurations/` 中新建 `CheckinConfiguration.cs`，配置 EF Core 映射、UNIQUE (EventId, Date) 约束、索引
- [ ] 1.5 在 `api/Domain/Entities/` 中新建 `Event.cs` 最小化实体（供 Checkin 查询）、新建 `Cancellation.cs` 最小化实体
- [ ] 1.6 扩展 `AppDbContext`，新增 `Checkin`、`Event`、`Cancellation` DbSet
- [ ] 1.7 创建并应用 EF Core 迁移

## 2. 后端：IEventQueryService 接口定义

- [ ] 2.1 在 `api/Checkin/` 中定义 `IEventQueryService` 接口，方法 `GetEventForCheckinAsync(Guid eventId, DateOnly date, CancellationToken ct)`
- [ ] 2.2 在 `api/Checkin/` 中实现 `MockEventQueryService`（硬编码测试数据，供开发阶段使用）

## 3. 后端：打卡窗口查询 API

- [ ] 3.1 在 `api/Checkin/CheckinService.cs` 中实现 `CanCheckinAsync()` ——计算三种类型的打卡窗口状态
- [ ] 3.2 在 `api/Checkin/CheckinService.cs` 中实现 `GetCheckinWindowAsync()` ——返回完整窗口状态 DTO
- [ ] 3.3 实现课后活动即时逾期判定（endTime + 2h 过期）
- [ ] 3.4 实现日常作息/作业任务的日期过期判定
- [ ] 3.5 实现 `GET /api/v1/checkin/window/{eventId}/{date}` 端点（权限校验、家庭隔离）
- [ ] 3.6 在 `Program.cs` 中注册 `ICheckinService` → `CheckinService`，`IEventQueryService` → `MockEventQueryService`

## 4. 后端：打卡执行 API

- [ ] 4.1 实现 `POST /api/v1/checkin` 端点
- [ ] 4.2 实现打卡幂等逻辑（先查后写 + DB UNIQUE 约束）
- [ ] 4.3 实现打卡时间窗口二次校验（服务端最终判定）
- [ ] 4.4 添加 FluentValidation 校验（eventId 必填、date 必填且不能是未来日期）

## 5. 后端：撤销打卡 API

- [ ] 5.1 实现 `DELETE /api/v1/checkin/{eventId}/{date}` 端点
- [ ] 5.2 实现撤销条件校验（终态检测、窗口检测、Checkin 存在检测）
- [ ] 5.3 实现物理删除 Checkin 记录、返回撤销后的状态

## 6. 后端：结算任务（Hangfire 定时调度）

- [ ] 6.1 添加 NuGet 包依赖：`Hangfire`、`Hangfire.Postgres`
- [ ] 6.2 在 `api/Infrastructure/Hangfire/HangfireConfiguration.cs` 中配置 Hangfire（PostgreSQL 存储、WorkerCount=1、Dashboard 访问控制）
- [ ] 6.3 在 `api/Infrastructure/Jobs/SettlementJob.cs` 中创建结算 Job（`[AutomaticRetry(Attempts=3)]`，按孩子分组事务处理）
- [ ] 6.4 在 `Program.cs` 中调用 `ConfigureHangfire()` 和 `ScheduleRecurringJobs()`，注册 Recurring Job（Cron `5 0 * * *`，时区 `China Standard Time`）
- [ ] 6.5 首期仅建立 Hangfire 骨架 + 业务逻辑验证性遍历，终态由查询 API 实时计算，连续天数更新留到二期

## 7. 前端：打卡 API 封装

- [ ] 7.1 在 `app/services/checkin.js` 中封装 `getCheckinWindow(eventId, date)`
- [ ] 7.2 在 `app/services/checkin.js` 中封装 `doCheckin(eventId, date)`
- [ ] 7.3 在 `app/services/checkin.js` 中封装 `undoCheckin(eventId, date)`

## 8. 前端：日程详情页打卡按钮增强

- [ ] 8.1 在 `pages/event-detail/index.js` 中实现窗口状态查询（onShow 时调用 getCheckinWindow）
- [ ] 8.2 实现按钮状态机（可点击 / 灰色倒计时 / 撤销打卡 / 不显示）
- [ ] 8.3 实现倒计时逻辑（每 30s 递减 remainingSeconds，归零后刷新窗口）
- [ ] 8.4 实现打卡按钮点击处理（调用 doCheckin + 刷新状态）
- [ ] 8.5 实现撤销按钮点击处理（调用 undoCheckin + 刷新状态）
- [ ] 8.6 更新按钮区域的 WXML 条件渲染（wx:if 控制按钮显隐和文案）
- [ ] 8.7 添加 data-id 属性（checkin-btn、undo-btn、countdown、status 文本等）

## 9. 集成与测试

- [ ] 9.1 前后端联调：打卡窗口查询（正常/提前/逾期/终态四种场景）
- [ ] 9.2 前后端联调：打卡执行（正常打卡 + 幂等打卡）
- [ ] 9.3 前后端联调：撤销打卡（正常撤销 + 终态阻止）
- [ ] 9.4 前后端联调：撤销与结算竞态（模拟时间）
- [ ] 9.5 验证 Hangfire Dashboard 可访问、Recurring Job 定时触发、失败自动重试
- [ ] 9.6 验证打卡响应时间 <= 1s
