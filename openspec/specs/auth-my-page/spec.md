# auth-my-page Specification

## Purpose
TBD - created by archiving change add-auth-module. Update Purpose after archive.
## Requirements
### Requirement: "我的"页面展示
系统 MUST 提供"我的"页面，所有已登录用户均可访问。页面 MUST 展示头像昵称区（可点击进入编辑），并根据用户是否属于家庭展示不同布局。TabBar MUST 固定 2 个 Tab（日历 + 我的）。

#### Scenario: 有家庭时完整展示
- **WHEN** 用户属于至少 1 个家庭 AND 进入"我的"页面
- **THEN** 显示：头像昵称区 + 当前家庭信息（名称+角色）+ 切换家庭（≥2 个时）+ 创建家庭 + 加入家庭 + 设置入口

#### Scenario: 无家庭时简化展示
- **WHEN** 用户不属于任何家庭 AND 进入"我的"页面
- **THEN** 显示：头像昵称区 + 创建家庭 + 加入家庭 + 设置入口。不显示家庭信息区和切换家庭入口

#### Scenario: 页面加载时网络异常
- **WHEN** "我的"页面加载 AND 网络异常
- **THEN** 头像昵称区使用本地缓存展示，家庭信息区显示"加载失败"占位，创建/加入/设置入口仍可点击

### Requirement: 入口跳转
"我的"页面各入口 MUST 正确跳转到对应页面。头像区点击跳转编辑资料页（认证模块）。家庭操作入口跳转对应家庭模块页面。认证模块不做角色权限判断。

#### Scenario: 点击头像区进入编辑
- **WHEN** 用户在"我的"页面 AND 点击头像/昵称区域
- **THEN** 跳转编辑资料页（认证模块内部页面）

#### Scenario: 点击当前家庭
- **WHEN** 有家庭状态 AND 用户点击当前家庭信息行
- **THEN** 跳转家庭模块的成员列表页，传递当前 familyId

#### Scenario: 点击创建家庭
- **WHEN** 用户点击"创建家庭"
- **THEN** 跳转家庭模块的创建流程页面

#### Scenario: 点击加入家庭
- **WHEN** 用户点击"加入家庭"
- **THEN** 跳转家庭模块的邀请码输入页面

#### Scenario: 点击切换家庭
- **WHEN** 用户有 ≥2 个家庭 AND 点击"切换家庭"
- **THEN** 跳转家庭模块的切换面板

#### Scenario: 点击设置
- **WHEN** 用户点击"设置"
- **THEN** 进入设置页面（认证模块内部页面）

### Requirement: TabBar 设计
系统 MUST 使用微信原生 TabBar，固定 2 个 Tab（日历 + 我的），所有角色统一，不分家长/孩子。

#### Scenario: TabBar 始终显示
- **WHEN** 用户已登录 AND 处于日历或"我的"页面
- **THEN** TabBar 始终显示"日历"和"我的"两个 Tab，可通过 Tab 切换页面

### Requirement: 认证模块权限角色中立
认证模块 MUST NOT 根据自己的业务逻辑判断家长/孩子角色来控制入口可见性。创建/加入家庭等入口的权限控制 MUST 由家庭模块自行处理。

#### Scenario: 不判断角色控制入口
- **WHEN** 进入"我的"页面
- **THEN** 创建家庭和加入家庭入口对所有已登录用户可见，认证模块不根据角色隐藏或禁用入口

#### Scenario: 家庭解散后自动切换
- **WHEN** 用户同时在另一设备解散了当前家庭
- **THEN** 下次进入"我的"页面时重新加载家庭列表，自动切换显示为"无家庭"模式

