# proposal: 修复「加入家庭」页邀请码输入框鬼影文字

## Why

「加入家庭」页（`pages/family-join/`）的 6 位邀请码输入框在真机上存在两个视觉鬼影：未输入时浮出「点击输入」文字，输入后格子中间重叠显示一串小号邀请码数字。根因是验证码「隐藏透明 input 覆盖」模式用 `opacity: 0` 遮蔽原生 `<input>` 的 `placeholder` 与 `value` 文字，但微信小程序的 `<input>` 是原生组件，其文字层由客户端独立绘制，`opacity` 无法可靠遮蔽，聚焦（键盘弹出）时 `placeholder`/`value` 文字会透出。

本缺陷违反了 spec 中「邀请码加入」需求的隐含前提（[openspec/specs/family-invite/spec.md](../../specs/family-invite/spec.md) 的 Requirement「邀请码加入」：用户 SHALL 能输入邀请码加入家庭）——输入框应正常展示 6 个分格与所填数字，而非叠加一串无法辨识的鬼影文字。趁前一变更（`fix-family-join-code-input`）刚归档、无存量依赖时一次性修掉。

## What Changes

- **隐藏 input 不再承载任何可见文字**
  - 移除 `pages/family-join/index.wxml` 中 `.code-hidden-input` 上的 `value="{{code}}"`（消除 value 文字鬼影）与 `placeholder="点击输入"`（消除 placeholder 鬼影）。该 input 仅保留 `type="number"`、`maxlength="6"`、`bindinput="onCodeInput"`、`data-id="join-family-code-input"`，专职接收键盘输入。
  - 将「点击输入」占位提示改为由外层第一个 `.code-digit` 格子内条件渲染：`codeLength === 0 && index === 0` 时显示 `<text class="code-digit-placeholder">点击输入</text>`，其余情况显示真实数字（已有 `code[index]` 逻辑不变）。
- **新增占位提示样式**
  - 在 `index.wxss` 新增 `.code-digit-placeholder`（浅色小字），视觉上替代原 input placeholder。
- **不改任何逻辑/契约/后端**：输入校验（仅 2-9、6 位）、`onCodeInput` / `onSubmit`、`familyService.joinByCode`、API 契约均保持不变。真实数字仍由 `.code-digit` 内 `<text>{{code[index]}}</text>` 渲染。

## How

纯 WXML/WXSS 修改（移除两个属性 + 新增一处条件渲染 + 一行样式），无新功能、无数据变更、无 API 影响、无数据库迁移。

- 移除 `value` 绑定后，input 内部不再持有文字；数字展示完全由外层 6 个格子负责，二者不再叠加。
- 「点击输入」提示在未输入时于第一个格子内显示一次（`wx:elif` 控制），输入任意位后即消失。
- 由 `dev-miniapp` 承担。自动化验证受限于测试项目仅做 JS 逻辑测试（无 WXML 渲染能力），最终以微信开发者工具真机/模拟器人工目检为准，配合现有 Jest 逻辑测试回归兜底。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——本变更不改任何 spec 级需求行为。spec「邀请码加入」需求本就要求用户能输入邀请码并看到正确的输入反馈，鬼影属实现层 CSS 遮蔽不彻底，不新增/修改需求。故本变更 `skip_specs: true`，不产出 delta spec。）

## Impact

- **前端**：`app/miniapp/pages/family-join/index.wxml`（移除 input 的 `value`/`placeholder`，第一个格子新增条件渲染占位提示）、`index.wxss`（新增 `.code-digit-placeholder` 样式）
- **测试**：现有 `app/miniapp-test/__tests__/pages/family-join.test.js` 为 JS 逻辑测试，不涉及 WXML/CSS 渲染，无需改断言；无 WXML 渲染测试能力，本修复以 DevTools 人工目检为准
- **后端 / 契约**：无
