## Context

动机与范围见 `proposal.md`。本设计仅涉及日历首页（家长端 `app/miniapp/pages/index/`）日期导航栏的布局修复，纯前端 WXML/WXSS 改动，不触碰后端、API 契约、数据库。

### 现状对账清单

| 现有符号/元素 | 位置 | 本次变更 | 说明 |
|---|---|---|---|
| `.date-navigator` 容器 | `pages/index/index.wxml` + `styles/schedule-common.wxss` | 复用 | 保留 flex 容器，移除内联 `position: relative`，样式微调 |
| `.date-nav-arrow`（‹/› 箭头） | `schedule-common.wxss` | 复用 | 样式不变，仅结构上移入左右侧槽 |
| `.date-nav-title`（标题） | `schedule-common.wxss` | 复用 | `flex:1; text-align:center` 不变 |
| `.date-nav-today`（今天按钮） | `schedule-common.wxss` | 扩展 | 删除 `position:absolute; right:32rpx`，改为普通 flex 子项 |
| `.date-nav-side` / `-left` / `-right` | — | 新建 | 新增左右等宽侧槽样式 |

## Goals / Non-Goals

**Goals:**

- 「今天」「‹」「›」三个控件互不重叠、各自独立可点按
- 标题保持水平居中
- 消除「今天」因绝对定位缺失垂直定位导致的贴顶不居中

**Non-Goals:**

- 不改动日期导航的业务逻辑（`onToday`/`onPrev`/`onNext`/`onDatePicker` 的 JS 行为不变）
- 不改动 `data-id` 锚点（`calendar-today-btn` / `calendar-date-prev` / `calendar-date-next` / `calendar-date-title`）
- 不引入第三方组件库、不新增依赖

## Decisions

### D1：改用「左槽 + 居中标题 + 右槽」三区对称布局，放弃绝对定位

`今天` 当前的绝对定位（`right:32rpx`）与 flex 流式布局中最后一个箭头 `›` 的右侧边缘落点重合，是重叠根因。绝对定位也无法享受 flex 的 `align-items:center` 垂直居中。

- **选定方案**：`.date-navigator` 内部按「左槽（今天+‹）→ 标题（flex:1 居中）→ 右槽（›）」排列；左右槽 `flex:0 0 160rpx` 等宽，标题严格居中。
- **备选 A**：`今天` 改为普通 flex 子项但不做对称留位 → 标题因一侧多占宽度而偏移，不满足「居中」验收。
- **备选 B**：保留绝对定位 + 增大右 padding 为「今天」腾位 → 标题仍居中，但「今天」与 `›` 挤在同一侧，视觉局促、右槽过宽。

### D2：「今天」放左槽，箭头紧贴标题两侧

- **选定方案**：左槽 `justify-content: space-between`（今天贴最左、`‹` 贴标题左）；右槽 `justify-content: flex-start`（`›` 贴标题右）。「今天」置左上符合常见日历心智（iOS/Google 均左上），且 `‹`/`›` 保持紧贴标题的自然观感。
- **备选**：`今天` 放右槽与 `›` 并列 → 左侧出现 ~100rpx 空位，观感不均衡。

### D3：左右槽固定 160rpx

对称固定宽是保证标题绝对居中且不依赖 JS 的最稳方案。160rpx 可容纳左槽「今天」胶囊（约 92rpx）+ `‹`（64rpx）；标题最小可用宽度约 366rpx，最长标题（跨月周视图「8月31日 - 9月6日」实测约 230rpx）不截断。

- **备选**：`flex: 0 0 auto` 自适应 → 左右槽宽度不等时标题偏移，需额外对称技巧。

## Risks / Trade-offs

- [侧槽固定 160rpx 在窄屏压缩标题区] → 当前最长标题 < 366rpx 不截断；若未来出现更长标题，追加 `font-size` 自适应或 ellipsis 兜底，不改变本方案结构。
- [`space-between` 在单子项时退化] → 左槽固定 2 个子项、右槽固定 1 个子项且用 `flex-start`，不触发退化场景。
- [flex 兼容性] → 微信基础库 ≥ 2.10.0 完整支持 flex；本方案未引入新 API 或组件，无兼容风险。

## Migration Plan

纯前端样式改动，无数据迁移。上线方式为常规小程序发版；回滚即 revert 本次提交（两个文件，单提交内原子变更）。

## Open Questions

无。
