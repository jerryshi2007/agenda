# template-application · Delta Spec（generalize-schedule-to-member）

> 变更：模板使用时的「关联孩子」（单选）泛化为「关联成员」（多选），可生成家长日程。

## MODIFIED Requirements

### Requirement: 模板关联成员多选泛化

模板使用时的关联对象 MUST 由「孩子」单选泛化为「成员」多选，与创建日程的多选体验一致，模板 SHALL 可生成家长日程。

#### Scenario: 模板多选成员生成日程
- **WHEN** 家长在模板使用面板的「关联成员」选择器多选一个或多个成员（家长/孩子）→ 指定起始日期 → 创建
- **THEN** 系统生成关联所选成员的日程（每个成员一行），与创建日程多选体验一致

#### Scenario: 所选成员与当前家庭不匹配
- **WHEN** 所选模板关联成员与当前家庭不匹配
- **THEN** 系统自动清理成员关联，要求重新指定（沿用 US-EVT-04 既有行为）
