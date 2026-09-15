# design: 修复「加入家庭」页邀请码输入框鬼影文字

## Context

动机与范围见 [proposal.md](./proposal.md)。本变更是一次纯 WXML/WXSS 修改（移除两个 input 属性 + 新增一处条件渲染 + 一行样式），无新功能、无数据/契约迁移。

现状：`pages/family-join/` 用「隐藏透明 input 覆盖 6 个格子」的验证码输入模式（`.code-hidden-input` 为 `opacity: 0; position: absolute`，盖在 `.code-input-group` 上，靠点击透传唤起数字键盘）。前一变更已把 input 移入 `.code-input-group` 并补 `z-index: 1`，使 input 正确盖到格子；但 input 仍绑定 `value="{{code}}"` 与 `placeholder="点击输入"`，这两段文字由微信客户端原生组件层绘制，`opacity: 0` 无法遮蔽，聚焦时透出形成鬼影。

## 现状对账清单

| 文件 | 处理 | 说明 |
|------|:--:|------|
| `app/miniapp/pages/family-join/index.wxml` | 修改 | `.code-hidden-input` 移除 `value="{{code}}"` 与 `placeholder="点击输入"`；第一个 `.code-digit` 格子内新增 `wx:elif="{{index === 0 && codeLength === 0}}"` 的占位 `<text>` |
| `app/miniapp/pages/family-join/index.wxss` | 修改 | 新增 `.code-digit-placeholder` 样式 |
| `app/miniapp/pages/family-join/index.js` | 复用（不改） | `onCodeInput` / `onSubmit` / `_isValidCode` 逻辑不变 |
| `app/miniapp/pages/family-join/index.json` | 复用（不改） | 无变化 |
| `app/miniapp-test/__tests__/pages/family-join.test.js` | 复用（不改） | 逻辑测试不涉及 WXML/CSS 渲染 |

无「新建」文件，无后端/契约改动，无实体字段扩展。

## Goals / Non-Goals

**Goals:**
- 消除邀请码输入框聚焦时透出的「点击输入」与 value 数字两个鬼影，让 6 个分格与真实数字清晰可辨、不叠加。

**Non-Goals:**
- 不改输入校验规则（仅 2-9、6 位）、不改提交逻辑、不改 `joinByCode` API、不改任何 spec 需求。
- 不新增 WXML/CSS 渲染自动化测试（测试项目无此能力，见 D4）。

## Decisions

### D1：移除 input 的 `value` 与 `placeholder`，而非继续用 CSS 遮蔽文字

鬼影来自原生 `<input>` 组件层自绘的 `value`/`placeholder` 文字，`opacity: 0` 只作用于 webview 层，遮蔽不可靠。最彻底的修法是让 input 内部不再持有任何文字——移除 `value` 绑定与 `placeholder` 属性，数字展示完全交给外层 `.code-digit` 的 `<text>`，占位提示交给外层条件渲染。

- 备选 A：改用 `color: transparent` + `caret-color: transparent` 替代 `opacity: 0` —— 否决，placeholder 仍需单独隐藏，且部分 iOS 上 `color: transparent` 对原生 input 文字层同样不可靠，未触及根因。
- 备选 B：input 宽度缩到单格（88rpx）并随 `codeLength` 动态算 `left` —— 否决，需引入动态坐标计算，复杂度高、体验脆弱，违背最小化原则。
- 备选 C：`visibility: hidden` / `display: none` 隐藏 input —— 否决，会使 input 失去焦点能力，无法唤起数字键盘。

### D2：占位提示用外层 `<text>` 条件渲染，而非保留 input placeholder

「点击输入」提示在 `codeLength === 0 && index === 0` 时渲染于第一个格子内，样式独立（`.code-digit-placeholder`）。输入任意位后 `codeLength > 0`，`wx:elif` 使提示消失、显示真实数字。

- 备选 A：把提示放在 `.code-input-group` 外单独一行 —— 否决，占位提示应紧贴输入区（分格内），且单独一行会改变现有视觉布局。

### D3：移除 `value` 后 input 与 data 状态解耦

input 不再持有受控 value，`onCodeInput` 仍通过 `e.detail.value` 拿到客户端内部缓存的完整输入串，过滤后写回 `data.code` 驱动外层格子。此页面为一次性输入（提交后 `switchTab` 跳转），不存在「返回页面需回填 input 内部值」的同步需求。

- 影响面：若未来新增「编辑邀请码」或「返回保留输入」能力，需重新绑定 value 或重建 input 内部状态——当前无此需求（YAGNI），记录于此处。

### D4：不新增 WXML 渲染测试

测试项目（Jest + 自定义 `helpers/page.js`）仅捕获 `Page()` 配置做 JS 逻辑测试，无 WXML/CSS 渲染能力（无 miniprogram-simulate）。本 bug 属纯渲染层，自动化无法覆盖。验证以「现有逻辑测试回归 + 微信开发者工具真机/模拟器人工目检」为准。

## Risks / Trade-offs

- [移除 value 后 input 内部值与 data 脱节] → 本页一次性输入、提交即跳转，无回填需求；`e.detail.value` 仍可完整取回输入串，不影响逻辑。
- [某些机型上外层格子与键盘输入仍有延迟/不同步] → `onCodeInput` 即改 `data.code`，与现状一致；DevTools 在 iOS/Android 两套机型目检兜底。
- [「点击输入」占位在首格内显示可能过窄截断] → 占位字号 24rpx、首格宽 88rpx，四字提示可容纳；目检确认，若截断再调字号/改短文案。
- [无自动化回归拦截此类渲染回归] → 已知限制，记录于 D4；后续如引入 miniprogram-simulate 可补渲染测试（不属本变更范围）。

## Migration Plan

无数据库/契约迁移。代码合入按 `.claude/rules/git-commit.md` 一事一提交（`fix: 修复加入家庭页邀请码输入框鬼影文字`）。

## Open Questions

（无）
