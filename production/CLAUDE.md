# production/ · 产品需求与原型

产品需求文档与交互原型的存放地。需求是研发的真相源，动手编码前先读对应模块需求。

## 需求文档（requirements/）

| 文档 | 内容 | 状态 |
|------|------|:--:|
| [`requirements/index.md`](requirements/index.md) | 产品需求总纲：定位、用户角色、功能模块总览、非功能需求、分期规划、决策记录 | 草案 v1.1 |
| [`requirements/module-event.md`](requirements/module-event.md) | 日程管理模块详细设计：日程类型、时间槽模型、CRUD/编辑/删除/取消、详情页、日历视图、打卡与状态 | 已完成 |
| [`requirements/module-family.md`](requirements/module-family.md) | 家庭管理模块详细设计：创建/加入家庭、双轨邀请、成员管理、角色管理、孩子展示模式、多家庭切换、退出/解散 | 已完成 |

| [`requirements/module-auth.md`](requirements/module-auth.md) | 认证与账户模块详细设计：微信静默登录、昵称头像收集、JWT 登录态管理、用户资料、"我的"页面、账户注销 | 已完成 |

待创建模块：模板系统、打卡与统计、孩子展示模式。

## 需求文档规范

编写/修改需求遵守 [`../.claude/rules/req-spec.md`](../.claude/rules/req-spec.md)：

- 每条需求可验证、必含验收标准、边界与异常明确、优先级分级、去歧义
- **不做数据库字段设计**（属技术设计阶段）
- 需求真相源为 `openspec/specs/`，变更走 OpenSpec 流程（[`../.claude/rules/openspec-workflow.md`](../.claude/rules/openspec-workflow.md)）

## 原型（prototype/）

HTML 低保真交互原型，验证交互而非视觉。遵守 [`../.claude/rules/design-ui-standards.md`](../.claude/rules/design-ui-standards.md)：

- 公共样式（设计令牌/Reset/布局骨架）统一放 `prototype/common.css`，各页面 `<link>` 引用，禁止复制粘贴
- 原型阶段不引入 UI 框架 JS/CSS；覆盖正常态/空态/错误态/loading 态
- 原型是验证稿，不入 `src/` 生产目录