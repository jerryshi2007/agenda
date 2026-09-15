# checkin-record · Delta Spec（generalize-schedule-to-member）

> 变更：打卡对象从「孩子」泛化为「成员」，打卡权限随成员泛化（家长代任意成员、孩子仅自己）。

## MODIFIED Requirements

### Requirement: 打卡对象泛化到成员

打卡对象 MUST 由「孩子」泛化为「家庭成员」。家长 SHALL 可给自己日程打卡，也可代其他家长/孩子打卡；孩子 MUST 仅给自己打卡。打卡时间窗口/逾期判定规则 SHALL 保持不变。

#### Scenario: 家长给自己日程打卡
- **WHEN** 家长有自己的日程（状态未完成且未逾期）点击打卡
- **THEN** 状态变「已完成」，打卡记录打卡人 = 该家长本人，source=Parent

#### Scenario: 家长代其他家长/孩子打卡
- **WHEN** 家长 A 查看关联家长 B 或孩子小明的未完成日程点击打卡
- **THEN** 状态变「已完成」，打卡记录打卡人 = 家长 A，被打卡对象 = 家长 B / 小明

#### Scenario: 孩子仅给自己打卡
- **WHEN** 孩子尝试为其他成员（家长或其他孩子）的日程打卡
- **THEN** 服务端返回 403 `CHILD_ACCESS_DENIED`，不创建打卡记录

#### Scenario: 混合关联打卡独立
- **WHEN** 一条日程混合关联家长 B 与小明（各一行），家长 B 打卡
- **THEN** 仅家长 B 行变「已完成」，小明行不受影响（打卡记录各自独立）
