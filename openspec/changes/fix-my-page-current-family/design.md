## Context

动机见 proposal.md - Why。当前实现状态：

- 「我的」页面 [app/miniapp/pages/mine/index.js](app/miniapp/pages/mine/index.js) 的 `_loadData()` 在拉取家庭列表后写死 `const currentFamily = families.length > 0 ? families[0] : null`，从不读 `CURRENT_FAMILY_ID`。
- 全应用「当前家庭」的唯一真相源是 storage 键 `CURRENT_FAMILY_ID`：`services/api.js` 从它注入 `X-Family-Id` 请求头、`app.js` 的 `refreshFamilyContext()` 从它拉成员、`family-switch` 用 `f.familyId === currentId` 标记 `isCurrent`。
- 后端 `GET /api/v1/families/me`（`FamilyQueryServiceAdapter.GetUserFamiliesAsync`）按 `JoinedAt` 升序返回，`families[0]` 恒为最早加入的家庭，与用户切换无关；响应无「当前家庭」标记字段。

## 现状对账清单

| 符号/文件 | 处置 | 说明 |
|---|---|---|
| `CURRENT_FAMILY_ID`（`utils/storage-keys.js`） | 复用 | 真相源，不改 |
| `family-switch/index.js` 的 `isCurrent` 逻辑（`f.familyId === currentId`） | 复用 | 作为一致性模板 |
| `mine/index.js` `_loadData()` | 扩展 | 唯一改动点：当前家庭选取逻辑 |
| `services/api.js` `X-Family-Id` 注入 | 复用 | 不改 |
| 后端 `families/me` 与 `FamilyInfo` DTO | 复用 | 不改，无 current 标记 |

## Goals / Non-Goals

**Goals:**
- 「我的」页 `currentFamily` 跟随 `CURRENT_FAMILY_ID`，切换家庭后显示正确家庭。
- 与既有 `family-switch`/`api.js`/`app.js` 的真相源语义一致。

**Non-Goals:**
- 不在后端引入「当前家庭」持久化或 `families/me` 新增 current 标记字段。
- 不改动其他页面（`family-switch`、`index`、`family-members` 等）的既有逻辑。

## Decisions

**D1：修复落在前端 `mine` 页，读 `CURRENT_FAMILY_ID` + `find` + 回退 `[0]`**

- 选取逻辑改为 `families.find(f => f.familyId === currentId) || families[0] || null`。
- 理由：`CURRENT_FAMILY_ID` 是全应用既有真相源，此改动让 `mine` 页与 `family-switch` 的 `isCurrent`、`api.js` 的 header 注入对齐，消除唯一一处偏离。
- 备选方案（已否决）：后端持久化当前家庭。否决原因——「当前家庭」是单设备 UX 状态（多设备各自独立），引入后端字段需数据模型 + API 契约变更，产品无此需求，属过度设计。

**D2：`CURRENT_FAMILY_ID` 缺失或失效时回退 `families[0]`**

- 理由：覆盖首次使用（storage 未写入）与「当前家庭已退出/解散」两类边界，保持单家庭与首次使用场景不回归；`families[0]` 作为确定性兜底（后端 `JoinedAt` 升序）。
- 比较类型为字符串——storage 存 GUID 字符串、JS 中 `familyId` 也是 GUID 字符串，`===` 比较与 `family-switch` 现有写法一致。

## Risks / Trade-offs

- [R] `CURRENT_FAMILY_ID` 残留指向已退出家庭 → [M] `find` 未命中自动回退 `families[0]`，不显示空态。
- [R] `getMyFamilies` 请求失败（`familiesRes` 为 null）时 `families` 为空 → [M] 沿用既有 `familiesError` 占位分支，`currentFamily` 保持 null，行为不变。
