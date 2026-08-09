## Why

打卡与统计模块是日程管理模块的下游依赖。当前日程管理模块已定义了打卡按钮交互和 4 种视觉状态（已完成/未完成/已取消/已逾期），但打卡的时间边界规则（提前窗口、三种类型的差异化逾期判定、终态不可逆）、撤销打卡时序规则、每日自动结算机制均未实现。首期 Story CHK-ST-01 在 staging 目录中已标记为 dev-ready，是进入研发阶段的前置条件。

## What Changes

- **新增打卡时间窗口判定 API**：提前 30 分钟打卡窗口、三种日程类型（课后活动/日常作息/作业任务）的差异化逾期判定、逾期后不可补打卡、以服务器时间为准的时间判定
- **新增撤销打卡时序规则**：结算前可撤销（窗口关闭前）、终态不可撤销（窗口关闭后）、撤销后重新打卡受时间窗口约束、撤销与结算竞态处理
- **新增每日结算定时任务**：每天 00:05 自动执行，遍历前一天未打卡日程实例，按类型变更状态为终态，更新连续完成天数，保证幂等性
- **新增打卡记录数据实体与 API**：打卡记录 CR（创建/读取）、撤销删除，打卡人身份记录，操作来源区分
- **日程详情页前端增强**：打卡按钮根据时间窗口动态切换可点击/灰色不可点击（含倒计时）/不显示，撤销按钮按时序规则显隐

## Capabilities

### New Capabilities

- `checkin-record`: 打卡记录实体与 API——创建打卡记录、查询日程实例的打卡状态、撤销打卡（删除记录）
- `checkin-settlement`: 每日结算定时任务——凌晨触发、按类型变更未打卡日程终态、幂等性保障、错误重试

### Modified Capabilities

（无——现有 specs 目录为空，本次为全新模块建立。）

## Impact

- **api/**：新增 `api/Checkin/` 目录（CheckinController、CheckinService、DTOs、Validators）；扩展 `api/Domain/Entities/` 新增 Checkin 实体；扩展 `api/Infrastructure/Data/` 新增 CheckinConfiguration；新增结算定时任务
- **app/**：增强日程详情页（`pages/event-detail/`）的打卡按钮与撤销按钮交互逻辑；新增 `services/checkin.js` API 封装
- **openspec/specs/**：新建 `checkin-record` 和 `checkin-settlement` 两个 capability spec
