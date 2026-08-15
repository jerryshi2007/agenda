---
name: design-miniapp
description: 出小程序原型时使用——低保真 HTML 原型验证交互，增加小程序组件映射标注和 rpx 转换。
rules: [ui-miniapp-standards]
---

# design-miniapp · 小程序原型设计

## 何时使用

设计微信小程序页面交互原型时。产出低保真 HTML 原型用于验证交互流程，确认后交由 `dev-miniapp` 实现为生产组件。

## 前置条件

- Read `rules/ui-miniapp-standards.md` 了解小程序 UI 约束（WeUI 变量、rpx 单位、原生组件层级、安全区域等）
- 确认风格基调：WeUI 风格（微信原生视觉）或其他选定的设计系统

## 流程

1. **明确验证目标**——这个界面要解决什么用户问题？关键交互流程是什么？
2. **确认风格基调**——WeUI 风格（主色 `#07C160`，微信原生视觉），调整 CSS 变量和间距基调。
3. **产出低保真 HTML 原型**
   - 全局框架页：`production/prototypes/index.html` — 布局骨架 + 侧边栏菜单
   - 公共样式：`production/prototypes/common.css` — 设计令牌 + Reset + 布局骨架，体现风格基调（WeUI 变量值）
   - 子页面：按功能模块分目录（如 `auth/privacy-policy.html`）
   - 页面 HTML 只写自己特有的 `<style>`，通过 `<link rel="stylesheet" href="../common.css">` 引用公共样式
   - 原型阶段不引入小程序 UI 框架 JS/CSS
4. **覆盖 4 态**——正常态、空态、错误态、loading 态，缺一不可。
5. **标注小程序组件映射**——原型 HTML 中的交互区域标注对应的微信原生组件或组件库组件：
   ```html
   <!-- → <picker mode="selector" range="{{...}}"> -->
   <select class="form-select">
     <option>选项 1</option>
   </select>

   <!-- → <scroll-view scroll-y enable-flex> -->
   <div class="scroll-list">
   ```

   ```html
   <!-- → wx:for="{{list}}" -->
   <div class="list-item" data-id="schedule-list-row-1">
   ```
6. **标注 rpx 转换**——关键尺寸标注目标 rpx 值，方便开发转换：
   ```css
   .card { width: 180px; /* → 360rpx */ }
   .title { font-size: 16px; /* → 32rpx */ }
   ```
7. **展示确认**——与需求方确认流程与状态覆盖，确认后才算完成。

## 小程序页面结构映射

### 导航栏

原型的导航栏区域 MUST 标注使用微信原生导航栏，MUST NOT 手绘导航栏 HTML。

```html
<!-- 顶部：微信原生导航栏 -->
<!-- title: "我的" -->
<!-- backgroundColor: "#FFFFFF" -->
<!-- frontColor: "#000000" -->
```

**特殊情况**：若页面需要自定义导航栏（如首页大标题、搜索框、更多按钮等），原型可绘制自定义导航栏样式，但 MUST 标注"自定义导航栏，需在 page.json 中声明 navigationStyle: custom"。

### TabBar

TabBar MUST 使用微信原生，原型页底部绘制占位 bar 并标注 Tab 项配置：

```html
<!-- 微信原生 TabBar -->
<!-- tabBar.list: [{ text: "日历", iconPath: "...", pagePath: "pages/calendar/index" },
                    { text: "我的", iconPath: "...", pagePath: "pages/my/index" }] -->
```

### 微信原生组件对照表

| HTML 占位元素 | 小程序实现 | 标注示例 |
|---|---|---|
| `<select>` / `<option>` | `<picker mode="selector">` | `<!-- → <picker mode="selector"> -->` |
| `<input type="date">` | `<picker mode="date">` | `<!-- → <picker mode="date"> -->` |
| `<input type="time">` | `<picker mode="time">` | `<!-- → <picker mode="time"> -->` |
| `<input type="switch">` | `<switch checked="{{...}}" bindchange="...">` | `<!-- → <switch> -->` |
| `<textarea>` | `<textarea>` (原生组件，focus 时层级最高) | `<!-- → <textarea> (微信原生) -->` |
| 长滚动列表 `<div>` | `<scroll-view scroll-y enable-flex>` | `<!-- → <scroll-view scroll-y> -->` |
| 轮播 `<div>` | `<swiper>` + `<swiper-item>` | `<!-- → <swiper autoplay> -->` |
| 模态弹窗 | `<view>` + 组件库弹窗 | `<!-- → <van-dialog> 或 wx.showModal -->` |
| `<input type="file">` | `<button open-type="chooseAvatar">` 或 `wx.chooseImage` | `<!-- → <button open-type="chooseAvatar"> -->` |
| 地图嵌入 | `<map>` 原生组件（层级最高无法被覆盖） | `<!-- → <map> 原生组件，标注不可覆盖区域 -->` |
| 循环渲染列表项 | `wx:for="{{list}}"` + `data-id` 含 item.id | `<!-- → wx:for="{{items}}" -->` |
| 条件渲染 | `wx:if="{{condition}}"` / `wx:else` | `<!-- → wx:if="{{hasData}}" -->` |
| 可下拉区域 | 页面 json 中 `"enablePullDownRefresh": true` | `<!-- → 页面级下拉刷新 -->` |

## 页面状态标注

每个页面 MUST 标注以下状态，不只画正常路径：

### 4 态覆盖

```html
<!-- 状态切换器（原型调试用，实际页面不含此区域） -->
<div class="state-switcher">
  <button onclick="setState('normal')">正常态</button>
  <button onclick="setState('loading')">Loading态</button>
  <button onclick="setState('error')">错误态</button>
  <button onclick="setState('empty')">空态</button>
</div>

<!-- ===== 正常态 ===== -->
<div class="state-normal">
  <!-- 页面内容 -->
</div>

<!-- ===== Loading态 ===== -->
<div class="state-loading" style="display:none">
  <!--
    → wx:if="{{loading}}"
    → <wx-loading> 或骨架屏 <view class="skeleton-item"> × N
  -->
  <div class="loading-spinner">加载中...</div>
</div>

<!-- ===== 错误态 ===== -->
<div class="state-error" style="display:none">
  <!--
    → wx:if="{{error}}"
    → 错误信息 + 重试按钮 data-id="<page>-retry-btn"
  -->
  <div class="error-container">
    <p>加载失败</p>
    <button data-id="index-retry-btn">重试</button>
  </div>
</div>

<!-- ===== 空态 ===== -->
<div class="state-empty" style="display:none">
  <!--
    → wx:if="{{isEmpty}}"
    → 空状态插图 + 引导文案 + 操作入口
  -->
  <div class="empty-container">
    <p>暂无日程</p>
    <button data-id="index-create-first-btn">创建第一个日程</button>
  </div>
</div>
```

## WeUI 风格基调

`common.css` 中 token 值采用 WeUI 变量体系：

```css
:root {
  /* 映射到 WeUI 设计变量 */
  --color-primary: #07C160;         /* var(--weui-BRAND) */
  --color-primary-light: #E8F8EF;   /* 主色浅底 */
  --color-warning: #FA5151;         /* var(--weui-WARNING) */
  --color-link: #576B95;            /* var(--weui-LINK) */
  --color-text-primary: rgba(0,0,0,0.9);
  --color-text-secondary: rgba(0,0,0,0.5);
  --color-text-placeholder: rgba(0,0,0,0.3);
  --color-text-white: #FFFFFF;
  --color-bg-page: #EDEDED;
  --color-bg-card: #F7F7F7;
  --color-bg-white: #FFFFFF;
  --color-border: rgba(0,0,0,0.1);
  --color-separator: rgba(0,0,0,0.05);

  /* 间距 rpx 基准（1px ≈ 2rpx @ iPhone 6） */
  --spacing-xs: 8px;   /* → 16rpx */
  --spacing-sm: 12px;  /* → 24rpx */
  --spacing-md: 16px;  /* → 32rpx */
  --spacing-lg: 24px;  /* → 48rpx */
  --spacing-xl: 32px;  /* → 64rpx */

  /* 字号 rpx 基准 */
  --font-size-xs: 10px;   /* → 20rpx */
  --font-size-sm: 12px;   /* → 24rpx */
  --font-size-md: 14px;   /* → 28rpx */
  --font-size-lg: 16px;   /* → 32rpx */
  --font-size-xl: 18px;   /* → 36rpx */
  --font-size-xxl: 22px;  /* → 44rpx */

  /* 圆角 */
  --radius-sm: 4px;   /* → 8rpx */
  --radius-md: 8px;   /* → 16rpx */
  --radius-lg: 12px;  /* → 24rpx */
  --radius-round: 50%;

  /* 过渡 */
  --transition-fast: 0.15s ease;
}
```

## 原型到生产代码的交接

确认后的原型 MUST 进行以下交接工作：

- 关闭状态切换器（移除 state-switcher 区域），按实际路由各状态独立实现
- 将 HTML 组件标注转为框架组件代码（`<!-- → <picker> -->` → 实际的 `<picker>` 标签）
- 将 px 值按 1:2 比例转换为 rpx（标注值验证手动调整）
- 将公共样式变量值映射到 `tokens.wxss`（或框架等效文件）
- 页面特有样式转换为 `.wxss`（scoped 到当前页面）

## 关键原则

- **交互优先于视觉**——低保真够验证流程即可
- **4 态缺一不可**——正常/空/错误/loading 每种状态都跑一遍
- **标注是关键**——原型是沟通文档，组件映射标注让开发不猜
- **WeUI 基调**——原型视觉与最终小程序一致，避免评审时产生错误预期
- **不引入小程序 UI 框架**——原型阶段用原生 HTML 元素 + 标注，生产阶段才引入
- **公共样式统一**——所有页面共用 `common.css`，禁止复制粘贴样式
