# ADDED Requirements: family-member

成员与角色管理：邀请加入/成员列表/移除/转让创建者/孩子姓名规则/已注销成员处理。

---

## Requirement 1: 成员列表分组展示

**描述**：成员列表按家长/孩子分组展示，显示孩子展示模式。

**Scenarios**

```gherkin
Scenario: 查看成员列表
  Given 家庭有 2 个家长，2 个孩子
  When 家长打开成员列表页
  Then 成员列表分为"家长"和"孩子"两组
  And 孩子项显示孩子姓名 + 当前展示模式
  And 显示家庭人数：X/10

Scenario: 已注销成员在 30 天缓冲期内
  Given 成员 A 注销了账户，注销未超过 30 天
  When 打开成员列表
  Then 成员 A 显示为"已注销成员"，灰色，不可交互
  And 不占用家庭人数名额

Scenario: 已注销成员超过 30 天
  Given 成员 A 注销账户已超过 30 天
  When 打开成员列表
  Then 成员 A 从成员列表中移除
  And 家庭人数名额自动释放
```

---

## Requirement 2: 移除成员

**描述**：家长可移除任意其他成员，不能移除自己。

**Scenarios**

```gherkin
Scenario: 家长移除孩子成员
  Given 家庭有家长 A 和孩子 B，A 是家长
  When A 在成员列表点击 B，点击"移除成员"，确认移除
  Then B 被移除出家庭
  And B 进入无家庭状态

Scenario: 家长尝试移除自己
  Given A 是家长
  When A 尝试移除自己
  Then 操作被拒绝
  And 提示"不能移除自己，请使用退出功能"
```

---

## Requirement 3: 转让创建者

**描述**：创建者可将创建者身份转让给其他家长。

**Scenarios**

```gherkin
Scenario: 转让创建者成功
  Given A 是创建者（家长），家庭有其他家长 B
  When A 点击 B，选择"转让创建者"，二次确认
  Then A 变为普通家长
  And B 成为新创建者

Scenario: 无可转让对象（只有一个家长）
  Given 创建者 A 是唯一家长
 Then 转让入口隐藏
```

---

## Requirement 4: 孩子姓名家庭内覆盖微信昵称

**描述**：家长邀请孩子时指定的孩子姓名在家庭所有场景覆盖微信昵称。

**Scenarios**

```gherkin
Scenario: 邀请孩子时指定姓名，成员列表显示指定姓名
  Given 家长邀请孩子，指定孩子姓名"小明"，孩子微信昵称"阳光少年"
  When 打开成员列表
  Then 成员列表显示"小明"，不显示"阳光少年"

Scenario: 孩子端"我的"页面显示孩子姓名
  Given 孩子姓名被指定为"小明"
  When 孩子打开"我的"页面
  Then 显示姓名"小明"
```

---

## Requirement 5: 孩子展示模式设置

**描述**：家长可为每个孩子设置展示模式（学龄前/小学/高年级），第一期仅存储设置，不做差异化 UI 渲染。

**Scenarios**

```gherkin
Scenario: 家长设置孩子展示模式
  Given 家长点击孩子成员，选择"设置展示模式"
  When 家长选择"小学模式"，点击保存
  Then 该孩子的展示模式立即更新为小学模式
```

---

## Requirement 6: 已注销成员创建者自动转让

**描述**：已注销成员是创建者且超过 30 天缓冲期，若家庭仍有其他家长，创建者身份自动转让给加入最早的家长。

**Scenarios**

```gherkin
Scenario: 创建者注销超过 30 天，自动转让
  Given 创建者 A 注销账户，已超过 30 天，家庭还有其他家长 B（最早加入）
  When 定时清理执行，移除已注销成员 A
  Then B 自动成为新的创建者
  And 家庭继续正常使用
```

---

## Requirement 7: 家庭人数上限检查

**描述**：家庭最多 10 人，满员拒绝新成员加入。

**Scenarios**

```gherkin
Scenario: 家庭已有 10 人，新成员试图加入
  Given 家庭已有 10 名活跃成员（未删除）
  When 被邀请人输入有效邀请码确认加入
  Then 提示"家庭已满（10 人），无法加入"
  And 加入失败
```
