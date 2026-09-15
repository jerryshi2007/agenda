## Context

动机见 proposal.md - Why，不重复。

- `family-switch` 是家庭切换面板，现有三个入口：
  1. 「我的」页「切换」按钮 → `wx.navigateTo('/pages/family-switch/index')`
  2. 成员页「退出家庭」后 → `wx.reLaunch('/pages/family-switch/index')`
  3. 恢复页「跳过」/解散后 → `wx.reLaunch('/pages/family-switch/index')`
- 切换成功后当前实现统一 `wx.reLaunch('/pages/index/index')` 跳日历页（[family-switch/index.js:79](../../../app/miniapp/pages/family-switch/index.js)）。
- 「我的」页 `onShow` 已重读 `CURRENT_FAMILY_ID` 刷新「当前家庭」显示（`fix-my-page-current-family` 已修复），返回后会自动显示新家庭。

### 现状对账清单

| 既有符号/文件 | 本次处理 | 说明 |
|---|---|---|
| `family-switch/index.js` 的 `onSelectFamily` | 扩展 | 切换成功后按来源分流导航目的地 |
| `mine/index.js` 的 `onSwitchFamily` | 扩展 | 跳转 URL 加 `?from=mine` |
| `CURRENT_FAMILY_ID` 真相源（storage-keys） | 复用 | 切换写入与读取机制不变 |
| `mine/index.js` 的 `onShow` 重载 | 复用 | 返回后自动显示新家庭，无需新增刷新逻辑 |
| `family-switch` 页面栈（navigateTo 进入） | 复用 | `navigateBack` 依赖栈下层为「我的」页 |

## Goals / Non-Goals

**Goals:**

- 仅「我的」页入口切换成功后返回「我的」页（`navigateBack`）；其他入口保持 `reLaunch` 日历不变。

**Non-Goals:**

- 不改退出/解散后的跳转行为。
- 不改「每个家庭独立记忆视图/日期」的存储机制（既存 `calendarState` 单份实现，另行处理）。
- 不改后端、契约（`openspec/contracts/`）、DTO。

## Decisions

### D1：用 `?from=mine` 查询参数标记入口来源（而非页面栈探测）

- **选择**：`mine` 跳转 `family-switch` 时携带 `?from=mine`，`family-switch` 的 `onLoad(options)` 记录来源，切换成功后按来源分流。
- **备选 A（页面栈探测）**：`getCurrentPages().length > 1` 判断有无返回栈。缺点：把行为绑定到栈深度，未来若有其他 `navigateTo` 入口会被误判为「我的」入口。
- **备选 B（统一 switchTab mine）**：统一跳「我的」Tab。缺点：会改变入口②③的行为，超出本次范围。
- **理由**：查询参数显式、自文档，与既有 `?familyId=` 传参风格一致（[mine/index.js:69](../../../app/miniapp/pages/mine/index.js)）。

### D2：入口①用 `navigateBack`（而非 switchTab / reLaunch）

- **选择**：`from === 'mine'` 时 `wx.navigateBack()` 返回栈下层「我的」页实例，触发其 `onShow` 重载显示新家庭。
- **备选 A**：`wx.switchTab('/pages/mine/index')` 会关闭所有非 tabBar 页，语义偏重，且与「返回」心智不符。
- **备选 B**：`wx.reLaunch('/pages/mine/index')` 重置整个页面栈，成本高、无必要。
- **理由**：入口①是 `navigateTo` 进入，「我的」页就在栈下一层，`navigateBack` 语义即「返回」，最贴合需求且不触碰 tabBar。

## Risks / Trade-offs

- [来源标记 `from=mine` 但栈下层非「我的」页] → 入口①是 `family-switch` 唯一 `navigateTo` 来源，`navigateTo` 保证「我的」页在栈下层；无需额外防御。
- [回归入口②③] → 默认（无 `from`）分支保持原 `reLaunch` 逻辑与既有测试断言不变，新增测试显式覆盖 `from=mine` 分支。
- [测试断言变更遗漏] → `mine.test.js` 的 `navigateTo` URL 断言需同步加 `?from=mine`，否则单测失败；已列入 tasks。
