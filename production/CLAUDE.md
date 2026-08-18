# production/ · 产品需求与原型

产品需求文档与交互原型的存放地。需求是研发的真相源，动手编码前先读对应模块需求。

## 需求文档（requirements/）

| 文档 | 内容 | 状态 |
|------|------|:--:|
| [`requirements/index.md`](requirements/index.md) | 产品需求总纲：定位、用户角色、功能模块总览、非功能需求、分期规划、决策记录 | 草案 v1.1 |
| [`requirements/module-event.md`](requirements/module-event.md) | 日程管理模块详细设计：日程类型、时间槽模型、CRUD/编辑/删除/取消、详情页、日历视图、打卡与状态 | 已完成 |
| [`requirements/module-family.md`](requirements/module-family.md) | 家庭管理模块详细设计：创建/加入家庭、双轨邀请、成员管理、角色管理、孩子展示模式、多家庭切换、退出/解散 | 已完成 |

| [`requirements/module-auth.md`](requirements/module-auth.md) | 认证与账户模块详细设计：微信静默登录、昵称头像收集、JWT 登录态管理、用户资料、"我的"页面、账户注销 | 已完成 |
| [`requirements/module-template.md`](requirements/module-template.md) | 模板系统模块详细设计：模板字段结构、预设模板、创建流程、一键生成日程、模板管理、共享范围 | 已完成 |
| [`requirements/module-checkin.md`](requirements/module-checkin.md) | 打卡与统计模块详细设计：打卡时间窗口、完成统计、数据看板、连续完成、成就徽章、订阅消息提醒 | 已完成 |
| [`requirements/module-display-mode.md`](requirements/module-display-mode.md) | 孩子展示模式模块详细设计：学龄前/小学/高年级三种模式的页面结构、交互差异、打卡方式、模式切换机制 | 已完成 |

待创建模块：无。

## 模块实现进度

> 状态取值：`⬜` pending / `🔄` in-progress / `✅` done / `⛔` blocked。此表与各 staging 目录 STATUS.md 同步更新。

| 模块 | Stage 1 产品 | Stage 2 设计 | Stage 3 研发 | Stage 4 测试 | Stage 5 归档 | OpenSpec |
|------|:--:|:--:|:--:|:--:|:--:|------|
| 日程管理 | ✅ | ✅ | ✅ | ✅ | ✅ | add-event-module (archived) |
| 认证 | ✅ | ✅ | ✅ | ✅ | ✅ | add-auth-module (archived) |
| 打卡 | ✅ | ✅ | ✅ | ✅ | ✅ | add-checkin-module (archived) |
| 家庭 | ✅ | ✅ | ⬜ | ⬜ | ⬜ | add-family-module |
| 模板 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 展示模式 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |

- **日程管理**：全流程完成（五阶段 done），OpenSpec 已归档
- **认证**：全流程完成（五阶段 done），OpenSpec 已归档
- **打卡**：全流程完成（五阶段 done），OpenSpec 已归档
- **家庭**：Stage 2 设计完成（OpenSpec 变更 add-family-module 进行中），待进入 Stage 3 研发
- **模板 / 展示模式**：requirements/ 文档已完成，尚未进入 staging 流程
- **归档**：模块完成后由 `archiver` agent 两步归档——OpenSpec 变更 → `openspec/changes/archive/`，staging 目录 → `production/archive/`

## 需求文档规范

编写/修改需求遵守 [`../.claude/rules/req-staging.md`](../.claude/rules/req-staging.md)：

- 每条需求可验证、必含验收标准、边界与异常明确、优先级分级、去歧义
- **不做数据库字段设计**（属技术设计阶段）
- 需求真相源为 `openspec/specs/`，变更走 OpenSpec 流程（[`../.claude/rules/openspec-workflow.md`](../.claude/rules/openspec-workflow.md)）
- staging 管 SDLC 全生命周期，OpenSpec 管开发阶段，两者通过握手点衔接

## 原型（prototype/）

HTML 低保真交互原型，验证交互而非视觉。遵守 [`../.claude/rules/design-ui-standards.md`](../.claude/rules/design-ui-standards.md)：

- 公共样式（设计令牌/Reset/布局骨架）统一放 `prototype/common.css`，各页面 `<link>` 引用，禁止复制粘贴
- 原型阶段不引入 UI 框架 JS/CSS；覆盖正常态/空态/错误态/loading 态
- 原型是验证稿，不入 `src/` 生产目录
