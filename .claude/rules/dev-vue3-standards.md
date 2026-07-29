---
description: Vue 3 编码规范——编写或审查 Vue 3 代码时遵循。
---

# dev-vue3-standards · Vue 3 编码规范

## 约束

### 可测试性
- **`data-id` 共同契约**——所有可交互元素必须添加 `data-id` 属性。`data-id` 由开发与测试双方共同约定、共同维护：开发在组件中写入，测试通过它定位元素，任何一方变更需要与另一方对齐。**禁止**测试代码依赖 CSS 类名、标签嵌套路径、原生 `id`、或文本内容来定位——那些会随设计和重构变动。
- **`data-id` 是共享锚点**——开发可以用它做事件委托、交互追踪、埋点；测试用它做定位。一个属性，双方共识，不存在"这是测试的，我不能动"或"这是开发的，测试别碰"的模糊地带。
- **命名规范**：`data-id` 值遵循 `<组件缩写>-<元素角色>` 模式。用 kebab-case 串联，从大到小描述：`"user-list-search-input"`、`"user-card-delete-btn"`、`"position-form-save-btn"`。组件缩写从组件文件名推导（`UserList.vue` → `user-list`），元素角色描述该元素在组件中的用途。命名详见文末速查表。
- **可交互元素必加**：按钮（含 icon-button）、输入框（input/textarea/select）、复选框（checkbox）、单选框（radio）、开关（switch）、链接（router-link/a）、弹窗容器、表格行/单元格、菜单项、Tab、分页控件——**必须**有 `data-id`。
- **纯展示元素按需**：纯展示文本（`<span>`、`<p>`）、装饰图标、布局容器（`<div>` 仅做 flex/grid 用）——不需要 `data-id`。
- **组件库透传**：`data-id` 写在 UI 框架组件标签上（如 `<el-input data-id="...">` 或 `<a-input data-id="...">`）时，属性会透传到该组件的根 DOM 节点（通常是 wrapper `<div>`），而非内部实际 `<input>`。测试代码应先定位 wrapper 再找内部交互元素：`wrapper.find('[data-id="xxx"]').find('input')`。若要直接定位内部元素，将 `data-id` 写在原生 HTML 标签上而非组件标签上。
- **动态列表唯一性**：`v-for` 渲染的行内 `data-id` 必须包含唯一标识符（如行数据 id），保证集合内不重复：` :data-id="'user-list-row-' + user.id"`。仅当行无 id 时才可用 `index`，但应优先使用业务 id。
- **不依赖 CSS 类名定位**——测试代码禁止用 `.btn-primary`、`.el-input` 等类选择器定位元素。CSS 是设计师的领地，改类名不应触动测试。也不依赖 UI 组件库（如 Element Plus、Ant Design Vue）的内部类名——组件库升级可能改动内部实现。
- **不改原生 `id`**——HTML `id` 属性和 `data-id` 是两个东西。原生 `id` 用于 DOM 锚点、label `for` 关联、无障碍——那些有各自用途。测试定位统一走 `data-id`，不混用。
- **测试文件与源码同结构放置**——测试文件放在被测文件同目录的 `__tests__/` 下，命名 `<源码文件名>.test.ts`。组件改名/移动时，测试文件跟着改名/移动——范围可控、路径可预测。

### 组件组织
- **SFC 结构固定为 `<script setup>` → `<template>` → `<style scoped>`**——脚本、模板、样式严格按此顺序排列。顺序统一让团队扫读组件时形成肌肉记忆，先看逻辑再看渲染再看样式。
- **文件名 PascalCase**——单文件组件（SFC）文件用 PascalCase（如 `UserList.vue`），目录用 kebab-case（如 `user-list/`）。PascalCase 文件名在编辑器中按首字母跳转友好，kebab-case 目录在 URL 和路由路径中自然。
- **目录约定**：`app/src/components/` 放通用组件，`app/src/views/` 放路由页面，`app/src/composables/` 放组合式函数，`app/src/stores/` 放 Pinia store，`app/src/api/` 放 API 调用封装，`app/src/types/` 放共享 TypeScript 类型。

### Composition API
- **`<script setup>` 优先**——新组件只用 `<script setup lang="ts">`，语义更简洁、类型推断更好、无需手动 `return` 暴露给模板。
- **Composables 提取复用逻辑**——将可复用状态逻辑抽取为 `useXxx` 组合式函数，放在 `app/src/composables/`。composable 命名以 `use` 开头，返回值用 `ref`/`reactive`/`computed`，遵循"输入→逻辑→输出"单一职责。
- **ref vs reactive 选择**：基本类型和需要替换整个值的对象用 `ref`；不需要替换整体的复杂对象（如表单数据）用 `reactive`。避免对 `reactive` 对象做解构（会丢失响应性），若需解构用 `toRefs`。
- **`computed` 用于派生状态**——能从已有状态计算得出的值不另存为 `ref`，避免状态同步不一致。

### Props / Emits 类型化
- **`defineProps<T>()` / `defineEmits<T>()` 带 TypeScript 类型**——用泛型声明 props 和 emits 类型，编译期检查传参错误。
- **`withDefaults` 声明默认值**——需要默认值的 props 用 `withDefaults(defineProps<T>(), { ... })` 声明，清晰表达"可选但默认是什么"。
- **Props 不可变**——子组件不直接修改 props；需要变更时通过 emit 事件通知父组件。

### 状态管理
- **Pinia**——全局状态用 Pinia。新项目优先用 Setup Store（`defineStore` 内用 Composition API 风格），已有项目保持一致。
- **服务端状态与客户端状态分离**——Pinia store 只放客户端状态（UI 状态、用户会话、表单草稿等会"变化"的状态）。服务端缓存数据（列表、详情）走 TanStack Query / VueUse `useFetch` 等专用方案，不塞进 store 里造成双重管理。
- **不在 store 里放服务端缓存**——数据所有权在服务端，前端缓存应带过期/重取/stale-while-revalidate 机制，Pinia 不是为这个设计的。

### 路由
- **Vue Router 4**——路由配置用 `createRouter` + `createWebHistory`。路由名称用 kebab-case（如 `user-detail`）。
- **路由懒加载**——所有路由组件用 `() => import('@/views/xxx.vue')` 动态导入，首屏不加载非首页代码。
- **导航守卫**——全局前置守卫（`beforeEach`）放权限校验、登录检查；路由独享守卫（`beforeEnter`）放单路由业务判断；组件内守卫（`onBeforeRouteLeave`）放未保存提示等场景。

### 表单验证
- **UI 框架内置校验优先**——表单验证用所选 UI 框架（Element Plus / Ant Design Vue）Form 组件内置的 `rules` 校验，不手写验证逻辑。简单规则（必填、长度、正则）在 `rules` 中声明，复杂异步校验（用户名唯一性等）用自定义 validator。
- **提交前校验**——表单提交前调用 `formRef.validate()` 统一校验，不等后端返回后补锅。前端校验是第一道防线，后端校验是最后一道防线。
- **校验失败反馈**——校验错误信息明确、中文描述，提示用户具体哪错了、怎么改。不显示"输入无效"这种无信息量的通用错误。

### API 调用
- **统一封装 axios**——所有 HTTP 请求通过 `app/src/api/` 下的统一实例发出，含 baseURL、超时、请求/响应拦截器。不在组件里直接 `import axios` 裸调。
- **错误拦截**——响应拦截器中统一处理 401（跳登录）、403（提示无权限）、5xx（提示服务异常），业务代码只关心成功路径。
- **请求取消**——长时间请求或页面离开时用 `AbortController` 或 axios `CancelToken` 取消，避免内存泄漏和过期响应覆盖当前数据。

### 组件通信
- **Props down / Events up**——父→子用 props，子→父用 emits。这是 Vue 推荐的明确数据流。
- **谨慎使用 provide / inject**——仅用于深层组件树（如主题、配置、表单上下文）传值，不用于日常父子通信。隐式依赖让组件难以独立理解和测试。
- **不跨级传递**——祖孙通信不走 props 逐层传递；对于共享状态优先考虑 composable 提取或 Pinia，对于透传内容用插槽（slot）。
- **Slot 用法**——内容分发用默认插槽，多区域分发用具名插槽（`<slot name="header">`），数据回传用作用域插槽（`<slot :item="item">`）。组件库提供的 slot 优先使用，不自造轮子。

### 性能
- **`defineAsyncComponent`**——非首屏的大组件用 `defineAsyncComponent` 按需加载，减少初始包体积。
- **`v-memo` / `v-once`**——大列表中不变的行用 `v-memo` 跳过 diff；完全静态内容用 `v-once` 只渲染一次。
- **`shallowRef` / `shallowReactive`**——只关心顶层属性变化的大型数据结构用 shallow 系列，跳过深层响应式代理，减少内存和追踪开销。
- **大列表虚拟滚动**——超 100 条的可视列表用虚拟滚动组件（如 `vue-virtual-scroller`），不一次渲染全量 DOM。

### 样式
- **`<style scoped>` 优先**——组件样式默认 scoped，防止样式泄漏到其他组件。全局样式只放设计令牌、Reset、公共布局（`app/src/styles/` 下）。
- **深度选择器 `:deep()`**——需穿透自定义子组件根节点时用 `:deep(.child-class)`，避免用已废弃的 `>>>` 或 `/deep/`。**禁止**用 `:deep()` 覆盖 UI 框架组件（Element Plus / Ant Design Vue）内部样式（框架升级时内部样式可能变化，见 `design-ui-standards` rule）。
- **CSS 变量做设计令牌**——在 `app/src/styles/tokens.css` 中定义 CSS 变量，变量值映射到 UI 框架主题变量（如 `--color-primary: var(--el-color-primary)`）。组件中通过自定义变量名引用（`var(--color-primary)`），不直接使用裸值。令牌定义策略见 `design-ui-standards` rule。

## 示例

### 组件组织
- ✅ `app/src/components/user/UserCard.vue`：`<script setup lang="ts">` → `<template>` → `<style scoped>`
- ❌ `<template>` 放最前，或 `<script>` 不用 `setup`，或样式不加 scoped

### 可测试性
- ✅ 组件中 `<button data-id="user-list-delete-btn-42" @click="remove">删除</button>`；测试中 `wrapper.find('[data-id="user-list-delete-btn-42"]')`
- ❌ 测试中 `wrapper.find('.btn-danger')` —— CSS 类名随设计调整而变
- ❌ 测试中 `wrapper.findAll('button')[2]` —— DOM 顺序随重构而变
- ❌ 测试中 `wrapper.find('#delete-btn')` —— 原生 id 有别的用途，不混用

### Props / Emits 类型化
- ✅
```ts
interface Props { userId: number; userName?: string }
const props = withDefaults(defineProps<Props>(), { userName: '' })
const emit = defineEmits<{ (e: 'delete', id: number): void }>()
```
- ❌ `defineProps({ userId: Number })` —— 无类型约束，传字符串不会报错

### 状态管理
- ✅ `app/src/stores/user.ts`：`defineStore('user', () => { ... })` 存登录用户信息、菜单折叠状态等客户端状态
- ❌ 在 Pinia store 里存 `allUsers: User[]` 然后手工写 `fetchUsers`、`refreshUsers`（应走服务端缓存方案）
- ❌ `const users = reactive(await fetchUsers())` 直接存组件里——页面切换数据丢失且每个组件各自请求

### API 调用
- ✅ `app/src/api/request.ts` 导出 `request` 实例，组件中 `import { request } from '@/api/request'`
- ❌ 组件里 `import axios from 'axios'; axios.get('/api/users')` 裸调

### 样式
- ✅ `<style scoped> .card { color: var(--color-text); } </style>` 和 `:deep(.el-input__inner) { border: none; }`
- ❌ `<style> .card { color: #333; } </style>` —— 全局作用 + 硬编码颜色

## `data-id` 命名速查

| 元素 | 命名模式 | 示例 |
|---|---|---|
| 搜索输入框 | `<组件>-search-input` | `user-list-search-input` |
| 新增按钮 | `<组件>-add-btn` | `user-list-add-btn` |
| 删除按钮（行内带 id） | `<组件>-delete-btn-<id>` | `user-list-delete-btn-42` |
| 删除按钮（单实例，无 id） | `<组件>-delete-btn` | `user-card-delete-btn` |
| 编辑按钮（行内带 id） | `<组件>-edit-btn-<id>` | `user-list-edit-btn-42` |
| 编辑按钮（单实例，无 id） | `<组件>-edit-btn` | `user-card-edit-btn` |
| 表单提交 | `<组件>-save-btn` | `position-form-save-btn` |
| 表单取消 | `<组件>-cancel-btn` | `position-form-cancel-btn` |
| 弹窗容器 | `<组件>-dialog` | `user-list-dialog` |
| 弹窗确认 | `<组件>-confirm-btn` | `user-list-confirm-btn` |
| 表格行 | `<组件>-row-<id>` | `org-tree-row-42` |
| 分页控件 | `<组件>-pagination` | `user-list-pagination` |
| 菜单项 | `<组件>-menu-<key>` | `sidebar-menu-org` |
| Tab 项 | `<组件>-tab-<key>` | `detail-tab-permission` |
| 加载骨架 | `<组件>-loading` | `user-list-loading` |
| 错误提示 | `<组件>-error` | `user-list-error` |
| 空态提示 | `<组件>-empty` | `user-list-empty` |
| 展开/收起触发器 | `<组件>-expand-trigger` | `user-list-expand-trigger` |
| 查看更多 | `<组件>-load-more` | `user-list-load-more` |
