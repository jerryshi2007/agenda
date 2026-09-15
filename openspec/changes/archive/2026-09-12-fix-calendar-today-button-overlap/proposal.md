## Why

日历首页（家长端）日期导航栏的「今天」按钮与「下一周期（›）」箭头在布局上重叠，两个可交互控件相互遮挡、无法分别点按。根因是「今天」按钮使用绝对定位（`right:32rpx`），落点与 flex 行内最后一个箭头 `›` 的右侧边缘重合；同时因只设水平定位、缺少垂直定位而贴顶不居中。该缺陷影响月/周/日三种视图下的日期切换操作，必须修复。

本变更属纯前端 UI bug 修复（平凡变更），无对应 staging 需求目录，依 `openspec-workflow` rule 豁免提案前置的 staging 流程。

## What Changes

- 重构日期导航栏 `.date-navigator` 为「左槽 + 居中标题 + 右槽」三区对称布局，「今天」按钮从绝对定位改为普通 flex 子项，放入左槽
- 新增 `.date-nav-side` / `.date-nav-side-left` / `.date-nav-side-right` 样式，左右等宽（160rpx）保证标题严格居中
- 移除 `.date-nav-today` 的 `position:absolute; right:32rpx`，使其随 flex 自动垂直居中
- 移除 `.date-navigator` 上的内联 `style="position: relative;"`
- 交互与 `data-id` 锚点全部保持不变（`calendar-today-btn` / `calendar-date-prev` / `calendar-date-next` / `calendar-date-title`）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `event-calendar`: 新增「日期导航控件不重叠且可独立点按」需求（ADDED Requirement），为本次 UI 修复建立验收标准

## Impact

- 前端：`app/miniapp/pages/index/index.wxml`（日期导航栏结构）、`app/miniapp/styles/schedule-common.wxss`（`.date-navigator` / `.date-nav-side` / `.date-nav-today` 样式）
- 无后端、无 API 契约、无数据库变更
- `data-id` 不变，测试无影响（已确认 `app/miniapp-test/` 未引用相关锚点）
