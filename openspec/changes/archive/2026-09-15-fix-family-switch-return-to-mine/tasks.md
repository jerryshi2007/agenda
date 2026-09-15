## 1. 测试先行（RED）

- [x] 1.1 更新 `app/miniapp-test/__tests__/pages/mine.test.js`「点击"切换"按钮跳转到 family-switch 页」用例：`wx.navigateTo` 断言 URL 由 `'/pages/family-switch/index'` 改为 `'/pages/family-switch/index?from=mine'`。负责 agent：dev-miniapp。验证：`cd app/miniapp-test && npx jest __tests__/pages/mine.test.js` 先红（当前实现无 `?from=mine`）
- [x] 1.2 更新 `app/miniapp-test/__tests__/pages/family-switch.test.js`：新增用例——`ctx.onLoad({ from: 'mine' })` 后 `onSelectFamily` 切换成功时调 `wx.navigateBack` 且不调 `wx.reLaunch`；既有「切换后 reLaunch 首页」与「TC-FSW-05 校验通过后 reLaunch」用例保持（默认无 from 分支）。负责 agent：dev-miniapp。验证：`cd app/miniapp-test && npx jest __tests__/pages/family-switch.test.js` 先红（当前实现统一 reLaunch）

## 2. 实现（GREEN）

- [x] 2.1 修改 `app/miniapp/pages/mine/index.js` `onSwitchFamily`：跳转 URL 加 `?from=mine`（`wx.navigateTo({ url: '/pages/family-switch/index?from=mine' })`）。负责 agent：dev-miniapp。验证：`cd app/miniapp-test && npx jest __tests__/pages/mine.test.js` 转绿
- [x] 2.2 修改 `app/miniapp/pages/family-switch/index.js`：`onLoad(options)` 记录 `this._from = (options && options.from) || ''`；`onSelectFamily` 写入 `CURRENT_FAMILY_ID` 后按来源分流——`this._from === 'mine'` 时 `wx.navigateBack()`，否则保持 `wx.reLaunch({ url: '/pages/index/index' })`；同步更新文件第 2 行注释（「选择后写入 CURRENT_FAMILY_ID 并 reLaunch 首页」→ 说明按来源分流）。负责 agent：dev-miniapp。验证：`cd app/miniapp-test && npx jest __tests__/pages/family-switch.test.js` 转绿

## 3. 回归验证

- [x] 3.1 运行全量单测：`cd app/miniapp-test && npx jest`，确认零失败、无既有用例回归。负责 agent：dev-miniapp
- [x] 3.2 运行覆盖率检查：`cd app/miniapp-test && npx jest --coverage`，确认 `family-switch/index.js` 的 `from=mine` 分支与默认分支均被覆盖。负责 agent：dev-miniapp
