# design: 修复「加入家庭」页邀请码输入框定位

## Context

动机与范围见 [proposal.md](./proposal.md)。本变更是一次纯 WXML 结构调整 + 一行 CSS 保险声明，无新功能、无数据/契约迁移。

现状：`pages/family-join/` 用「隐藏透明 input 覆盖 6 个格子」的验证码输入模式（`code-hidden-input` 为 `opacity: 0`，靠点击透传到 `<input>` 唤起数字键盘）。但 input 的 `position: absolute; top: 0; left: 0` 相对页面根定位，未覆盖到格子。

## 现状对账清单

| 文件 | 处理 | 说明 |
|------|:--:|------|
| `app/miniapp/pages/family-join/index.wxml` | 修改 | 将 `<input class="code-hidden-input">` 从 `.invite-code-section` 直接子级移动到 `.code-input-group` 内部 |
| `app/miniapp/pages/family-join/index.wxss` | 修改 | `.code-hidden-input` 补 `z-index: 1` |
| `app/miniapp/pages/family-join/index.js` | 复用（不改） | `onCodeInput` / `onSubmit` 逻辑不变 |
| `app/miniapp/pages/family-join/index.json` | 复用（不改） | 无变化 |
| `app/miniapp-test/__tests__/pages/family-join.test.js` | 复用（不改） | 逻辑测试不受 WXML 结构调整影响 |

无「新建」文件，无后端/契约改动，无实体字段扩展。

## Goals / Non-Goals

**Goals:**
- 让用户点击 6 个灰色格子时正确聚焦隐藏 input、唤起数字键盘，输入邀请码。

**Non-Goals:**
- 不改输入校验规则（仅 2-9、6 位）、不改提交逻辑、不改 `joinByCode` API、不改任何 spec 需求。

## Decisions

### D1：移动 input 进 `.code-input-group`，而非给 `.invite-code-section` 加 `position: relative`

给 `.invite-code-section` 加 `position: relative` 会让 input 的 `top: 0` 定位到 section 顶部（title 文字之上），仍不对齐格子。而 `.code-input-group` 已有 `position: relative`，将 input 移入其内部后 `top: 0; left: 0` 正好覆盖格子。

- 备选 A：给 section 加 `position: relative` 并硬编码 `top` 偏移跳过 title 高度 —— 否决，脆且需写死 title 高度。
- 备选 B：弃用「隐藏 input 覆盖」模式，改为 6 个独立 input 或单个显式 input —— 否决，改变既有视觉设计（分格样式），改动面大，违背本变更最小化原则。

### D2：input 因 `position: absolute` 脱离文档流，不影响 flex 布局

`.code-input-group` 是 `display: flex`。绝对定位的 input 不参与 flex 布局，6 个格子的 `justify-content: center` + `gap` 不受影响。这是选 D1 而非其他方案的布局依据。

### D3：`z-index: 1` 作为保险而非必需

input 是 `.code-input-group` 的最后一个子节点且绝对定位，按绘制顺序默认盖在格子之上。补 `z-index: 1` 消除任何机型/渲染顺序上的层叠不确定性，成本为零。

### D4：不新增 WXML 渲染测试

测试项目（Jest + 自定义 `helpers/page.js`）仅捕获 `Page()` 配置做 JS 逻辑测试，无 WXML/CSS 渲染能力（无 miniprogram-simulate）。本 bug 属纯布局层，自动化无法覆盖。验证以「现有逻辑测试回归 + 微信开发者工具人工目检」为准。

## Risks / Trade-offs

- [移动 input 后仍有点击盲区或键盘不唤起] → input 宽度 `100%`、高度 `104rpx` 与格子组等尺寸，`opacity: 0` 是微信端验证码输入通行做法；DevTools 在 iOS/Android 两套机型目检兜底。
- [某些机型 `opacity: 0` 的 input 无法聚焦] → 若目检发现，可改用「不透明但颜色透明 + 光标透明」的兜底写法；当前先按通行做法实施。
- [无自动化回归拦截此类布局回归] → 已知限制，记录于 D4；后续如引入 miniprogram-simulate 可补渲染测试（不属本变更范围）。

## Migration Plan

无数据库/契约迁移。代码合入按 `.claude/rules/git-commit.md` 一事一提交（`fix: 修复加入家庭页邀请码输入框无法点击`）。

## Open Questions

（无）
