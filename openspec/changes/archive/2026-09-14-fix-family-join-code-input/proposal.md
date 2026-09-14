# proposal: 修复「加入家庭」页邀请码输入框无法点击

## Why

「加入家庭」页（`pages/family-join/`）的 6 位邀请码输入框在真机/模拟器上显示为灰色、点击无反应，用户无法通过输入邀请码加入家庭（仅能从分享卡片预填邀请码走通）。这违反了 spec 中「邀请码加入」需求（[openspec/specs/family-invite/spec.md](../../specs/family-invite/spec.md) 的 Requirement「邀请码加入」：用户 SHALL 能输入邀请码加入家庭）。

根因是验证码输入的「隐藏透明 input 覆盖」模式定位错误：真实 `<input>` 用 `position: absolute; top: 0; left: 0; opacity: 0` 盖在 6 个格子上方，但其父级 `.invite-code-section` 没有 `position: relative`，而唯一 `position: relative` 的 `.code-input-group` 是它的**兄弟节点而非父节点**——于是 input 相对页面根定位，浮在页面最顶部一条不可见横条，根本没盖到格子上。趁家庭模块刚归档、无存量依赖时一次性修掉。

## What Changes

- **修复隐藏 input 的定位容器**
  - 将 `pages/family-join/index.wxml` 中的 `<input class="code-hidden-input">` 从 `.invite-code-section` 的直接子级移动到 `.code-input-group`（该容器已有 `position: relative`）内部，使其 `position: absolute` 正确相对 6 个格子定位。
  - 在 `index.wxss` 的 `.code-hidden-input` 补充 `z-index: 1`，确保透明层盖在格子之上（DOM 靠后默认在上，属保险性声明）。
- **不改任何逻辑/契约/后端**：输入校验（仅 2-9、6 位）、`onCodeInput` / `onSubmit`、`familyService.joinByCode`、API 契约均保持不变。

## How

纯 WXML 结构调整（移动一个 `<input>` 节点）+ 一行可选 CSS。无新功能、无数据变更、无 API 影响、无数据库迁移。

- 移动后 `<input>` 因 `position: absolute` 脱离文档流，不影响 `.code-input-group` 内 6 个格子的 flex 布局。
- 由 `dev-miniapp` 承担。自动化验证受限于测试项目仅做 JS 逻辑测试（无 WXML 渲染能力），最终以微信开发者工具人工目检为准，配合现有 Jest 逻辑测试回归兜底。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——本变更不改任何 spec 级需求行为。spec「邀请码加入」需求本就要求用户能输入邀请码，问题只在实现层 CSS 定位。故本变更 `skip_specs: true`，不产出 delta spec。）

## Impact

- **前端**：`app/miniapp/pages/family-join/index.wxml`（移动 `<input>` 节点）、`index.wxss`（补 `z-index: 1`）
- **测试**：现有 `app/miniapp-test/__tests__/pages/family-join.test.js` 为 JS 逻辑测试，不受 WXML 结构调整影响，无需改断言；无 WXML 渲染测试能力，本修复以 DevTools 人工目检为准
- **后端 / 契约**：无
