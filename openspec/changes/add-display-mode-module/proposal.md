## Why

孩子展示模式是家庭日程协作工具的核心差异化功能——根据孩子年龄（学龄前/小学/高年级）提供适配认知水平的不同 UI 体验。家长可为每个孩子配置展示模式，孩子端根据配置渲染不同界面，提升孩子使用体验和完成率。当前已完成需求分析并进入 dev-ready 状态，需进行架构设计和任务分解。

## What Changes

- **新增**：孩子端展示模式渲染机制 — JWT 携带展示模式，前端根据模式选择不同渲染逻辑
- **新增**：小学模式基准视图（一期全量开发）—— 今日/周/月只读视图 + 直接打卡 + 本周完成率统计
- **扩展**：FamilyMember 实体已存在 DisplayMode 字段，后端已支持设置 API，无需新增数据库字段
- **扩展**：小程序新增孩子端专属页面（今日/周/月/我的），与家长端页面分离
- **扩展**：认证流程 JWT payload 增加 displayMode 字段，孩子端登录后可直接获取

## Capabilities

### New Capabilities
- `display-mode`: 孩子展示模式模块，包含三模式定义、渲染机制、一期小学模式实现

### Modified Capabilities
- `family`: 家庭成员展示模式配置（已在家庭模块定义 API，本次仅扩展前端使用）
- `auth`: JWT payload 增加 displayMode 字段传递给前端

## Impact

- **后端**：`Agenda.Api.Domain`（枚举已存在）、`Agenda.Api.Auth`（JWT 扩展）、`Agenda.Api.Schedule`（孩子端查询权限已支持）
- **前端**：新增 4 个孩子端页面（schedule-child-today / schedule-child-week / schedule-child-month / child-mine）、扩展 contracts/family.js 已有枚举、新增 service 层
- **数据库**：DisplayMode 字段已存在于 FamilyMember，无需迁移
