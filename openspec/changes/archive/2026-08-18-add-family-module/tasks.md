# Tasks: add-family-module

> 日期：2026-08-18
> 总 task 数：16

## Task 依赖关系图

```
  [Task 1: 后端实体扩展和新增] ← 无
           ↓
  [Task 2: 后端 DTO 与 Validator] ← Task 1
  [Task 3: 后端 EF Core 迁移] ← Task 1
           ↓
  [Task 4: 后端家庭生命周期服务] ← Task 2
  [Task 5: 后端邀请码服务] ← Task 2
           ↓
  [Task 6: 后端 Controller] ← Task 4, Task 5
           ↓
  [Task 7: 前端 API 封装] ← Task 6
  [Task 8: 前端首次引导 + 创建家庭页面] ← Task 7
  [Task 9: 前端加入家庭页面] ← Task 7
           ↓
  [Task 10: 后端分享卡片处理] ← Task 6
  [Task 11: 前端邀请成员流程] ← Task 8, Task 9
  [Task 12: 前端邀请记录列表] ← Task 11
  [Task 13: 前端分享卡片发起] ← Task 10, Task 11
           ↓
  [Task 14: 前端成员列表与管理] ← Task 12
  [Task 15: 前端展示模式设置 + 多家庭切换] ← Task 14
  [Task 16: 前端/后端退出解散恢复集成] ← Task 15
```

## Task 列表

### 第 0 梯队：基础设施

### Task 1: 后端 - 扩展 Family/FamilyMember 实体 + 新增 InvitationCode

- **负责 agent**：`dev-dotnet`
- **依赖**：无
- **输入**：design.md 数据模型设计、openspec/contracts/family/enums.json
- **产出文件**：
  - `api/Domain/Entities/Family.cs`（扩展添加 CreatorId/Status/DissolvedAt）
  - `api/Domain/Entities/FamilyMember.cs`（扩展添加 ChildName/DisplayMode/IsDeleted/DeletedAt）
  - `api/Domain/Entities/InvitationCode.cs`（新建）
  - `api/Infrastructure/Data/Configurations/InvitationCodeConfiguration.cs`（新建）
- **完成标准**：
  1. 实体字段与 design.md 一致
  2. 所有枚举类型引用 contracts 定义
  3. 唯一性配置正确（FamilyMember(FamilyId, UserId) 唯一，InvitationCode.Code 唯一）
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

### Task 2: 后端 - 新增 DTO 和 FluentValidation Validator

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1
- **输入**：openspec/contracts/family/dto.json、openspec/contracts/family/errors.json
- **产出文件**：
  - `api/Family/Dtos/*.cs`（所有 DTO 按 contracts 定义）
  - `api/Family/Validators/*.cs`（所有 request 校验）
- **完成标准**：
  1. 所有 DTO 字段与 dto.json 一致
  2. 所有必填字段、长度/格式约束已实现
  3. 错误码引用 errors.json 定义
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

### Task 3: 后端 - 新增 EF Core 迁移

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1
- **输入**：实体配置变更
- **产出文件**：
  - `api/Migrations/<timestamp>_AddFamilyExpansion.cs`
- **完成标准**：
  1. 迁移正确添加新字段到 Family/FamilyMember
  2. 迁移正确创建 InvitationCode 表
  3. 唯一索引正确创建
  4. Down 方法能正确回滚
- **验证命令**：`dotnet ef migrations script --idempotent --output migration.sql && cat migration.sql`

### 第 1 梯队：后端核心服务

### Task 4: 后端 - 家庭生命周期服务（创建/修改名称/切换/退出/解散/恢复）

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 2
- **输入**：specs/family-lifecycle/spec.md GWT 场景
- **产出文件**：
  - `api/Family/Services/IFamilyLifecycleService.cs`
  - `api/Family/Services/FamilyLifecycleService.cs`
- **完成标准**：
  1. 创建家庭：正确创建 Family + 第一个 FamilyMember
  2. 修改名称：仅家长可修改，校验长度
  3. 退出：检查创建者限制、最后家长限制，成功后移除成员
  4. 解散：检查名称匹配，修改状态为 Dissolved
  5. 恢复：检查过期，恢复状态为 Normal
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~FamilyLifecycleService"`

### Task 5: 后端 - 邀请码服务（生成/验证/撤销）

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 2
- **输入**：specs/family-invite/spec.md GWT 场景
- **产出文件**：
  - `api/Family/Services/IInvitationCodeService.cs`
  - `api/Family/Services/InvitationCodeService.cs`
- **完成标准**：
  1. 生成邀请码仅用数字 2-9，6 位，检查家庭人数上限
  2. 验证：检查状态（Pending/Used/Redeemed/Expired），返回正确错误
  3. 撤销：仅邀请人可撤销待使用邀请码
  4. 碰撞处理：重复生成最多重试 5 次
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~InvitationCodeService"`

### Task 6: 后端 - Family Controller 所有端点

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 4, Task 5
- **输入**：design.md API 契约轮廓
- **产出文件**：
  - `api/Family/Controllers/FamilyController.cs`
- **完成标准**：
  1. 所有设计的端点已实现
  2. X-Family-Id 上下文解析正确
  3. 权限检查正确（家长操作需要家长角色）
  4. 错误返回使用 errors.json 定义的错误码
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

### 第 2 梯队：分享卡片后端

### Task 7: 后端 - 微信分享卡片信息查询

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 6
- **输入**：design.md 分享卡片设计
- **产出文件**：
  - `api/Family/Services/IShareService.cs`
  - `api/Family/Services/ShareService.cs`
- **完成标准**：
  1. 根据邀请码返回分享卡片信息（家庭名称/邀请人/目标角色）
  2. 验证邀请码有效性
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

### 第 3 梯队：前端基础页面

### Task 8: 前端 - 新增 API 封装 family.js

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6, Task 7
- **输入**：design.md API 端点列表、openspec/contracts/family/
- **产出文件**：
  - `app/services/family.js`
- **完成标准**：
  1. 所有端点已封装对应方法
  2. 自动携带 X-Family-Id Header（当有当前家庭时）
  3. 错误处理统一走 api.js 拦截器
- **验证命令**：`cd app && node -c "require('./services/family')" && echo "OK"`

### Task 9: 前端 - 首次引导页 + 创建家庭页面

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 8
- **输入**：需求文档 F1 家庭创建流程
- **产出文件**：
  - `app/pages/family-welcome/index.js`
  - `app/pages/family-welcome/index.wxml`
  - `app/pages/family-welcome/index.wxss`
  - `app/pages/family-welcome/index.json`
  - `app/pages/family-create/index.js`
  - `app/pages/family-create/index.wxml`
  - `app/pages/family-create/index.wxss`
  - `app/pages/family-create/index.json`
  - `app.json`（新增页面路由）
- **完成标准**：
  1. 无家庭用户登录后显示引导页
  2. 创建家庭页面支持输入名称 + 选择角色
  3. 提交后校验长度，创建成功跳转日历
  4. 所有可交互元素有 data-id
- **验证命令**：`cd app && node -c "require('./pages/family-welcome/index.js') && require('./pages/family-create/index.js')" && echo "OK"`

### Task 10: 前端 - 加入家庭页面（输入邀请码）

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 8
- **输入**：需求文档 F2 加入流程
- **产出文件**：
  - `app/pages/family-join/index.js`
  - `app/pages/family-join/index.wxml`
  - `app/pages/family-join/index.wxss`
  - `app/pages/family-join/index.json`
  - `app.json`（新增页面路由）
- **完成标准**：
  1. 支持输入 6 位邀请码
  2. 提交后调用 join-by-code API
  3. 成功跳转日历，失败显示对应错误提示
  4. 所有可交互元素有 data-id
- **验证命令**：`cd app && node -c "require('./pages/family-join/index.js')" && echo "OK"`

### 第 4 梯队：邀请流程前端

### Task 11: 前端 - 邀请成员页面（生成邀请码）

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 9, Task 10
- **输入**：需求文档 F2 邀请流程
- **产出文件**：
  - `app/pages/family-invite/index.js`
  - `app/pages/family-invite/index.wxml`
  - `app/pages/family-invite/index.wxss`
  - `app/pages/family-invite/index.json`
  - `app.json`（新增页面路由）
- **完成标准**：
  1. 支持选择邀请家长/孩子
  2. 邀请孩子需要输入孩子姓名 + 选择展示模式
  3. 生成后显示邀请码和有效期
  4. 所有可交互元素有 data-id
- **验证命令**：`cd app && node -c "require('./pages/family-invite/index.js')" && echo "OK"`

### Task 12: 前端 - 邀请记录列表 + 撤销

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 11
- **输入**：需求文档 F2 邀请管理
- **产出文件**：
  - `app/pages/family-invite-list/index.js`
  - `app/pages/family-invite-list/index.wxml`
  - `app/pages/family-invite-list/index.wxss`
  - `app/pages/family-invite-list/index.json`
  - `app.json`（新增页面路由）
- **完成标准**：
  1. 显示邀请记录列表（按状态分组）
  2. 待使用邀请显示撤销按钮
  3. 点击撤销后刷新列表
  4. 所有可交互元素有 data-id
- **验证命令**：`cd app && node -c "require('./pages/family-invite-list/index.js')" && echo "OK"`

### Task 13: 前端 - 分享卡片发起

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 7, Task 11
- **输入**：design.md 分享卡片设计
- **产出文件**：
  - 修改 `app/pages/family-invite/index.js`（添加分享按钮）
  - 修改 `app/pages/family-invite/index.wxml`（添加分享按钮）
- **完成标准**：
  1. 生成邀请码后显示"分享卡片"按钮
  2. 点击后调用 wx.shareAppMessage
  3. 分享路径携带邀请码参数
- **验证命令**：`cd app && node -c "require('./pages/family-invite/index.js')" && echo "OK"`

### 第 5 梯队：管理功能前端

### Task 14: 前端 - 成员列表与成员管理

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 12
- **输入**：需求文档 F3 成员管理
- **产出文件**：
  - `app/pages/family-members/index.js`
  - `app/pages/family-members/index.wxml`
  - `app/pages/family-members/index.wxss`
  - `app/pages/family-members/index.json`
  - `app.json`（新增页面路由）
  - 修改 `app/pages/mine/index.js`（跳转家庭成员管理）
- **完成标准**：
  1. 按家长/孩子分组显示成员列表
  2. 显示孩子展示模式
  3. 已注销成员灰色显示
  4. 家长点击成员弹出操作菜单（移除/转让/设置）
  5. 所有可交互元素有 data-id
  6. "我的"页面点击家庭区域正确跳转
- **验证命令**：`cd app && node -c "require('./pages/family-members/index.js') && require('./pages/mine/index.js')" && echo "OK"`

### Task 15: 前端 - 孩子展示模式设置 + 多家庭切换

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 14
- **输入**：需求文档 F4 展示模式、F5 多家庭切换
- **产出文件**：
  - `app/pages/family-display-mode/index.js`
  - `app/pages/family-display-mode/index.wxml`
  - `app/pages/family-display-mode/index.wxss`
  - `app/pages/family-display-mode/index.json`
  - `app/pages/family-switch/index.js`
  - `app/pages/family-switch/index.wxml`
  - `app/pages/family-switch/index.wxss`
  - `app/pages/family-switch/index.json`
  - `app.json`（新增两个页面路由）
  - 修改 `app/pages/mine/index.js`（跳转切换家庭）
  - 修改 `app/utils/storage-keys.js`（添加 CURRENT_FAMILY_ID 常量）
  - 修改 `app/services/api.js`（添加 X-Family-Id 注入）
- **完成标准**：
  1. 展示模式设置页面支持三模式选择，保存后更新
  2. 切换家庭页面显示所有家庭列表，标记当前
  3. 切换后保存当前家庭 ID 到本地，API 自动携带 X-Family-Id
  4. 单用户隐藏切换入口
  5. "我的"页面点击"切换家庭"正确跳转
  6. 所有可交互元素有 data-id
- **验证命令**：`cd app && node -c "require('./pages/family-display-mode/index.js') && require('./pages/family-switch/index.js')" && echo "OK"`

### Task 16: 前端/后端 - 退出解散恢复流程集成

- **负责 agent**：`dev-dotnet` / `dev-miniapp`（前后端都需要）
- **依赖**：Task 15
- **输入**：需求文档 F6 退出解散恢复
- **产出文件**：
  - 后端：修改 `api/Family/Services/FamilyLifecycleService.cs`（完成退出/解散/恢复完整逻辑）
  - 后端：修改 `api/Family/Controllers/FamilyController.cs`（添加退出/解散/恢复端点）
  - 前端：`app/pages/family-restore/index.js`
  - 前端：`app/pages/family-restore/index.wxml`
  - 前端：`app/pages/family-restore/index.wxss`
  - 前端：`app/pages/family-restore/index.json`
  - 前端：修改 `app/pages/family-members/index.wxml` / `.js`（添加退出/解散按钮）
- **完成标准**：
  1. 后端退出：检查创建者限制、最后家长限制，成功移除成员
  2. 后端解散：检查名称匹配，更新状态
  3. 后端恢复：检查过期，恢复状态
  4. 前端解散后恢复页面显示倒计时和恢复按钮
  5. 成员列表页底部显示退出/解散按钮
  6. 所有可交互元素有 data-id
- **验证命令**：后端 `dotnet test api/ --filter "FullyQualifiedName~FamilyLifecycleService"`, 前端 `cd app && node -c "require('./pages/family-restore/index.js')" && echo "OK"`
