## Why

从「我的」页面点击「切换家庭」完成切换后，当前实现会 `reLaunch` 到日历页（`/pages/index/index`）。这符合既有 spec（family-lifecycle「多家庭切换」场景），但用户反馈更希望在切换完成后**返回「我的」页面**，直接看到「当前家庭」已更新为刚选择的家庭、确认切换成功。日历页本就可通过 Tab 一键到达，无需在切换后强制跳转。

本变更为纯前端交互调整，无对应 staging 需求目录；需求真相源为 [openspec/specs/family-lifecycle/spec.md](../../specs/family-lifecycle/spec.md)（「多家庭切换」场景）与 [openspec/specs/auth-my-page/spec.md](../../specs/auth-my-page/spec.md)（「我的」页面展示）。

## What Changes

- 「我的」页「切换家庭」入口跳转 family-switch 时携带来源标记 `?from=mine`。
- family-switch 切换成功后按来源分流：来源为「我的」页时 `wx.navigateBack()` 返回「我的」页（触发 `onShow` 重读 `CURRENT_FAMILY_ID`，立即显示新家庭）；其他来源（退出家庭 / 解散后重选）保持原 `wx.reLaunch` 到日历页不变。
- 补充 Jest 单元测试：断言「我的」页入口切换成功后走 `navigateBack`，其他入口仍走 `reLaunch`。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `family-lifecycle`: 修改「多家庭切换」需求场景——从「我的」页面切换家庭后，THEN 由「跳转到日历视图」改为「返回『我的』页面并显示新家庭」；退出/解散后重选家庭的跳转行为保持不变。

## Impact

- 前端：[app/miniapp/pages/mine/index.js](../../../app/miniapp/pages/mine/index.js)（跳转 URL 加 `?from=mine`）、[app/miniapp/pages/family-switch/index.js](../../../app/miniapp/pages/family-switch/index.js)（onLoad 记录来源 + 切换成功后分流）。
- 测试：[app/miniapp-test/__tests__/pages/mine.test.js](../../../app/miniapp-test/__tests__/pages/mine.test.js)、[app/miniapp-test/__tests__/pages/family-switch.test.js](../../../app/miniapp-test/__tests__/pages/family-switch.test.js)。
- 无后端、契约（`openspec/contracts/`）、DTO 变更。
