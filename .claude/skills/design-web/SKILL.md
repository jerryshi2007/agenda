---
name: design-web
description: 出 Web 应用原型时使用——低保真 HTML 原型验证交互（Element Plus / Ant Design 风格）
rules: [design-ui-standards]
---

# design-web · 前端原型设计

## 流程

1. **明确验证目标**——这个界面要解决什么用户问题？关键交互流程是什么？
2. **确认风格基调**——根据选定的设计系统（Element Plus / Ant Design / 项目标准）调整原型中的色彩和间距基调。
3. **产出低保真 HTML 原型**
   - 全局框架页：`production/prototypes/index.html` — 布局骨架 + 侧边栏菜单
   - 公共样式：`production/prototypes/common.css` — 设计令牌 + Reset + 布局骨架，体现风格基调
   - 子页面：按功能模块分目录（如 `foundation/bizlines.html`）
   - 页面 HTML 只写自己特有的 `<style>`，通过 `<link rel="stylesheet" href="../common.css">` 引用公共样式
   - 原型阶段不引入 UI 框架 JS/CSS
4. **覆盖 4 态**——正常态、空态、错误态、loading 态，缺一不可。
5. **标注交互流程**——关键操作→状态变化→反馈，标注在原型旁。
6. **展示确认**——与需求方确认流程与状态覆盖，确认后才算完成。

## 示例

- 原型 `production/prototypes/login.html`：含 logo / 账号密码输入 / 登录按钮 / 密码显隐，标注"点登录→loading→成功跳首页 / 失败提示 ACCOUNT_LOCKED"。用 `<input>` + `<button>` 占位，不引入 UI 框架。
