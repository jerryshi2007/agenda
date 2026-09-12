## 1. 日期导航栏结构重构（前端）

- [x] 1.1 重构 `app/miniapp/pages/index/index.wxml` 日期导航栏：移除 `.date-navigator` 上的内联 `style="position: relative;"`，将「今天」按钮与 `‹` 归入左槽 `.date-nav-side-left`、`›` 归入右槽 `.date-nav-side-right`、标题居中（`data-id` 全部保持不变）。验证：`cd app/miniapp && npm run build` 通过（WXML 结构/JSON 四件套校验）。负责：dev-miniapp。依赖：无。
- [x] 1.2 修改 `app/miniapp/styles/schedule-common.wxss`：新增 `.date-nav-side`（`flex:0 0 160rpx`）、`.date-nav-side-left`（`space-between`）、`.date-nav-side-right`（`flex-start`）；`.date-nav-today` 删除 `position:absolute; right:32rpx` 两行（其余保留）。验证：`cd app/miniapp && npm run build` 通过（WXSS 语法）。负责：dev-miniapp。依赖：1.1。

## 2. 验证与收口

- [x] 2.1 在微信开发者工具中分别切换月/周/日视图，确认「今天」「‹」「›」三控件互不重叠、各自可点按，标题水平居中，跨月周视图标题（如「8月31日 - 9月6日」）不截断。验证：人工目视 + 点击「今天」确认跳回今天且不触发周期切换。负责：dev-miniapp。依赖：1.2。
- [x] 2.2 运行 `cd app/miniapp && npm run lint` 确认契约合规与安全底线无回归。验证：lint 零错误。负责：dev-miniapp。依赖：1.2。
