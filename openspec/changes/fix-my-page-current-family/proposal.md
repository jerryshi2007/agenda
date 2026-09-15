## Why

切换家庭后，「我的」页面的「当前家庭」显示不更新。根因是 [app/miniapp/pages/mine/index.js](app/miniapp/pages/mine/index.js) 在加载家庭列表时写死取 `families[0]`（后端按加入时间升序返回的第一个家庭），而不是读取全应用统一的当前家庭真相源 `CURRENT_FAMILY_ID`。结果是日历视图已经切到新家庭，但「我的」页仍显示最早加入的那个家庭——多家庭（≥2 个）场景必现，违背了「当前家庭信息」的产品语义。

本变更为纯前端 bug 修复，无对应 staging 需求目录；需求真相源为 [openspec/specs/auth-my-page/spec.md](../../specs/auth-my-page/spec.md)（「我的」页面展示）与 [openspec/specs/family-lifecycle/spec.md](../../specs/family-lifecycle/spec.md)（多家庭切换）。

## What Changes

- 「我的」页面加载家庭列表后，当前家庭信息改为按 `CURRENT_FAMILY_ID` 匹配（`families.find(f => f.familyId === currentId)`），匹配不到时回退到第一个家庭，保持单家庭与首次使用场景不回归。
- 补充 Jest 单元测试：断言多家庭场景下 `currentFamily` 跟随 `CURRENT_FAMILY_ID`（而非固定取第一个）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `auth-my-page`: 修改「"我的"页面展示」需求，明确「当前家庭」MUST 反映当前选中家庭（`CURRENT_FAMILY_ID`），切换家庭后跟随更新。

## Impact

- 前端：仅 [app/miniapp/pages/mine/index.js](app/miniapp/pages/mine/index.js) 一处改动（`_loadData` 中当前家庭的选取逻辑）。
- 测试：[app/miniapp-test/__tests__/pages/mine.test.js](app/miniapp-test/__tests__/pages/mine.test.js) 补充多家庭跟随断言。
- 无后端、契约（`openspec/contracts/`）、DTO 变更；`CURRENT_FAMILY_ID` 真相源与既有 `family-switch`、`api.js`、`app.js` 保持一致。
