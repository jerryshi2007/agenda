# checkin-settlement · Delta Spec（generalize-schedule-to-member）

> 变更：家长日程保留状态结算（未打卡→终态），但不写入 streak。streak 仍仅孩子维度。

## MODIFIED Requirements

### Requirement: 家长日程保留状态结算但排除 streak

每日结算任务对家长日程 MUST **执行状态流转**（到点未打卡 → 按类型变为「已结束 / 未完成 / 逾期未完成」），但 MUST NOT **写入连续完成天数（streak）**——streak 仍 MUST 仅按孩子成员更新。

#### Scenario: 家长日程照常状态结算
- **WHEN** 结算任务处理家长成员昨日未打卡的日程
- **THEN** 该日程照常写 `CheckinSettlement` 终态（课后活动→已结束；日常作息→未完成；作业任务→逾期未完成）

#### Scenario: 家长日程不写 streak
- **WHEN** 结算任务处理家长成员的日常作息日程
- **THEN** 不更新该家长成员的任何 streak（单日程 streak 与整体 streak 均不写）

#### Scenario: 孩子日程 streak 照常更新
- **WHEN** 结算任务处理孩子成员的日常作息日程
- **THEN** 单日程 streak 与孩子整体 streak 照常更新（行为不变）

#### Scenario: 家长日程不进入统计
- **WHEN** 家长查看数据看板 / 孩子查看「我的统计」
- **THEN** 家长日程不计入任何完成率、连续天数、趋势、看板指标；看板仅统计孩子日程
