## 1. 测试先行（RED）

- [x] 1.1 [dev-miniapp] 在 `app/miniapp-test/__tests__/pages/mine.test.js` 新增用例「多家庭时 currentFamily 跟随 CURRENT_FAMILY_ID」：`auth.getMyFamilies` mock 返回 `{ families: [f1, f2] }`，`wx.getStorageSync` 用 `mockImplementation(k => k === STORAGE_KEYS.CURRENT_FAMILY_ID ? 'f2' : undefined)` 按 key 区分，断言 `ctx.data.currentFamily.familyId === 'f2'`（而非 `'f1'`）。验证：`cd app/miniapp-test && npx jest __tests__/pages/mine.test.js` 中该用例失败（现实现取 `families[0]`）

## 2. 实现（GREEN）

- [x] 2.1 [dev-miniapp] 修改 `app/miniapp/pages/mine/index.js` 的 `_loadData`：读 `wx.getStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID)` 存入 `currentId`，当前家庭选取改为 `const currentFamily = families.find(f => f.familyId === currentId) || families[0] || null`。依赖 1.1。验证：`cd app/miniapp-test && npx jest __tests__/pages/mine.test.js` 全部通过（新增用例转绿，既有 15 个用例无回归）

## 3. 校验

- [x] 3.1 [dev-miniapp] 运行全量单测与 lint：`cd app/miniapp-test && npx jest`、`cd app/miniapp && npm run lint`。依赖 2.1。验证：两条命令均退出码 0，无 lint 错误、无测试回归
