# Test Plan: 打卡与统计模块首期 (add-checkin-module)

> Change: `add-checkin-module` | Story: CHK-ST-01 | Stage: Stage 4 (测试) | Date: 2026-08-16
>
> 下游：test-writer | 覆盖范围：E2E（**API 级**，Playwright `request` fixture 直连 .NET Web API + PostgreSQL，无浏览器项目）
>
> 覆盖 US：CHK-01~06（时间窗口/逾期判定）、CHK-26（每日结算）、CHK-27（撤销与时序/竞态）；边界 BE-05/06/08/15/18/20/21。

---

## 1. 测试策略总览

### 1.1 E2E 定位（API 级）

本项目 E2E 为 **API 级测试**：Playwright 的 `request` fixture 直连后端 `.NET 10 Web API`，通过 `Authorization: Bearer <jwt>` 与 JSON 请求体驱动真实后端，无浏览器项目（见 `testing/e2e/playwright.config.js` 的 `projects: [{ name: 'api-tests' }]`）。打卡模块的 3 个端点 + 结算任务均在覆盖范围内：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/checkin/window/{scheduleId}/{date}` | GET | 窗口查询（5 种 status + EARLY reason） |
| `/api/v1/checkin` | POST | 打卡执行（幂等 / 窗口关闭 / 取消 / 终态拒绝） |
| `/api/v1/checkin/{scheduleId}/{date}` | DELETE | 撤销打卡（三种拒绝） |
| `SettlementJob`（Hangfire 每日 00:05 CST） | 定时任务 | 结算写库 + streak 持久化（手动触发） |

### 1.2 与单元测试 / 小程序测试的分工

| 关注点 | 覆盖方式 | 说明 |
|--------|---------|------|
| 后端服务层逻辑（CheckinService 6 种状态推导、幂等、Undo 条件） | `.NET` 单元测试（`api/Checkin/__tests__/CheckinServiceTests.cs`） | 已随 Stage 3 完成 |
| 结算任务逻辑（终态推导、幂等、streak 更新、per-child 事务） | `.NET` 单元测试（`api/Infrastructure/Jobs/__tests__/SettlementJobTests.cs`） | 已随 Stage 3 完成 |
| **HTTP 契约、错误码、状态码、鉴权、DB 写库、幂等、结算竞态** | **本 E2E（Playwright API 级 + 直连 DB 断言）** | 本计划产出 |
| 小程序前端 UI（按钮状态机、倒计时、撤销显隐、data-id） | `dev-miniapp-tdd`（Jest + miniprogram-simulate） | 不属于 E2E |

**结论**：E2E 只验证「API 行为 + DB 副作用是否与契约/需求一致」，不验证小程序 UI。`data-id` 定位契约由小程序 Jest 测试消费，E2E 不涉及（详见 §4）。

### 1.3 方法（test-case-design skill）

- **等价类划分**：对 `CheckinStatus` 的 5 个状态（incomplete/completed/cancelled/ended/overdue）+ EARLY reason 各选代表用例；POST 拒绝路径按「窗口关闭 / 取消 / 终态 / 不存在 / 无权限 / 未鉴权」划分。
- **边界值**：提前 30 分钟窗口（`startTime-30min` 的前后）、课后活动 `endTime+2h` 逾期线、日常作息/作业任务「当天 24:00 / 次日 00:01」终态线、未来日期（`date > today`）拒绝。
- **错误路径**：鉴权失败（401）、越权（403 NOT_FAMILY_MEMBER）、不存在（404）、并发重复打卡（BE-05）、撤销 vs 结算竞态（BE-20）。
- **去冗余**：三种类型「终态拒绝 POST」是同一等价类，用日常作息为代表（`TERMINAL_STATE`），课后活动/作业的终态拒绝各保留一条 Should 以覆盖不同类型推导路径；`source=Parent` 与 `source=Child` 同属「来源枚举」等价类，保留 Child 为代表 + Parent 一条补充。
- **优先级**：Must（核心/阻塞）/ Should（边界/降级）/ Could（低频/边缘）。

### 1.4 优先级定义

| 级别 | 含义 | 对应需求优先级 |
|:--:|------|------|
| Must | 核心路径与安全底线——失败则打卡/结算不可用或鉴权失效 | requirement.md Must |
| Should | 边界/异常/降级路径 | requirement.md Should / 边界异常 |
| Could | 低频/边缘（全部取消的 streak 不变等） | requirement.md Could |

---

## 2. 测试矩阵

> 预期错误码统一标注为 `openspec/contracts/checkin/errors.json` 的键名（如 `TERMINAL_STATE`），测试代码 MUST 通过 §3.4 方式引用，禁止硬编码字符串。
>
> 状态值引用 `enums.json` 的 `CheckinStatus`（incomplete/completed/cancelled/ended/overdue）；`reason` 取值 `EARLY`/`TERMINAL_STATE`（见 §6.3 观察 O1）。
>
> 标记 `⚠️ DB-SEED` 的用例需直接写 DB（见 §3.3），不走 HTTP API 造数据；非「不可达」，仅数据准备方式不同。

### 2.A 打卡窗口查询 `GET /api/v1/checkin/window/{scheduleId}/{date}`

> 数据锚点：`FIX_*` 见 §3.2。窗口查询允许查询未来日期（用于确定性的 EARLY 断言）。

| ID | 场景 | Given（前置） | When（操作） | Then（预期状态码/错误码/字段） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-CHK-WIN-001 | 开放窗口查询返回 incomplete 可打卡 | `FIX_ACTIVITY_TODAY_OPEN`（今天、startTime 00:00） | `GET window/{id}/{today}` | 200；`canCheckin=true`、`canUndo=false`、`reason=null`、`status="incomplete"`、`statusLabel="未完成"`、`serverTime` 为北京时间 ISO 8601 | Must |
| TC-CHK-WIN-002 | 提前窗口未开放返回 EARLY + 剩余秒数 | `FIX_ACTIVITY_FUTURE_EARLY`（明天 startTime 16:00） | `GET window/{id}/{tomorrow}` | 200；`canCheckin=false`、`reason="EARLY"`、`remainingSeconds>0`、`status="incomplete"` | Must |
| TC-CHK-WIN-003 | 已完成查询返回 completed 且可撤销 | 今天打卡成功 | `GET window/{id}/{today}` | 200；`canCheckin=false`、`canUndo=true`、`status="completed"`、`statusLabel="已完成"` | Must |
| TC-CHK-WIN-004 | 已取消查询返回 cancelled | `cancelInstance` 取消今天实例 | `GET window/{id}/{today}` | 200；`canCheckin=false`、`canUndo=false`、`status="cancelled"`、`reason="TERMINAL_STATE"` | Must |
| TC-CHK-WIN-005 | 课后活动逾期（date<today）返回 ended | `FIX_ACTIVITY_YESTERDAY`（昨天 weekday） | `GET window/{id}/{yesterday}` | 200；`status="ended"`、`canCheckin=false`、`reason="TERMINAL_STATE"`、`statusLabel="已结束"` | Must |
| TC-CHK-WIN-006 | 课后活动即时逾期（今天 endTime+2h 已过）返回 ended | 今天活动、`endTime=00:00` | `GET window/{id}/{today}` | 200；`status="ended"`（**需 now>02:00 CST**，见 §6 R5） | Should |
| TC-CHK-WIN-007 | 日常作息过期（date<today）返回 incomplete 终态 | `FIX_ROUTINE_YESTERDAY` | `GET window/{id}/{yesterday}` | 200；`status="incomplete"`、`canCheckin=false`、`reason="TERMINAL_STATE"`（终态，与开放窗口同 status 但 canCheckin=false） | Must |
| TC-CHK-WIN-008 | 作业任务逾期（dueDate<today）返回 overdue | `FIX_HOMEWORK_YESTERDAY`（⚠️ DB-SEED，见 §3.3） | `GET window/{id}/{yesterday}` | 200；`status="overdue"`、`canCheckin=false`、`reason="TERMINAL_STATE"`、`statusLabel="逾期未完成"` | Must |
| TC-CHK-WIN-009 | 窗口查询日程不存在返回 404 | 随机 GUID | `GET window/{randomGuid}/{today}` | 404 `SCHEDULE_NOT_FOUND` | Must |
| TC-CHK-WIN-010 | 窗口查询非家庭成员返回 403 | `OUTSIDER` JWT | `GET window/{id}/{today}` | 403 `NOT_FAMILY_MEMBER` | Must |
| TC-CHK-WIN-011 | 窗口查询未鉴权返回 401 | 无 Authorization | `GET window/{id}/{today}` | 401（错误信封以鉴权中间件为准，复用 auth 模块 401 断言模式） | Must |
| TC-CHK-WIN-012 | 日常作息当天 24:00 前仍可打卡（无 endTime+2h 限制） | `FIX_ROUTINE_TODAY_ENDED_EARLY`（今天、endTime 00:30 已过） | `GET window/{id}/{today}` | 200；`canCheckin=true`（区分于课后活动的即时逾期） | Should |

### 2.B 打卡执行 `POST /api/v1/checkin`

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-CHK-POST-001 | 正常打卡成功 | `FIX_ACTIVITY_TODAY_OPEN` | `POST /checkin` body=`{scheduleId, date:today}` | 200；`checkinId`(long)、`scheduleId`、`date`、`checkinAt`(ISO)、`source="Parent"`；`alreadyCheckedIn` 缺省；DB `CheckinRecords` 新增 1 行 | Must |
| TC-CHK-POST-002 | 孩子自打 source=Child | `FIX_ACTIVITY_TODAY_OPEN`，`AUTH.CHILD_1` | `POST /checkin` | 200；`source="Child"` | Must |
| TC-CHK-POST-003 | 家长代打 source=Parent | `FIX_ACTIVITY_TODAY_OPEN`，`AUTH.PARENT_A` | `POST /checkin` | 200；`source="Parent"` | Should |
| TC-CHK-POST-004 | 幂等重复打卡 | 已打卡成功 | 再次 `POST /checkin` | 200；`alreadyCheckedIn=true`、`checkinId` 与首次相同；DB `CheckinRecords` 仍 1 行 | Must |
| TC-CHK-POST-005 | 并发同时打卡仅一条记录（BE-05） | 未打卡 | `Promise.all` 两次 `POST` | 两次均 200（一次 fresh + 一次 `alreadyCheckedIn=true`）；DB `CheckinRecords` 仅 1 行 | Should |
| TC-CHK-POST-006 | 提前窗口未开放拒绝 | `FIX_ACTIVITY_TODAY_EARLY`（今天 startTime 23:59） | `POST /checkin` date=today | 400 `CHECKIN_WINDOW_CLOSED`（**需 now<23:29 CST**，见 §6 R5） | Must |
| TC-CHK-POST-007 | 已取消拒绝打卡 | `cancelInstance` 今天实例 | `POST /checkin` date=today | 400 `SCHEDULE_CANCELLED` | Must |
| TC-CHK-POST-008 | 终态拒绝（日常作息过期） | `FIX_ROUTINE_YESTERDAY` | `POST /checkin` date=yesterday | 400 `TERMINAL_STATE` | Must |
| TC-CHK-POST-009 | 终态拒绝（课后活动 ended） | `FIX_ACTIVITY_YESTERDAY` | `POST /checkin` date=yesterday | 400 `TERMINAL_STATE` | Should |
| TC-CHK-POST-010 | 终态拒绝（作业逾期） | `FIX_HOMEWORK_YESTERDAY`（⚠️ DB-SEED） | `POST /checkin` date=yesterday | 400 `TERMINAL_STATE` | Should |
| TC-CHK-POST-011 | 未来日期拒绝 | `FIX_ACTIVITY_TODAY_OPEN` | `POST /checkin` date=tomorrow | 400（验证器复用 `CHECKIN_WINDOW_CLOSED`，见 §6.3 O3） | Should |
| TC-CHK-POST-012 | 空 scheduleId 拒绝 | 无 | `POST /checkin` body=`{scheduleId:null, date:today}` | 400（验证器，同上） | Should |
| TC-CHK-POST-013 | 打卡日程不存在 | 随机 GUID | `POST /checkin` body=`{scheduleId:random, date:today}` | 404 `SCHEDULE_NOT_FOUND` | Must |
| TC-CHK-POST-014 | 打卡非家庭成员 | `OUTSIDER` JWT | `POST /checkin` | 403 `NOT_FAMILY_MEMBER` | Must |
| TC-CHK-POST-015 | 打卡未鉴权 | 无 Authorization | `POST /checkin` | 401（复用 auth 401 断言模式） | Must |

### 2.C 撤销打卡 `DELETE /api/v1/checkin/{scheduleId}/{date}`

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-CHK-UNDO-001 | 正常撤销 | 今天打卡成功（窗口开放） | `DELETE /checkin/{id}/{today}` | 200；`undone=true`、`status="incomplete"`；DB `CheckinRecords` 该行删除 | Must |
| TC-CHK-UNDO-002 | 撤销后窗口内可重新打卡 | 已撤销（UNDO-001 后） | 再次 `POST /checkin` | 200；新 `checkinId`（受时间窗口约束） | Must |
| TC-CHK-UNDO-003 | 未打卡撤销拒绝 | 未打卡 | `DELETE /checkin/{id}/{today}` | 400 `NOT_CHECKED_IN` | Must |
| TC-CHK-UNDO-004 | 终态撤销拒绝（结算记录存在） | ⚠️ DB-SEED：`CheckinRecords` + `CheckinSettlements`(今天) | `DELETE /checkin/{id}/{today}` | 400 `TERMINAL_STATE`（结算记录分支，见 §6.3） | Should |
| TC-CHK-UNDO-005 | 终态撤销拒绝（date<today） | `FIX_ROUTINE_YESTERDAY` + DB-SEED 昨天 Checkin | `DELETE /checkin/{id}/{yesterday}` | 400 `TERMINAL_STATE` | Must |
| TC-CHK-UNDO-006 | 课后活动逾期撤销拒绝（WINDOW_CLOSED） | 今天活动 endTime=00:00 已打卡 | `DELETE /checkin/{id}/{today}` | 400 `WINDOW_CLOSED`（**需 now>02:00 CST**，见 §6 R5） | Should |
| TC-CHK-UNDO-007 | 撤销日程不存在 | 随机 GUID | `DELETE /checkin/{random}/{today}` | 404 `SCHEDULE_NOT_FOUND` | Must |
| TC-CHK-UNDO-008 | 撤销非家庭成员 | `OUTSIDER` JWT | `DELETE /checkin/{id}/{today}` | 403 `NOT_FAMILY_MEMBER` | Must |
| TC-CHK-UNDO-009 | 家长撤销孩子打卡 | 孩子打卡成功，家长 JWT | `DELETE /checkin/{id}/{today}` | 200；`undone=true`（同家庭可互撤） | Must |
| TC-CHK-UNDO-010 | 撤销未鉴权 | 无 Authorization | `DELETE /checkin/{id}/{today}` | 401 | Should |

### 2.D 结算任务 `SettlementJob`（手动触发，见 §3.5）

> 结算任务写库 `CheckinSettlements` + `Streaks` 需实际执行 Job。执行方式（Hangfire Dashboard 手动 Trigger 或测试专用触发端点）见 §3.5。断言走直连 DB + 窗口查询。`yesterday` 一律指**北京时间昨天**（§3.1）。

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-CHK-SET-001 | 三种类型结算写库 | seed 昨天适用的 活动/作息 + ⚠️ DB-SEED 作业(dueDate=yesterday)，均未打卡 | 触发 Job | `CheckinSettlements` 各 1 行：活动→`Status=Ended(4)`、作息→`Incomplete(1)`、作业→`Overdue(5)`；`GET window` 对应昨天返回 ended/incomplete(终态)/overdue | Must |
| TC-CHK-SET-002 | 已打卡实例不结算 | seed 昨天作息 + DB-SEED 昨天 Checkin | 触发 Job | 该实例无 `CheckinSettlement` 行；`Streaks`(Scope=Schedule) 累加 | Must |
| TC-CHK-SET-003 | 已取消实例不结算 | `cancelInstance` 昨天作息 | 触发 Job | 该实例无 `CheckinSettlement` 行；相关 streak 不变 | Must |
| TC-CHK-SET-004 | 结算幂等（重复触发） | 完成一次结算后 | 再次触发 Job | `CheckinSettlements` 行数不变；streak 不重复累加（`LastSettledDate` 锚点） | Must |
| TC-CHK-SET-005 | 撤销 vs 结算竞态（最终未完成，BE-20） | seed 昨天作息 + DB-SEED 昨天 Checkin 后 DB-DELETE（模拟 23:59:50 撤销） | 触发 Job | `CheckinSettlement`(Status=Incomplete)；`GET window` 昨天返回 `incomplete`+`canCheckin=false`+`reason=TERMINAL_STATE`；无 Checkin 残留 | Must |
| TC-CHK-SET-006 | 单日程 streak 打卡累加 | 昨天作息已打卡 | 触发 Job | `Streaks`(Scope=Schedule, SubjectId=scheduleId).`CurrentStreak` +1 | Should |
| TC-CHK-SET-007 | 单日程 streak 未打卡归零 | 昨天作息未打卡（先 DB-SEED streak=1） | 触发 Job | `CurrentStreak` 归 0 | Should |
| TC-CHK-SET-008 | 取消不中断单日程 streak | 昨天作息取消（先 DB-SEED streak>0） | 触发 Job | `CurrentStreak` 不变 | Should |
| TC-CHK-SET-009 | 孩子整体 streak 累加 | 孩子 ≥1 个有效作息昨天已打卡 | 触发 Job | `Streaks`(Scope=Child).`CurrentStreak` +1 | Should |
| TC-CHK-SET-010 | 孩子整体 streak 归零 | 孩子有有效作息但昨天全部未打卡 | 触发 Job | `Scope=Child`.`CurrentStreak` 归 0 | Should |
| TC-CHK-SET-011 | 全部取消整体 streak 不变 | 孩子昨天作息全部取消 | 触发 Job | `Scope=Child` 不变 | Could |
| TC-CHK-SET-012 | 结算不触碰今天实例（BE-18） | 今天开放窗口作息未打卡 | 触发 Job | 今天实例无 `CheckinSettlement`；`GET window` 今天仍 `canCheckin=true` | Should |

### 2.E 横切（统一错误信封）

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-CHK-X-001 | 统一错误信封 | 触发任意 checkin 错误（如 `POST` 终态拒绝） | 观察错误响应体 | 响应含 `{error, message}` 且与 `errors.json` 一致；`traceId` 字段存在（可缺省/null） | Must |

---

## 3. 测试数据策略

### 3.1 时间基准（关键）

打卡时间判定以**服务器北京时间（UTC+8）**为准（`CheckinService.ServerTime()` / `SettlementJob.ServerNow()`），结算任务处理**北京时间昨天**。测试机时钟可能非 CST，因此：

- `today` / `yesterday` / `tomorrow` MUST 按 **UTC+8** 计算，禁止用 `data-factory.js` 的 `today()`/`dateOffset()`（基于本地时区）直接代替结算相关日期。
- 建议在 `helpers/checkin-time.js` 新增 `beijingToday()` / `beijingYesterday()` / `beijingTomorrow()`，并在 `data-factory.js` 中为「按 DayOfWeek 造 schedule」复用 `new Date(yesterday).getDay()`（本地时区算 weekday 与北京一致，但日期字符串必须用北京时区）。
- `remainingSeconds`、`checkinAt` 等时间断言用**范围/可解析**断言，不断言精确秒。

### 3.2 Seed fixture 清单（新增到 `fixtures/seed-data.js` 或 `helpers/checkin-fixtures.js`）

沿用「API 造数据 + 用例独立 seed/清理」模式（复用 `seedSchedule`/`cleanupSchedule`）。以下 fixture 为窗口/打卡/撤销用例的确定性锚点：

| Fixture | 类型 | 关键参数 | 用途 |
|---------|------|---------|------|
| `FIX_ACTIVITY_TODAY_OPEN` | AfterSchoolActivity | dayOfWeek=today、startTime 00:00、endTime 23:59 | 开放窗口（WIN-001 / POST-001~005 / UNDO-001~003） |
| `FIX_ACTIVITY_TODAY_EARLY` | AfterSchoolActivity | dayOfWeek=today、startTime 23:59 | EARLY 拒绝（POST-006） |
| `FIX_ACTIVITY_FUTURE_EARLY` | AfterSchoolActivity | dayOfWeek=tomorrow、startTime 16:00 | EARLY 窗口（WIN-002，确定性） |
| `FIX_ACTIVITY_YESTERDAY` | AfterSchoolActivity | dayOfWeek=yesterday、startTime 10:00 | 课后活动终态 ended（WIN-005 / POST-009） |
| `FIX_ROUTINE_YESTERDAY` | DailyRoutine | dayOfWeek=yesterday | 作息终态 incomplete（WIN-007 / POST-008 / UNDO-005） |
| `FIX_ROUTINE_TODAY_ENDED_EARLY` | DailyRoutine | dayOfWeek=today、startTime 00:00、endTime 00:30 | 作息当天 24:00 前可打卡（WIN-012） |
| `FIX_HOMEWORK_YESTERDAY` | HomeworkTask | **dueDate=yesterday（⚠️ DB-SEED）** | 作业逾期 overdue（WIN-008 / POST-010） |

> 课后活动/作息可用 API 造（dayOfWeek 是周重复，非具体日期，`yesterday` 的 weekday 永远有未来周次）。**作业任务 dueDate 为具体日期，过去 dueDate 被 schedule 校验拒绝（`DUE_DATE_INVALID`）**，故 `FIX_HOMEWORK_YESTERDAY` 与结算作业场景必须 DB-SEED。

### 3.3 DB 级 seed（`helpers/checkin-db.js`，镜像 `db.js` 的 pg 模式）

以下场景 HTTP API 无法造数据，需直连 PostgreSQL。新增 helper 封装 `insertCheckin` / `deleteCheckin` / `insertSettlement` / `insertStreak` / `upsertHomeworkSchedule`：

| 场景 | 表 | 关键字段 | 用途 |
|------|-----|---------|------|
| 昨天打卡记录 | `CheckinRecords` | `ScheduleId`, `Date`=yesterday, `UserId`, `CheckinAt`, `Source`(1=Parent/2=Child), `CreatedAt` | 结算「已打卡不结算」/竞态/UNDO-005 |
| 昨天结算记录 | `CheckinSettlements` | `ScheduleId`, `Date`=today, `Status`(int) | UNDO-004（终态结算记录分支） |
| streak 初值 | `Streaks` | `Scope`(1=Schedule/2=Child), `SubjectId`, `CurrentStreak`, `LastSettledDate` | streak 累加/归零/取消不变断言 |
| 过去 dueDate 作业 | `Schedules`(+无 TimeSlots) | `Id`, `Name`, `ScheduleType`=HomeworkTask, `FamilyId`, `AssignedChildId`, `DueDate`=yesterday, `IsDeleted`=false | 作业逾期窗口 + 结算 |

> `Schedules` 表列名以 `ScheduleConfiguration` 为准（`Id/Name/ScheduleType/FamilyId/AssignedChildId/CreatedBy/GroupKey/RepeatEndDate/Location/Notes/DueDate/SuggestedStartTime/SuggestedEndTime/RowVersion/IsDeleted/CreatedAt/UpdatedAt`），test-writer 写 helper 前用 `codegraph explore "ScheduleConfiguration"` 核对精确列名与类型（含 `RowVersion` 等 NOT NULL 约束）。若 DB-SEED 作业成本过高，`FIX_HOMEWORK_YESTERDAY`/POST-010/SET-001 的作业分支可退化为 `test.skip` 占位并注释「逾期推导已由 `CheckinServiceTests` 单元覆盖」。

### 3.4 错误码/枚举断言的消费方式（MUST）

测试代码禁止硬编码错误码/状态码字符串，MUST 引用契约文件（`dev-contracts` rule）：

```js
const errors = require('../../../openspec/contracts/checkin/errors.json');
const enums  = require('../../../openspec/contracts/checkin/enums.json');

expect(res.status()).toBe(errors.TERMINAL_STATE.httpStatus);      // 400
expect(body.error).toBe(Object.keys(errors).find(k => errors[k] === errors.TERMINAL_STATE));
expect(body.message).toBe(errors.TERMINAL_STATE.message);         // "该日程已结算，不可打卡或撤销"
expect(body.status).toBe(enums.CheckinStatus.values.find(v => v === 'incomplete'));
```

- 状态码：`errors.<CODE>.httpStatus`（与后端 `ErrorCodes.HttpStatus()` 同源）。
- 中文 message：`errors.<CODE>.message`。
- 状态值：`enums.CheckinStatus.values`。
- DTO 字段：`dto.json`（`CheckinWindowResponse`/`CheckinResponse`/`UndoCheckinResponse`/`ErrorResponse`）。
- **扩展 `helpers/contracts.js`**：现有 `contracts.js` 仅加载 auth 契约，需新增 checkin 契约的 `errors/enums/dto` 加载，并让 `assertError` 支持 checkin（或将 `assertError` 参数化为「契约对象 + 错误码键」）。

### 3.5 结算任务触发方式（关键前置）

`SettlementJob` 是 Hangfire Recurring Job（ID `daily-settlement`），只处理北京时间昨天，**无法通过 HTTP API 直接触发**。E2E 需要一种可控触发方式，按优先级推荐：

1. **（首选）测试专用触发端点**：在 `api` 增加仅 Development 环境启用的 `POST /api/v1/test/checkin/settle`（直接 `SettlementJob.ExecuteAsync` 或 `RecurringJob.TriggerJob("daily-settlement")`）。这是最小基础设施变更，使结算用例可全自动执行；由 test-writer 与主代理/ dev-dotnet 协作落地，不在 test-planner 职责内，列为 Gate 0 前置项（G0-6）。
2. **（回退）Hangfire Dashboard 手动 Trigger**：`/hangfire` → Recurring Jobs → `daily-settlement` → Trigger now。结算用例标记为「需手动触发」，由 test-runner 在 Gate 0 确认 Dashboard 可访问后人工点一次；Playwright 只做「触发前 seed + 触发后 DB/API 断言」，触发动作手动作业。

> 无论哪种方式，结算用例 MUST 在同一触发点前完成全部 seed，触发后统一断言，避免「昨天」滚动导致不同用例指向不同日期。结算 spec 建议独立文件 + 串行执行（`workers:1` 已全局串行）。

---

## 4. data-id 清单与缺失标记（E2E 不适用）

本 E2E 为 API 级测试，**不使用 `data-id` 定位元素**（无浏览器 DOM）。打卡模块前端可交互元素 `data-id`（`schedule-detail-checkin-btn` / `schedule-detail-undo-btn` / `schedule-detail-checkin-countdown` / `schedule-detail-status-*` 等，完整清单见 `tasks.md` §8.8）由小程序 Jest 测试（`dev-miniapp-tdd`）消费，不在本计划覆盖范围。

**缺失 data-id 标记**：不适用。若后续为打卡模块新增 UI 级 E2E（浏览器/小程序自动化），再按 `dev-miniapp-standards` 的可测试性契约补全标记。

---

## 5. 环境依赖与 Gate 0 就绪检查清单

> test-runner 在 Gate 0 逐项检查，任一未通过则 STOP（不执行测试）。

| # | 检查项 | 就绪标准 | 失败处置 |
|:--|------|------|------|
| G0-1 | .NET API 运行 | `GET {baseURL}/health` 返回 200 | STOP：`dotnet run --project api/Agenda.Api.csproj` |
| G0-2 | PostgreSQL 就绪 + 迁移完成 | `seed-db.js` 直连成功；`CheckinRecords`/`CheckinSettlements`/`Streaks` 表存在（含 UNIQUE 约束） | STOP：`dotnet ef database update` 后重试 |
| G0-3 | JWT 密钥对齐 | `jwt-helper.js` 的 `JWT_SECRET` == 后端 `JWT_SECRET_KEY`（或 `Jwt:SecretKey`） | STOP：统一环境变量后重启 API |
| G0-4 | seed 幂等 | 重复执行 seed 不报错（`TRUNCATE`/`ON CONFLICT`）；schedule seed 复用 `fixtures/seed-data.js` | STOP：修正 seed 脚本 |
| G0-5 | checkin 契约文件可读 | `require('.../openspec/contracts/checkin/{errors,enums,dto}.json')` 成功，含 7 个错误码 | STOP：检查 contracts 路径 |
| G0-6 | **结算触发方式就绪** | 测试触发端点存在（§3.5 方案 1 落地）或 `/hangfire` Dashboard 可访问 + `daily-settlement` Recurring Job 已注册 | STOP：落地触发端点或按 §3.5 回退方案调整结算用例执行方式 |
| G0-7 | DB-SEED helper 就绪 | `helpers/checkin-db.js` 可直连 PostgreSQL 并插入 `CheckinRecords`/`CheckinSettlements`/`Streaks`/`Schedules` | STOP：核对 `ScheduleConfiguration` 列名后修正 helper |

---

## 6. 风险点与假设

### 6.1 关键风险

| # | 风险 | 影响 | 缓解 |
|:--|------|------|------|
| R1 | 结算 Job 无 HTTP 触发端点，Hangfire Dashboard 手动触发非自动化 | §2.D 结算用例需人工介入或需后端加测试端点 | §3.5 首选测试触发端点（G0-6）；回退 Dashboard 手动 + 结算 spec 独立串行 |
| R2 | 结算 Job 的「昨天」绑定服务器真实时钟，无法冻结时间 | 无法真正模拟 23:59:50 撤销 / 00:05 结算的物理时点 | 用 DB-SEED 直接构造「昨天已打卡/已撤销」的最终状态 + 手动触发结算，以**最终状态**验证竞态语义（§3.3 / SET-005）；竞态本身不依赖真实时刻 |
| R3 | 作业任务过去 dueDate 被 schedule API 拒绝（`DUE_DATE_INVALID`） | 作业逾期窗口/结算无法用 API 造数据 | §3.3 DB-SEED 作业；成本过高则 `test.skip` 占位 + 单元测试兜底 |
| R4 | 结算/逾期断言依赖「北京昨天」与测试机本地时区不一致 | `yesterday` 算错导致结算用例指向错误日期 | §3.1 统一 UTC+8 计算；test-writer 用 `beijingYesterday()`，禁本地 `dateOffset(-1)` |
| R5 | 「即时逾期 / EARLY / WINDOW_CLOSED」断言依赖真实时刻（endTime+2h、startTime-30min） | 极端时段跑测试会翻转 | 用「昨天」锚点做确定性覆盖（WIN-005/007）；即时逾期（WIN-006）、EARLY（POST-006）、WINDOW_CLOSED（UNDO-006）用极值时间（endTime=00:00 / startTime=23:59）最大化稳定，并标注执行时段假设 |
| R6 | `CheckinRecords` 表名与 `Streaks`/`CheckinSettlements` 的 DB-SEED 列名/类型未核对 | helper 插入失败 | G0-7 用 `codegraph explore "CheckinConfiguration"/"StreakConfiguration"/"CheckinSettlementConfiguration"` 核对列名 |

### 6.2 假设

| # | 假设 | 影响范围 |
|:--|------|------|
| A1 | 测试环境 PostgreSQL 可随意增删改 | 全部后端用例 + DB 断言 |
| A2 | 受保护端点 JWT 可直接构造（`jwt-helper.js`），无需走微信登录 | 全部 checkin 端点 |
| A3 | 时间判定以服务器时间为准，测试机时区不参与 | 窗口/结算/逾期用例 |
| A4 | `CHECKIN_WINDOW_CLOSED` 既作「窗口关闭/提前拒绝」错误码，也作验证器错误码（§6.3 O3） | POST 负向断言 |
| A5 | `seed-db.js` 已 seed 的家庭/成员关系满足 `NOT_FAMILY_MEMBER` 权限校验（CHILD_1 属 Family1，OUTSIDER 属 Family2） | 403 用例 |

### 6.3 已知实现观察（供 test-writer 参考，不新增用例）

- **O1**：窗口查询 `reason` 字段实际只返回 `EARLY` 或 `TERMINAL_STATE`；`CHECKIN_WINDOW_CLOSED` 在实现中仅作为 **错误码**（POST 提前拒绝时）出现，不作为窗口查询的 `reason` 值。`dto.json` 将 `CHECKIN_WINDOW_CLOSED` 列为 reason 可选值，但后端不产出该 reason——按「实现为准」断言 `reason` 只认 `EARLY`/`TERMINAL_STATE`；若 reviewer 判定应产出 `CHECKIN_WINDOW_CLOSED`，走 OpenSpec 变更修正契约/实现。
- **O2**：`POST` 在提前窗口（`reason=EARLY`）被拒绝时返回 `CHECKIN_WINDOW_CLOSED`（而非专门 `EARLY` 错误码），语义为「未到可打卡时间」。断言以 `errors.json CHECKIN_WINDOW_CLOSED` 为准。
- **O3**：`CheckinRequestValidator` 对 `scheduleId` 为空 / `date` 为未来日期复用 `WithErrorCode(ErrorCodes.CheckinWindowClosed)`，故 POST 校验失败返回 400 `CHECKIN_WINDOW_CLOSED`（无独立 `VALIDATION` 错误码）。POST-011/012 按此断言。
- **O4**：`CheckinService.CheckinAsync` 幂等路径在 `DB UNIQUE(ScheduleId, Date)` 冲突时回查并返回 `alreadyCheckedIn=true`，故并发 POST-005 可能两条都 200，其中一条走 DB 兜底路径——断言「均 200 + DB 仅 1 行」即可，不区分哪条走兜底。

---

## 7. 失败分类策略（供 test-runner 复用）

| 分类 | 判定特征 | 处置 |
|------|---------|------|
| `ENV-NOT-READY` | `health` 失败、DB 连接失败、seed 报错、checkin 表缺失 | 回 Gate 0 修复环境后重跑 |
| `AUTH-MISALIGN` | 所有受保护端点集中 401，但 JWT 本应有效 | 检查 G0-3 密钥对齐 |
| `SETTLE-TRIGGER-MISSING` | 结算用例无法触发 Job（无端点 / Dashboard 不可达） | 检查 G0-6，落地触发端点或手动触发 |
| `TIME-SKEW` | 即时逾期/EARLY/WINDOW_CLOSED 用例在极端时段翻转 | 按 §6 R5 调整 fixture 极值时间或执行时段 |
| `DB-SEED-FAIL` | helper 插入报错（列名/类型） | 按 §6 R6 核对 Configuration 列名 |
| `ASSERTION-FAIL` | 状态码/错误码/字段与契约不符 | **产品/实现缺陷** → 升级 dev-dotnet 修复，重跑 |
| `CONTRACT-DRIFT` | 后端错误码/字段名/状态值与 `errors.json`/`enums.json`/`dto.json` 不一致 | 判定以 contracts 为真相源 → 修正后端或契约（走 OpenSpec 变更） |
| `FLAKY` | 偶发、与数据/时序相关（remainingSeconds、checkinAt 秒级） | 复跑 3 次定位，按 §3.1 放宽时间断言 |

---

## 8. 用例统计

| 分组 | Must | Should | Could | 小计 |
|------|:--:|:--:|:--:|:--:|
| 2.A 窗口查询 | 10 | 2 | 0 | **12** |
| 2.B 打卡执行 | 9 | 6 | 0 | **15** |
| 2.C 撤销打卡 | 7 | 3 | 0 | **10** |
| 2.D 结算任务 | 5 | 6 | 1 | **12** |
| 2.E 横切 | 1 | 0 | 0 | **1** |
| **合计** | **32** | **17** | **1** | **50** |

- 可执行用例：**50** 条（Must 32 + Should 17 + Could 1）。
- 结算 12 条与作业逾期相关用例依赖 §3.5 触发方式 + §3.3 DB-SEED；若触发端点未落地，结算组按 §3.5 回退为「手动触发」执行，不计为 GAP。

---

## 9. 交付物与下游指引

### 9.1 给 test-writer 的编写顺序建议

1. **Gate 0 前置**：落地结算触发端点（§3.5 方案 1）或确认 Dashboard 手动触发；新增 `helpers/checkin-db.js`（§3.3）+ `helpers/checkin-time.js`（§3.1）；扩展 `helpers/contracts.js` 加载 checkin 契约（§3.4）。
2. **Must 用例（32 条）**：先打通窗口 6 状态 + POST 幂等/拒绝 + UNDO 三拒绝 + 结算三条链路 + 竞态。
3. **Should 用例（17 条）**：边界（即时逾期、并发、streak 累加/归零、未来日期/空 ID）。
4. **Could 用例（1 条）**：全部取消 streak 不变。
5. 结算 spec 独立文件，最后串行执行（避免「昨天」滚动）。

### 9.2 测试文件组织建议

```
testing/e2e/
├── specs/
│   ├── checkin-window.spec.js      # TC-CHK-WIN-xxx
│   ├── checkin-post.spec.js        # TC-CHK-POST-xxx
│   ├── checkin-undo.spec.js        # TC-CHK-UNDO-xxx
│   ├── checkin-settlement.spec.js  # TC-CHK-SET-xxx（独立 + 串行 + 手动/端点触发）
│   └── checkin-cross.spec.js       # TC-CHK-X-xxx
├── helpers/
│   ├── api-client.js               # 扩展 getWindow/checkin/undo 封装（buildOptions 复用）
│   ├── contracts.js                # 扩展 checkin 契约加载（§3.4）
│   ├── checkin-time.js             # beijingToday/Yesterday/Tomorrow（§3.1）
│   ├── checkin-db.js               # DB-SEED helper（§3.3）
│   └── checkin-fixtures.js         # FIX_* fixture 工厂（§3.2）
└── fixtures/
    └── seed-data.js                # 扩展 checkin 相关 seed（复用 seedSchedule/cleanupSchedule）
```

### 9.3 断言与定位约束

- 错误码/状态码/中文 message/状态值断言 MUST 引用 `openspec/contracts/checkin/{errors,enums,dto}.json`（§3.4），禁止硬编码。
- 请求头鉴权统一走 `api-client.js` 的 `buildOptions(authToken)`；`AUTH` 常量复用 `data-factory.js`。
- 每个用例独立 seed + 清理，避免用例间依赖与数据残留（DB-SEED 场景须对称清理 `CheckinRecords`/`CheckinSettlements`/`Streaks`）。
- 时间断言用「可解析 ISO 8601」+「范围」，不硬编码精确时间戳。
