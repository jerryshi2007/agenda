# auth-profile Specification

## Purpose
TBD - created by archiving change add-auth-module. Update Purpose after archive.
## Requirements
### Requirement: 昵称头像收集页
系统 MUST 在用户首次登录且尚未设置过昵称头像时展示收集页。收集页 MUST 使用微信原生控件（chooseAvatar + nickname input），MUST 支持一键跳过。跳过时使用默认值。

#### Scenario: 首次登录展示收集页
- **WHEN** 用户首次登录成功 AND 尚未设置过昵称头像（使用默认值）
- **THEN** 系统展示收集页：默认头像占位图 + 昵称输入框（预填微信昵称） + "开始使用"按钮

#### Scenario: 设置头像
- **WHEN** 收集页展示 AND 用户点击头像区域
- **THEN** 系统弹出微信头像选择器（open-type="chooseAvatar"），选择后实时预览

#### Scenario: 设置昵称
- **WHEN** 收集页展示 AND 用户点击昵称输入框
- **THEN** 系统弹出微信昵称面板（type="nickname"），预填当前微信昵称，用户确认后回填

#### Scenario: 跳过收集
- **WHEN** 收集页展示 AND 用户点击"开始使用"而未设置昵称头像
- **THEN** 系统使用默认值（昵称"微信用户" + 灰色默认头像占位图），进入下一流程

#### Scenario: 再次登录不展示收集页
- **WHEN** 用户之前已设置或跳过昵称头像 AND 再次登录
- **THEN** 系统跳过收集页，直接进入主流程

#### Scenario: 提交时网络异常
- **WHEN** 用户已选择头像和昵称 AND 点击"开始使用"时网络不可用
- **THEN** 系统本地暂存修改内容，网络恢复后自动补传，期间用户可正常使用（显示本地暂存值）

### Requirement: 用户资料编辑
系统 MUST 在"我的"页面提供进入编辑资料页的入口。编辑页 MUST 支持头像更换和昵称修改，MUST 在保存前做前端校验，MUST 在后端做二次校验。

#### Scenario: 进入编辑页
- **WHEN** 用户在"我的"页面 AND 点击头像/昵称区域
- **THEN** 系统跳转编辑资料页，显示当前头像（可更换）+ 当前昵称（可修改）+ 保存按钮

#### Scenario: 修改头像
- **WHEN** 编辑页展示 AND 用户点击"更换头像"
- **THEN** 系统弹出微信头像选择器，选择后实时预览，点击保存后上传

#### Scenario: 修改昵称
- **WHEN** 编辑页展示 AND 用户修改昵称内容
- **THEN** 点击保存后提交到后端，返回"我的"页面并刷新显示

#### Scenario: 昵称为空
- **WHEN** 编辑页展示 AND 用户清空昵称后点击保存
- **THEN** 前端拦截，提示"昵称不能为空"

#### Scenario: 昵称过长
- **WHEN** 用户输入超过 20 字符的昵称
- **THEN** 输入框限制长度 maxlength=20，后端二次校验

#### Scenario: 昵称含敏感词
- **WHEN** 用户输入含敏感词的昵称并保存
- **THEN** 后端校验拒绝保存，提示"昵称包含不允许的词汇"

#### Scenario: 保存时网络异常
- **WHEN** 编辑页展示 AND 用户修改了内容 AND 点击保存时网络不可用
- **THEN** 提示"保存失败，请检查网络"，保留用户输入内容不清空

### Requirement: 头像上传事务一致性
当用户同时修改头像和昵称时，若头像上传失败，MUST 不同时保存昵称修改，保证事务一致性。

#### Scenario: 头像上传失败不保存昵称
- **WHEN** 编辑页展示 AND 用户同时修改了头像和昵称 AND 头像上传接口返回失败
- **THEN** 系统提示"头像上传失败，请重试"，不同时保存昵称修改

#### Scenario: 仅修改昵称正常保存
- **WHEN** 编辑页展示 AND 用户仅修改了昵称（未修改头像）
- **THEN** 直接提交昵称修改到后端，成功后返回"我的"页面

### Requirement: 微信原生控件使用
昵称收集和编辑 MUST 使用 `<input type="nickname">`，头像收集和更换 MUST 使用 `<button open-type="chooseAvatar">`。

#### Scenario: 使用 nickname input 收集昵称
- **WHEN** 用户点击昵称输入框
- **THEN** 弹出微信原生昵称面板，用户选择后回填

#### Scenario: 使用 chooseAvatar 收集头像
- **WHEN** 用户点击头像区域
- **THEN** 弹出微信原生头像选择器，用户选择后回填

