# app/ · 微信小程序前端

家长端 + 孩子端在同一小程序内通过角色区分。首期页面见 [`../production/requirements/index.md`](../production/requirements/index.md) 第 6 节。

> **状态**：待开发。技术栈（原生小程序 / uni-app / Taro 等）在 Stage 2 架构设计确定，本文件届时补充构建/预览/测试命令。

## 编码约束

前端由 `dev-vue3` agent 编排 SDD 实现（若采用 Vue 技术栈），遵守：

- [`../.claude/rules/dev-code-quality.md`](../.claude/rules/dev-code-quality.md) — 命名、单一职责、YAGNI、复用优先
- [`../.claude/rules/dev-vue3-standards.md`](../.claude/rules/dev-vue3-standards.md) — Vue 3 规范，**含 `data-id` 可测试性契约**（所有可交互元素必加 `data-id`，测试据此定位，禁止用 CSS 类名/DOM 结构定位）
- [`../.claude/rules/design-ui-standards.md`](../.claude/rules/design-ui-standards.md) — UI 框架优先、设计令牌、响应式与可访问性

## 关键设计约束（源自产品需求）

- **双端角色区分**：家长端（规划管理）+ 孩子端（查看打卡），同一小程序内切换
- **孩子展示模式**：学龄前（3-6 岁，大色块/卡通图标）、小学（6-10 岁）、高年级（10-14 岁）三种视觉与交互（第二期）
- **三视图日历**：月 / 周 / 日视图切换，颜色区分日程类型
- **性能底线**：首屏 ≤ 2s、视图切换 ≤ 500ms、打卡响应 ≤ 1s
- **可用性**：创建日程流程 ≤ 3 步；空态/网络异常有友好提示

## 原型

交互原型（HTML 低保真）在 [`../production/prototype/`](../production/prototype/)，公共样式统一走 `common.css`。原型是验证稿，交互确认后转小程序组件实现，不入生产目录。