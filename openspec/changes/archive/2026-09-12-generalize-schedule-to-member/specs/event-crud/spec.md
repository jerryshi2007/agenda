# event-crud · Delta Spec（generalize-schedule-to-member）

> 变更：日程关联对象从「孩子」泛化为「家庭成员」（家长 + 孩子），创建/编辑/删除权限矩阵泛化，类型双文案，冲突检测对象随成员泛化。

## MODIFIED Requirements

### Requirement: 关联对象从孩子泛化为成员

创建日程时，关联对象 MUST 由「孩子」泛化为「家庭成员」。家长视角 SHALL 可选全体成员（家长 + 孩子）多选；孩子（高年级）视角 MUST 默认仅自己且不可更改。每个关联成员 MUST 生成一条独立的 Schedule 记录（N 成员 = N 行，GroupKey 关联）。

#### Scenario: 家长给自己创建日程
- **WHEN** 家长在创建流程「选成员」选择自己 → 选类型 → 填字段 → 创建
- **THEN** 系统生成关联对象为该家长本人的日程，家长端日历可见

#### Scenario: 家长混合给成员创建日程（家长 + 孩子）
- **WHEN** 家长同时选择家长 B 与孩子小明 → 创建
- **THEN** 生成两条独立 Schedule 记录（家长 B 一条、小明一条），GroupKey 相同；打卡记录各自独立

#### Scenario: 未选择任何成员
- **WHEN** 家长在「选成员」未选择任何成员点击下一步
- **THEN** 返回 400 `MEMBER_NOT_SELECTED`（旧码 `CHILD_NOT_SELECTED` 为 deprecated 别名，同 400），不进入下一步

#### Scenario: 所选成员不在当前家庭
- **WHEN** 请求的 `MemberIds` 包含非当前家庭成员
- **THEN** 返回 400 `MEMBER_NOT_IN_FAMILY`，不落库

### Requirement: 创建/编辑/删除权限矩阵泛化

家长 MUST 可对任意成员的日程创建/编辑/删除；孩子（高年级）MUST 仅能创建/编辑/删除自己的日程，SHALL NOT 给家长创建，SHALL NOT 编辑/删除/代打卡家长的日程。

#### Scenario: 孩子给自己创建日程
- **WHEN** 高年级模式孩子提交创建请求，`MemberIds == [自己]`
- **THEN** 系统生成关联对象为自己的日程

#### Scenario: 孩子篡改请求给家长创建（越权拦截）
- **WHEN** 孩子提交创建请求，`MemberIds` 包含某家长
- **THEN** 服务端返回 403 `CHILD_SELF_ASSIGN_ONLY`，不创建日程

#### Scenario: 孩子编辑/删除家长日程（越权拦截）
- **WHEN** 孩子提交编辑/删除某家长日程的请求
- **THEN** 服务端返回 403 `CHILD_ACCESS_DENIED`，日程不变

### Requirement: 类型双文案（作业任务/待办事项）

`ScheduleType.HomeworkTask` 在关联成员为家长时前端 MUST 显示「待办事项」，为孩子时 MUST 显示「作业任务」。后端枚举值与数据 SHALL 保持不变，label MUST 按关联成员角色渲染，与查看者无关。

#### Scenario: 关联家长的作业任务显示待办事项
- **WHEN** 家长查看关联到自己或其他家长的 HomeworkTask 日程
- **THEN** 显示「待办事项」

#### Scenario: 关联孩子的作业任务显示作业任务
- **WHEN** 家长或孩子查看关联到孩子的 HomeworkTask 日程
- **THEN** 显示「作业任务」（label 取决于关联对象角色，与查看者身份无关）

### Requirement: 冲突检测对象随成员泛化

创建/编辑日程时的时间重叠检测，对象 MUST 由「同一孩子」泛化为「同一成员」。仅对同一成员内部的时间重叠 SHALL 触发软提示，不同成员之间 SHALL NOT 算作冲突。

#### Scenario: 同一成员时间重叠
- **WHEN** 家长创建日程，时间段与同一成员（自己/其他家长/某孩子）的已有日程重叠
- **THEN** 返回 409 `SCHEDULE_CONFLICT`（软提示，可继续创建）

#### Scenario: 不同成员时间重叠
- **WHEN** 家长创建日程，时间段与不同成员（如家长 A 与孩子小明）的已有日程重叠
- **THEN** 不触发冲突检测
