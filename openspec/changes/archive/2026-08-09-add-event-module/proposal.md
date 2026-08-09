## Why

日程管理是家庭日程协作工具的核心模块，负责日程的完整生命周期（创建/编辑/删除/取消/打卡）。当前 staging 需求已完成结构化分析并标记 dev-ready（20 个 GWT 用户故事 + 23 条边界异常），后端 api/ 和前端 app/ 目录均为骨架状态，需从零设计全栈架构以进入研发实现阶段。

## What Changes

- **新增日程实体与 CRUD API**：Schedule（三种类型：课后活动/日常作息/作业任务）、TimeSlot（7 天独立配置）、ScheduleInstance（日历实例展开）、Cancellation（临时取消记录）
- **新增日历视图 API**：月/周/日三视图数据查询，按孩子和类型筛选，按日期范围检索
- **新增日程操作 API**：编辑（仅本次/全部未来实例）、删除（仅本次/本次及之后）、临时取消与恢复
- **新增打卡交互增强**：详情页打卡/撤销、日历快捷打卡状态集成
- **新增冲突检测**：同一孩子同时段日程软提示（不阻止创建）
- **新增小程序前端完整架构**：日历三视图（月/周/日）+ 筛选 + 日程详情页 + 创建/编辑页 + 组件树 + 状态管理 + 数据流

## Capabilities

### New Capabilities

- `event-crud`: 日程创建/读取/更新/删除 API——三种类型（课后活动/日常作息/作业任务）、时间槽模型（7 天独立配置）、重复规则、乐观锁并发控制、冲突检测
- `event-instance`: 日程虚拟实例展开——按日期范围计算每天日程实例（不预生成，按需计算）、实例状态推导（未完成/已完成/已取消/已逾期）、取消记录管理
- `event-calendar`: 日历视图数据查询——月/周/日三维度数据聚合、按孩子和类型筛选、日期范围检索
- `event-checkin-integration`: 日程与打卡模块交互契约——打卡窗口状态查询、打卡操作触发、撤销打卡与日程状态的联动

### Modified Capabilities

（无——现有 openspec/specs/ 目录为空，本次为全新模块建立。）

## Impact

- **api/**：新增 `api/Schedule/` 目录（ScheduleController、ScheduleService、TimeSlotService、DTOs、Validators）；扩展 `api/Domain/Entities/` 新增 Schedule、TimeSlot、Cancellation 实体；扩展 `api/Infrastructure/Data/` 新增实体配置；复用 auth-module 的认证基础设施（JWT 中间件、异常中间件）和 checkin-module 的打卡窗口接口
- **app/**：新增 `pages/schedule-detail/`、`pages/schedule-create/`、`pages/schedule-edit/`、`pages/calendar/` 等页面；新增 `components/schedule-card/`、`components/time-slot-picker/`、`components/calendar-view/` 等组件；新增 `services/schedule.js` API 封装；复用 auth-module 的 `services/api.js` 请求封装和 `utils/storage-keys.js`
- **openspec/specs/**：新建 `event-crud`、`event-instance`、`event-calendar`、`event-checkin-integration` 四个 capability spec
