# tasks: 修复「加入家庭」页邀请码输入框鬼影文字

> 无 spec 变更（`skip_specs: true`），无架构决策（纯 WXML/WXSS 渲染修复）。

## 1. 前端：移除 input 文字并迁移占位提示（dev-miniapp）

- [x] 1.1 修改 `app/miniapp/pages/family-join/index.wxml`：从 `.code-hidden-input` 移除 `value="{{code}}"` 与 `placeholder="点击输入"` 两个属性（保留 `type="number"`、`maxlength="6"`、`bindinput="onCodeInput"`、`data-id="join-family-code-input"`）；在 `wx:for` 循环的第一个 `.code-digit` 内、`<text wx:if="{{codeLength > index}}">` 之后，新增 `<text wx:elif="{{index === 0 && codeLength === 0}}" class="code-digit-placeholder">点击输入</text>`。验证：`cd app/miniapp && npm run build` 通过。
- [x] 1.2 修改 `app/miniapp/pages/family-join/index.wxss`：新增 `.code-digit-placeholder` 样式（`font-size: 24rpx; font-weight: 400; color: var(--color-text-placeholder)`）。验证：微信开发者工具中，未输入时首格内显示「点击输入」、其余 5 格为空；输入数字后提示消失、数字逐格填充，无重叠鬼影。

## 2. 回归验证（dev-miniapp + 主代理）

- [x] 2.1 现有逻辑测试回归：`cd app/miniapp-test && npx jest __tests__/pages/family-join.test.js` 通过（输入校验/提交逻辑未变）。
- [x] 2.2 全量前端测试：`cd app/miniapp-test && npx jest` 通过。
- [x] 2.3 构建与 lint：`cd app/miniapp && npm run build` 与 `cd app/miniapp && npm run lint` 均通过。
- [x] 2.4 变更校验：`openspec validate fix-family-join-code-input-ghost` 通过。
