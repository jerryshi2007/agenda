---
description: UI 标准与原型规范——出原型或实现前端界面时遵循。
---

# design-ui-standards · UI 标准与原型规范

## 约束

**UI 框架优先（核心原则）**
- **基于成熟开源 UI 框架构建界面，不重复造轮子。** 按钮、表格、弹窗、表单、输入框、选择器、树、分页、Tabs、消息提示、Loading、Alert 等通用组件——框架已有的必须用框架，禁止手写。重复造轮子浪费开发时间、引入 bug、失去框架内建的无障碍与键盘导航能力。
- **项目支持的 UI 框架**：
  - **Element Plus** — 企业级中后台首选，组件成熟、中文生态完善、Table/Tree/Form 能力最强
  - **Ant Design Vue** — 蚂蚁设计体系，适合需要与 React 版 Ant Design 保持一致的项目
  选型确定后全项目统一，不混用多套框架。
- **样式定制走所选框架的主题系统**——Element Plus 的 CSS 变量（`--el-color-primary` 等）/ Ant Design Vue 的 ConfigProvider + theme token。**禁止** `:deep()` 大量覆盖框架组件内部样式（框架升级时内部样式可能变化，深度覆盖导致升级困难）。穿透自定义子组件根节点做局部样式调整允许，但应优先用 props/slots 控制变体。禁止给框架组件全局强制覆写。
- **仅框架无对应组件时才自研**——自研前先评审"是否确实无此组件"、"是否可组合现有组件实现"。自研组件需遵守设计令牌、可访问性、响应式等相同标准。

**设计令牌优先**
- 颜色、间距、字号、圆角、阴影统一走设计令牌（token），不硬编码裸值。保证全局一致与主题切换。令牌定义应与所选 UI 框架的主题变量对接（如映射到 Element Plus 的 `--el-color-primary` 或 Ant Design Vue 的 `token.colorPrimary`），避免维护两套独立变量体系。Vue 3 实现方式：在 `web/src/styles/tokens.css` 中将自定义 CSS 变量映射到框架主题变量（如 `--color-primary: var(--el-color-primary)`），详见 `dev-vue3-standards` rule。
- 组件复用优先（遵循 `dev-code-quality` rule 复用优先原则）——框架组件能实现就别重造，避免 UI 分裂。

**响应式与可访问性底线**
- 断点适配主流视口；不写死像素宽度导致窄屏溢出。
- 可交互元素有焦点态、有 aria 语义、键盘可达；图片有 alt、颜色对比度达标。**框架组件自带大部分无障碍能力，优先依赖框架，不要手动额外添加冗余 ARIA 属性。**

**一致性**
- 同类操作同类视觉（按钮风格、表单布局、间距规则统一），降低用户认知成本。统一走框架组件默认风格 + 主题定制，不各自写风格。

**原型阶段（HTML 原型）**
- 交互优先于视觉——原型用来验证"交互对不对"，低保真够讨论即可，不纠结像素。
- 标注关键流程与状态——含正常态、空态、错误态、loading 态，不只画正常路径。
- 低保真先于高保真——先用骨架定流程，再逐步加视觉细节。
- **原型 HTML 是验证稿，不是生产代码**——交互确认后转项目框架（Vue 3 + Element Plus / Ant Design Vue 等）组件实现，原型本身不入 `src/` 生产目录。
- **公共样式统一管理**——设计令牌（CSS 变量）、Reset、布局骨架统一放在 `production/prototypes/common.css`，所有页面通过 `<link rel="stylesheet" href="common.css">` 引用。每个页面 HTML 只写自己特有的样式，禁止复制粘贴公共样式。**原型阶段不引入 UI 框架 JS/CSS**，通用组件样式（按钮/表格/弹窗等）无需手写在 `common.css`——生产阶段由框架提供。

## 示例

- ✅ 原型阶段：`production/prototypes/common.css` 统一定义 token + Reset + 布局骨架；`production/prototypes/index.html` 只写布局和页面特有内容，通过 `<link rel="stylesheet" href="common.css">` 引用公共样式。`production/prototypes/foundation/bizlines.html` 引用 `../common.css`，只写业态列表特有的样式。
- ✅ 原型阶段：一个 `production/prototypes/login.html` 仅含结构 + 占位样式，标注"点登录→loading→成功跳转 / 失败提示 ACCOUNT_LOCKED"；确认后用项目 LoginForm 组件重写
- ❌ 直接在 `src/components/Login.tsx` 里一边试交互一边定样式，原型与生产代码混在一起
- ❌ 每个原型 HTML 各自复制一份 token 定义和表格/按钮/弹窗样式
