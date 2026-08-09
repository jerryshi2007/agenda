# app/ · 微信小程序前端

家长端 + 孩子端在同一小程序内通过角色区分。首期页面见 [`../production/requirements/index.md`](../production/requirements/index.md) 第 6 节。

> **状态**：开发中。技术栈：微信小程序原生框架（WXML/WXSS/JS）。日程管理模块前端代码已创建，日历首页、创建/编辑/详情页面、11 个组件、3 个 Service、2 个 Util、3 个公共样式文件就绪。

## 构建/调试命令

- 使用**微信开发者工具**打开 `app/` 目录
- 开发 → `npm run dev`（如有）
- 微信开发者工具编译预览 → 生成小程序码在手机预览
- 无需 `npm install`（本项目使用原生框架，不依赖 npm 包）

## 编码约束

前端由 `dev-miniapp` agent 编排 SDD 实现，遵守：

- [`../.claude/rules/dev-miniapp-standards.md`](../.claude/rules/dev-miniapp-standards.md) — 微信小程序编码规范，**含 `data-id` 可测试性契约**（所有可交互元素必加 `data-id`，测试据此定位，禁止用 CSS 类名/WXML 标签嵌套路径定位）
- [`../.claude/rules/ui-miniapp-standards.md`](../.claude/rules/ui-miniapp-standards.md) — 小程序 UI 标准（WeUI 设计变量、rpx 单位、原生组件层级、安全区域适配）
- [`../.claude/rules/dev-code-quality.md`](../.claude/rules/dev-code-quality.md) — 命名、单一职责、YAGNI、复用优先
- [`../.claude/rules/dev-security.md`](../.claude/rules/dev-security.md) — 安全底线（外部输入必校验、不硬编码密钥、openid 不暴露前端日志）

## 关键设计约束（源自产品需求）

- **双端角色区分**：家长端（规划管理）+ 孩子端（查看打卡），同一小程序内切换
- **孩子展示模式**：学龄前（3-6 岁，大色块/卡通图标）、小学（6-10 岁）、高年级（10-14 岁）三种视觉与交互（第二期）
- **三视图日历**：月 / 周 / 日视图切换，颜色区分日程类型
- **性能底线**：首屏 ≤ 2s、视图切换 ≤ 500ms、打卡响应 ≤ 1s
- **可用性**：创建日程流程 ≤ 3 步；空态/网络异常有友好提示

## 原型

交互原型（HTML 低保真）在 [`../production/prototype/`](../production/prototype/)，公共样式统一走 `common.css`。原型是验证稿，交互确认后转小程序组件实现，不入生产目录。