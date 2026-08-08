---
description: 微信小程序编码规范——编写或审查小程序前端代码时遵循。技术栈无关的平台级约束，原生/uni-app/Taro 均适用。
---

# dev-miniapp-standards · 微信小程序编码规范

## 约束

### 平台底层约束

- **基础库版本**：目标最低基础库版本 ≥ 2.10.0。使用高版本 API 时 MUST 通过 `wx.canIUse` 或基础库版本号检查做兼容降级。
- **包大小限制**：主包 ≤ 2MB，总包（含分包）≤ 20MB（微信审核硬性限制）。静态资源优先走 CDN/云存储外链，不进包内。MUST 配置合理的分包策略——非首屏页面和低频模块进分包。
- **页面栈深度**：微信页面栈最多 10 层。避免 `wx.navigateTo` 链路过长导致栈满无法跳转——超过 5 层连续跳转 MUST 改用 `wx.redirectTo` 或 `wx.reLaunch`。`wx.navigateTo` / `wx.redirectTo` / `wx.switchTab` 各有适用场景，MUST 按路由意图选择正确的 API。
- **系统兼容性**：目标 iOS 12+ / Android 8.0+。MUST 在两类系统上验证关键流程可用。

### 性能底线

- **核心性能指标**（产品需求定义）：首屏加载 ≤ 2s，视图切换 ≤ 500ms，打卡响应 ≤ 1s。
- **setData 优化**：
  - 单次 `setData` 数据量 ≤ 256KB（微信限制），超出会导致异常。大列表用分批更新或虚拟滚动。
  - 避免高频调用 `setData`（如 scroll 事件中），MUST 做节流/防抖。
  - 路径更新优先——`this.setData({ ['list[' + index + '].checked']: true })` 优于全量替换 `this.setData({ list: newList })`。
  - 只传需要渲染的数据到 `data` 中，不在 `data` 中放纯计算中间值。
- **图片**：MUST 使用 `lazy-load` 属性懒加载图片，列表中的图片 MUST 设置合适尺寸避免加载后布局跳动。
- **长列表**：超过 100 条的列表 MUST 使用虚拟滚动（如 `recycle-view` / `virtual-list` 组件或第三方方案），不一次渲染全量 DOM。
- **生命周期**：MUST 不在 `onHide` / `onUnload` 中执行耗时操作（网络请求、大量计算）。清理工作在对应生命周期中做必要的资源释放即可。定时器在 `onHide` 中暂停、`onShow` 中恢复、`onUnload` 中清除。

### 项目结构约定

- **目录结构**：
  ```
  app/
  ├── pages/             # 页面（每个页面一个子目录）
  │   └── <page-name>/   # kebab-case
  │       ├── index.js   # 或 .ts / .wxs
  │       ├── index.wxml
  │       ├── index.wxss
  │       └── index.json
  ├── components/        # 自定义组件
  │   └── <comp-name>/   # kebab-case
  ├── utils/             # 工具函数
  ├── services/          # API 调用封装
  ├── styles/            # 公共样式
  │   ├── tokens.wxss    # 设计令牌
  │   └── common.wxss    # 公共样式
  └── app.js / app.json / app.wxss
  ```
  - 若采用 uni-app / Taro 等框架，以其项目模板约定为准。
- **页面/组件命名**：页面目录和组件目录统一 kebab-case（如 `event-detail/`）。每个页面的四个文件（js/wxml/wxss/json）MUST 同名。
- **公共样式**：设计令牌和全局 Reset 统一放在 `app/styles/` 下，各页面通过 `@import` 引用（原生）或框架提供的全局样式引入方式。MUST NOT 复制粘贴公共样式到每个页面。
- **API 调用封装**：所有 `wx.request` 调用 MUST 通过 `app/services/` 下的统一封装（含 baseURL、超时、请求/响应拦截器、401 自动续期）。MUST NOT 在页面/组件中裸调 `wx.request`。
- **工具函数**：跨页面复用的纯函数 MUST 放在 `app/utils/` 下，按功能域分文件。MUST NOT 在多个页面中复制同一段工具函数。

### `data-id` 可测试性契约

- **所有可交互元素必须添加 `data-id`**：按钮（含 icon-button）、输入框（input/textarea）、复选框（checkbox）、单选框（radio）、开关（switch）、导航链接（navigator）、弹窗容器、列表项、菜单项、Tab 项、分页控件——**MUST** 有 `data-id`。
- **命名规范**：`data-id` 值遵循 `<组件/页面缩写>-<元素角色>` 模式。用 kebab-case 串联，从大到小描述：`"event-list-search-input"`、`"event-card-delete-btn"`、`"event-form-save-btn"`。页面/组件缩写从目录名推导（`pages/event-list/` → `event-list`），元素角色描述该元素在组件中的用途。
- **纯展示元素不需要 `data-id`**：纯展示文本、装饰图标、布局容器（仅做 flex/grid 用）。
- **动态列表唯一性**：`wx:for` 渲染的列表项 `data-id` MUST 包含唯一标识符：`data-id="event-list-row-{{item.id}}"`。仅当项无 id 时才可用 `index`，但优先使用业务 id。
- **测试代码禁止以下定位方式**：CSS 类名（`.btn-primary`）、WXML 标签嵌套路径（`view > view > button:nth-child(2)`）、原生 `id` 属性、文本内容。定位统一走 `data-id`——一个属性，开发与测试双方共识。`data-id` 不替代原生 `id`（用于 DOM 锚点、无障碍等其他用途）。
- **自定义组件上的 data-id**：在自定义组件标签上写 `data-id="xxx"` 时，属性会传递到组件的根节点而非内部具体交互元素。测试代码定位时应定位根节点再查找内部元素。如需直接定位内部元素，在内部原生标签上单独写 `data-id`。

### 微信平台 API 使用规范

- **wx.login**：后端换取 openid 的逻辑封装在 `services/` 中，页面不直接接触 code 和 openid。`wx.login` 调用 MUST 在用户已同意隐私政策之后。
- **wx.request**：MUST 通过统一封装的请求实例发起，不裸调。含 baseURL、超时（默认 10s）、请求拦截（自动注入 JWT）、响应拦截（统一错误处理、401 自动续期）。
- **wx.setStorageSync / wx.getStorageSync**：Storage 键名 MUST 用常量定义，MUST NOT 在代码中散落字符串键（`wx.setStorageSync('token', ...)` 中的 `'token'` 应定义为常量）。Storage 总容量限制 10MB，MUST NOT 存放大体积数据。
- **授权流程**：
  - `wx.authorize` 只对 scope 生效——调用前先 `wx.getSetting` 检查授权状态，已拒绝时引导用户去设置页手动开启。
  - 地理位置、相机、相册等隐私权限 MUST 只在确实需要时才请求，且请求时机应有明确用户意图触发（点击按钮），不在 `onLoad` 自动请求。
- **订阅消息**：`wx.requestSubscribeMessage` MUST 在用户点击或明确交互后调用（禁止在页面加载时自动弹出）。一次性最多 3 个模板，MUST 列出模板 ID 常量。订阅结果 MUST 记录到后端。
- **隐私政策合规**：首次打开小程序 MUST 展示隐私政策弹窗并获取用户同意（微信审核红线）。隐私政策同意后 MUST 缓存到本地 Storage（含版本号），版本更新后需重新同意。基础库 ≥ 2.32.3 时 MUST 配合 `wx.onNeedPrivacyAuthorization` 处理隐私授权事件。
- **wx.getUserProfile（基础库 ≥ 2.10.0，但新版已回收）**：新版微信已回收 `wx.getUserProfile` 返回真实信息的权限。头像昵称收集 MUST 使用微信原生控件（`<button open-type="chooseAvatar">` + `<input type="nickname">`），不依赖 `wx.getUserProfile`。

### 审核与合规

- **审核红线**：MUST NOT 包含虚拟支付（非实物购买的付费内容）、诱导分享/关注（"分享后获得奖励"类设计）、类目不匹配（小程序类目与服务内容不符）。MUST NOT 利用微信关系链做未经用户授权的社交传播。
- **隐私政策弹窗**：为微信审核必经流程。用户未同意前 MUST NOT 调用 `wx.login` 或任何收集用户信息的 API。拒绝时展示静态提示页，MUST NOT 调用任何 API。
- **用户注销**：MUST 提供账户注销功能（微信审核要求），在"我的"→"设置"中有可触达的入口。
- **小程序备案**：上线前 MUST 完成工信部 ICP 备案（微信要求），开发阶段确认小程序主体信息（个人/企业）与对应能力边界（如个人主体无法使用 `wx.getPhoneNumber`）。

### 安全

> 通用安全底线见 `dev-security` rule——外部输入必校验、不硬编码密钥、参数化查询、输出转义、最小权限、敏感数据不进日志。以下为小程序特有补充：

- **openid 不暴露到前端日志**：openid 在 `services/` 封装层内部使用，MUST NOT 出现在日志、埋点、错误上报、界面展示中。业务逻辑使用后端生成的匿名化 `userId`。
- **Storage 敏感数据加密**：JWT token、用户手机号（如有）等敏感信息 MUST NOT 明文存储。对敏感数据做简单加密（可用 `wx.getStorageSync` + 对称加密），降低设备丢失或被恶意小程序读取的风险。
- **API 调用鉴权**：每个后端 API 请求 MUST 携带 JWT（`Authorization: Bearer <jwt>`），云函数调用 MUST 经过身份验证。MUST NOT 有公开不鉴权的数据读写接口。
- **网络传输**：生产环境 API 域名 MUST 配置 HTTPS，MUST NOT 有 HTTP 明文接口。开发/测试环境不受此限但须在项目文档中标注。
- **appSecret 保护**：小程序的 appSecret MUST NOT 出现在前端代码、git 历史或客户端打包产物中。appSecret 仅在后端/云函数中使用。
- **wx.request 域名白名单**：MUST 在微信后台配置 request 合法域名（`request` / `socket` / `uploadFile` / `downloadFile`），MUST NOT 在开发阶段跳过域名校验（不长期使用"不校验合法域名"开关）。

## 示例

### setData 优化
- ✅ `this.setData({ 'list[3].checked': true })` — 路径更新，只传输变更字段
- ❌ `this.setData({ list: this.data.list.map(item => item.id === id ? {...item, checked: true} : item) })` — 全量替换列表，数据量大时性能差

### data-id
- ✅ 组件中 `<button data-id="event-list-delete-btn-{{item.id}}" bindtap="onDelete">删除</button>`；测试中 `component.querySelector('[data-id="event-list-delete-btn-42"]')`
- ❌ 测试中 `component.querySelector('.btn-danger')` — CSS 类名随设计调整而变
- ❌ 测试中 `component.querySelectorAll('button')[2]` — DOM 顺序随重构而变

### API 封装
- ✅ `const api = require('../../services/api'); api.get('/events', { familyId })` — 走封装
- ❌ `wx.request({ url: 'https://api.example.com/events', ... })` — 裸调

### Storage
- ✅ `const STORAGE_KEYS = { TOKEN: 'auth_token', PRIVACY_CONSENT: 'privacy_consent' }; wx.setStorageSync(STORAGE_KEYS.TOKEN, jwt);`
- ❌ `wx.setStorageSync('token', jwt);` — 散落字符串键

### 隐私政策
- ✅ 首次打开弹窗 → 用户勾选同意 → `wx.setStorageSync('privacy_consent', { version: 1, time: Date.now() })` → 然后调用 `wx.login`
- ❌ `onLaunch` 中直接 `wx.login({ success: ... })` — 未经隐私同意即收集信息
