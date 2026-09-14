# tasks: 修复「加入家庭」页邀请码输入框定位

> 无 spec 变更（`skip_specs: true`），无架构决策（纯 WXML/CSS 布局修复）。

## 1. 前端：移动隐藏 input 节点（dev-miniapp）

- [x] 1.1 修改 `app/miniapp/pages/family-join/index.wxml`：将 `<input class="code-hidden-input">`（含 `type="number"`、`maxlength="6"`、`value`、`bindinput`、`data-id="join-family-code-input"` 等属性）从 `.invite-code-section` 的直接子级移动到 `.code-input-group` 内部（6 个 `code-digit` 之后），其余属性保持不变。验证：`cd app/miniapp && npm run build` 通过。
- [x] 1.2 修改 `app/miniapp/pages/family-join/index.wxss`：给 `.code-hidden-input` 增加 `z-index: 1`。验证：微信开发者工具中点击 6 个灰色格子可唤起数字键盘，输入数字后格子逐一填充。

## 2. 回归验证（dev-miniapp + 主代理）

- [x] 2.1 现有逻辑测试回归：`cd app/miniapp-test && npx jest __tests__/pages/family-join.test.js` 通过（输入校验/提交逻辑未变）。
- [x] 2.2 全量前端测试：`cd app/miniapp-test && npx jest` 通过。
- [x] 2.3 契约/安全 lint：`cd app/miniapp && npm run lint` 通过。
- [x] 2.4 变更校验：`openspec validate fix-family-join-code-input` 通过。
