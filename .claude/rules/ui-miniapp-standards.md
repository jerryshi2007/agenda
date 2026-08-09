---
description: 小程序 UI 标准与原型规范——出小程序原型或实现小程序界面时遵循。
---

# ui-miniapp-standards · 小程序 UI 标准与原型规范

## 约束

### UI 框架选型

- **微信原生组件优先**——`<scroll-view>`、`<swiper>`、`<picker>`、`<slider>`、`<switch>` 等平台原生组件在性能、兼容性、用户体验上优于第三方实现。这些组件与微信客户端内核深度集成，绕过 JS 线程直接渲染，性能远超 Web 组件。MUST 优先使用原生组件，仅原生确实无法满足时（如复杂表单校验、级联选择器），才引入第三方组件库。
- **第三方组件库**（如使用）：
  - **WeUI（微信官方）** — 与微信客户端视觉完全一致，扩展样式通过 WeUI 设计变量系统
  - **Vant Weapp** — 有赞出品，轻量级（~200KB），组件丰富度好，电商/工具类适用
  - **Taro UI / NutUI** — Taro 生态组件，多端统一时优先
  - **uni-ui** — uni-app 官方组件库，跨端方案首选
  - 选型确定后全项目统一，MUST NOT 混用多套组件库
- **样式定制走组件的设计变量系统**——WeUI 的 CSS 变量、Vant Weapp 的 CSS 变量（`--van-*`）或框架提供的主题定制方式。MUST NOT 用 `!important` 或高权重选择器覆盖组件内部样式。穿透自定义子组件根节点做局部样式调整允许，但应优先用 props/slots 控制变体。
- **仅框架/原生无对应组件时才自研**——自研前先评审"是否确实无此组件"、"是否可组合现有组件实现"。自研组件需遵守设计令牌、可访问性、响应式等相同标准。

### 设计令牌（Token）

- **颜色、间距、字号、圆角、阴影统一走设计令牌**，MUST NOT 硬编码裸值。保证全局一致与主题切换。
- **令牌定义位置**：`app/styles/tokens.wxss`（原生）或框架对应的全局样式文件。所有页面/组件通过 `@import` 或框架提供的全局样式机制引用。
- **WeUI 设计变量基线**（推荐）：
  ```css
  /* WeUI 颜色变量 */
  --weui-BRAND: #07C160;           /* 主色——微信绿 */
  --weui-WARNING: #FA5151;         /* 警告/危险 */
  --weui-LINK: #576B95;            /* 链接色 */
  --weui-FG-0: rgba(0,0,0,0.9);   /* 主文字 */
  --weui-FG-1: rgba(0,0,0,0.5);   /* 次要文字 */
  --weui-FG-2: rgba(0,0,0,0.3);   /* 占位/禁用文字 */
  --weui-BG-0: #EDEDED;           /* 页面背景 */
  --weui-BG-1: #F7F7F7;           /* 卡片背景 */
  --weui-BG-2: #FFFFFF;           /* 容器背景 */
  ```
  项目 CSS 变量映射到 WeUI 变量（`--color-primary: var(--weui-BRAND)`），不直接使用 WeUI 变量名——这样即使后期更换组件库，只需改 `tokens.wxss` 中的映射关系。
- **深色模式**：微信基础库 ≥ 2.10.0 支持 `wx.getSystemInfo({ success: res => res.theme })` 检测当前主题（`'light'` / `'dark'`），通过 `wx.onThemeChange` 监听主题切换。MUST 在 `tokens.wxss` 中为深色模式提供变量覆盖（通过根 class 切换，如 `.theme-dark`），关键页面 MUST 验证深色模式不丢失信息。微信小程序中 CSS `@media (prefers-color-scheme: dark)` 支持有限，仅作备选方案。

### 小程序特有样式约束

- **rpx 单位**：750rpx = 屏幕宽度。布局和间距统一用 rpx，字体大小可用 pt/rpx 并验证实际显示效果。MUST NOT 在布局中写死 px 导致不同屏幕宽度下比例失调。
- **原生组件层级**：`<map>`、`<video>`、`<canvas>`、`<camera>`、`<live-player>`、`<live-pusher>`、`<textarea>`（focus 时）、`<input>`（focus 时）等原生组件的渲染层级高于普通 WXML 节点。MUST NOT 依赖 `z-index` 覆盖原生组件——改用 `<cover-view>` / `<cover-image>` 做覆盖层内容。
- **安全区域适配**：
  - 底部安全区（iPhone X+）：MUST 使用 `env(safe-area-inset-bottom)` 或 `constant(safe-area-inset-bottom)` 为底部固定元素留出空间。
  - 顶部安全区（刘海屏）：自定义导航栏 MUST 使用 `statusBarHeight` + `navBarHeight` 计算顶部安全距离。
  - CSS 常量：`padding-bottom: calc(20rpx + env(safe-area-inset-bottom))` 是底部内容的推荐写法。
- **自定义导航栏**：若使用 `"navigationStyle": "custom"`（页面 json 中声明），MUST 自行处理状态栏高度 + 导航栏高度，并 MUST 在页面中提供返回按钮（左上角），MUST 验证不同机型（iPhone X、安卓刘海屏）的适配效果。
- **滚动区域**：长内容区域 MUST 使用 `<scroll-view>` 而非依赖页面默认滚动——`<scroll-view>` 提供 `scroll-into-view`、`bindscrolltolower` 等可控行为。MUST 设置 `enable-flex` 属性以支持 flex 布局。

### 多端适配

> 以下适用于 uni-app 或 Taro 等跨端方案。纯微信小程序开发时跳过。

- **条件编译**：各端差异化代码 MUST 通过条件编译注释隔离（uni-app: `#ifdef MP-WEIXIN` / `#ifndef MP-WEIXIN`，Taro: `process.env.TARO_ENV === 'weapp'`）。MUST NOT 在运行时代码中写平台判断。
- **H5 与小程序差异**：导航方式、Storage API、支付方式（微信支付 vs 浏览器支付）、推送方式（订阅消息 vs Web Push）的边界 MUST 在组件层面封装，业务页面不感知平台差异。
- **组件映射**：每个跨端组件 MUST 在微信小程序和 H5 端有明确的行为对应关系，差异点记录在组件注释中。

### 响应式与可访问性

> 以下继承自 `design-ui-standards` rule，适配小程序场景：

- **断点适配**：小程序屏幕物理宽度约 320px~428px（rpx 在所有设备上统一为 750rpx = 屏幕宽度），MUST 验证关键页面在此范围内的布局不溢出。
- **可交互元素**：MUST 有清晰的点击态反馈（`:active`、`hover-class` 或框架提供的反馈样式）。点击区域 MUST ≥ 44rpx × 44rpx（微信设计规范最小可点击尺寸）。
- **图片有 alt**：`<image>` 标签 MUST 设 `alt` 属性或 `aria-label`。
- **颜色对比度**：文字与背景对比度 MUST ≥ 4.5:1（普通文字）/ ≥ 3:1（大文字 ≥ 18pt），关键操作按钮的文字 MUST 可辨识。
- **小程序无障碍**：`aria-role`、`aria-label`、`aria-checked` 等属性在 WXML 中可用于描述组件语义，自定义组件中的重要可交互元素 MUST 添加适当的 aria 属性。

### 原型阶段

> 以下与 `design-ui-standards` rule 的原型阶段规范一致，增加小程序特有映射：

- **交互优先于视觉**——原型用来验证"交互对不对"，低保真够讨论即可。
- **标注关键流程与状态**——含正常态、空态、错误态、loading 态，不只画正常路径。
- **低保真先于高保真**——先用骨架定流程，再逐步加视觉细节。
- **原型 HTML 是验证稿**——交互确认后转小程序框架组件实现，原型本身不入 `app/` 生产目录。
- **公共样式统一管理**——设计令牌（CSS 变量）、Reset、布局骨架统一放在 `production/prototypes/common.css`，所有页面通过 `<link>` 引用。原型阶段不引入小程序 UI 框架 JS/CSS。
- **小程序组件映射标注**：原型 HTML 中的交互区域 MUST 标注对应的微信原生组件或选择的组件库组件，如 `<!-- 此处映射为 <scroll-view> -->`、`<!-- 此处映射为 Vant Weapp <van-dialog> -->`。
- **rpx 转换**：原型中 px 值需注明目标 rpx 值，如 `width: 180px; /* → 360rpx */`。
- **导航栏/TabBar**：MUST NOT 在原型页面内手绘导航栏和 TabBar——标注使用微信原生导航栏/TabBar，注明标题和 Tab 项配置。
- **微信原生组件对照**（原型 HTML 元素 → 目标实现）：

| HTML 占位元素 | 小程序实现 | 说明 |
|---|---|---|
| `<select>` / `<option>` | `<picker mode="selector">` | 选择器 |
| `<input type="date">` | `<picker mode="date">` | 日期选择 |
| `<input type="time">` | `<picker mode="time">` | 时间选择 |
| `<input type="switch">` | `<switch checked="{{...}}" bindchange="...">` | 开关 |
| `<textarea>` | `<textarea>` (原生组件，focus 时层级最高) | 多行输入 |
| 长滚动 `<div>` | `<scroll-view scroll-y enable-flex>` | 滚动区域 |
| 轮播 `<div>` | `<swiper>` + `<swiper-item>` | 轮播 |
| 模态弹窗 `<div>` | `<view>` + WeUI/Vant 弹窗组件 或 `wx.showModal` | 弹窗 |
| `<input type="file">` | `<button open-type="chooseAvatar">` 或 `wx.chooseImage` | 文件/图片选择 |
| 地图嵌入 | `<map>` 原生组件（层级最高无法被覆盖） | 地图 |
| 循环渲染列表项 | `wx:for="{{list}}"` + `data-id` 含 item.id | 列表渲染 |
| 条件渲染 | `wx:if="{{condition}}"` / `wx:else` | 条件显示 |
| 可下拉区域 | 页面 json 中 `"enablePullDownRefresh": true` | 下拉刷新 |

## 示例

### UI 组件
- ✅ `<van-dialog data-id="schedule-cancel-dialog" show="{{ showCancelDialog }}" title="取消日程" message="确定要取消本次日程吗？" show-cancel-button bind:confirm="onConfirmCancel" />` — 使用组件库弹窗，加 data-id
- ❌ `<view class="modal"><view class="modal-mask"><view class="modal-content">...` — 手写弹窗，组件库已有

### 设计令牌
- ✅ `color: var(--color-primary); /* var(--weui-BRAND) */` — 通过项目令牌引用 WeUI 变量
- ❌ `color: #07C160;` — 硬编码颜色值

### 安全区域
- ✅ `.bottom-bar { padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); }` — 兼容各种底部安全区
- ❌ `.bottom-bar { padding-bottom: 20rpx; }` — iPhone X 底部内容被横线遮挡

### rpx
- ✅ `width: 200rpx; font-size: 28rpx;` — 响应式单位
- ❌ `width: 100px;` — 写死像素，不同设备比例失真

### 原型标注
- ✅ 原型 HTML 中 `<div class="date-picker">` 旁标注 `<!-- → <picker mode="date"> -->`
- ❌ 原型 HTML 中 `<input type="date">` 不加标注——不知道小程序该用什么映射
