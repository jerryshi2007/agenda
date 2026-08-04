---
name: dev-vue3-tdd
description: Vue 3 项目写新功能或修可测 bug 时使用——基于 Vitest + Vue Test Utils + pnpm/vite CLI 的红绿重构循环，集成 pnpm test/build/lint 验证。
rules: [dev-vue3-standards, test-standards, dev-code-quality, design-ui-standards, dev-security]
---

# dev-vue3-tdd · Vue 3 TDD 开发流程

## 何时使用
- 写 Vue 3 新组件 / composable / store / API 封装且可测试时
- 修一个可复现的 Vue 3 bug 时（先写失败测试复现它）
- 通过 pnpm / vite CLI 管理测试与构建的 TDD 开发
- 将确认后的原型（`production/prototypes/` 下的 HTML）转为 Vue 3 生产组件时

## 铁律

```
无失败测试无生产代码
```

先写测试之前写了代码？删掉。重新开始。不保留为"参考"，不"边写测试边改"。

## 流程

1. **先 Read 规则并严格遵守其约束**
   - `rules/dev-vue3-standards.md` — Vue 3 编码规范（组件组织 / Composition API / Props-Emits 类型化 / Pinia / 路由 / API 调用 / 组件通信 / 性能 / 样式 / 可测试性）
   - `rules/test-standards.md` — 测试规范（命名 / 一测一断言 / 测行为不测实现）
   - `rules/dev-code-quality.md` — 代码质量底线（单一职责 / YAGNI / 优先复用）
   - `rules/design-ui-standards.md` — UI 标准（设计令牌 / 响应式 / 可访问性 / 组件复用优先）
   - 若涉及 auth / token / 输入处理，另 Read `rules/dev-security.md`

2. **探查项目结构**
   - Read 项目根目录的 `CLAUDE.md`，了解 `app/` 下源码目录与测试目录的约定
   - 确认已有测试文件位置：测试文件与源码同结构放置（`app/src/components/Xxx.vue` ↔ `app/src/components/__tests__/Xxx.test.ts`）
   - 用 `pnpm test run` 了解已有测试命名风格与通过状态
   - 确认 `vite.config.ts` 中 Vitest 测试配置（`test` 字段，jsdom 环境、路径别名 `@` 映射）。Vitest 配置可嵌入 `vite.config.ts` 或独立 `vitest.config.ts`，优先查 `vite.config.ts`

3. **红——写一个失败的测试**
   - 用 Vitest + `@vue/test-utils` + jsdom 写测试
   - 测试文件命名：`<被测文件名>.test.ts`，放在被测文件同目录的 `__tests__/` 下
   - 测试套件名用 `describe('<组件/composable/store 名>', ...)`，测试用例名描述行为与预期（如 `it('点击删除按钮后触发 delete 事件并传递 id', ...)`）
   - Arrange：用 `mount` 或 `shallowMount` 挂载组件，设置 props、注入 mock 依赖
   - Act：用 `[data-id="..."]` 定位元素并触发交互（`await wrapper.find('[data-id="user-card-delete-btn"]').trigger('click')`）或调用方法
   - Assert：断言 DOM 输出（`wrapper.text()`、`wrapper.find(...).exists()`）、emit 事件（`wrapper.emitted()`）、composable 返回值。断言行为不断言内部实现细节
   - 运行 `pnpm test run <测试文件>` 确认它因"功能未实现"而失败（而非因语法/类型错误）

4. **绿——写最小实现使其通过**
   - 只写让当前测试通过的代码，不多加（YAGNI）
   - 遵循 `dev-vue3-standards`：`<script setup lang="ts">`、`defineProps<T>()`、`defineEmits<T>()`、`<style scoped>`
   - **每个可交互元素必须添加 `data-id`**，遵循 `<组件缩写>-<元素角色>` 命名规范。`data-id` 是开发与测试的共同契约——组件中写了，测试中用，任何一方改需要双方对齐
   - 运行 `pnpm test run <测试文件>` 确认通过
   - 若需要新建文件，按 `app/src/components/` / `app/src/composables/` / `app/src/stores/` / `app/src/api/` 等约定目录创建

5. **重构——在不改行为的前提下清理**
   - 提取重复逻辑为 composable、改善变量/函数命名、拆分大组件
   - 检查是否违反 `dev-vue3-standards`（如 `<style>` 未 scoped、props 类型用 `Object` 而非 TypeScript 泛型、硬编码颜色值、缺少 `data-id` 等）
   - 每步重构后跑 `pnpm test run` 确认仍全部通过
   - 重构范围不跨出当前文件组，重构与功能提交分开

6. **循环**
   - 回到第 3 步处理下一个行为点，直到功能完整
   - 每个测试独立可运行、不依赖其他测试的执行顺序

7. **回归 + 构建验证**
   - 全部完成后跑 `pnpm test run` 确认全部测试通过
   - 跑 `pnpm build` 确认编译无类型错误、无构建警告
   - 跑 `pnpm lint` 确认无 ESLint 新增问题

## TDD 检查清单

标记工作完成前：
- [ ] 每个新函数/方法有测试
- [ ] 看了每个测试在实现前失败
- [ ] 每个测试因预期原因失败（功能缺失，非拼写错误）
- [ ] 写了最小代码通过每个测试
- [ ] 全部测试通过
- [ ] 输出无错误/警告
- [ ] 测试用真实代码（mock 仅在不可避免时）
- [ ] 覆盖了边界和错误路径

不能全勾？你跳过了 TDD。重新开始。

## 关键原则

- **测试先于实现**——测试描述"要什么"（组件长什么样、行为是什么），实现回答"怎么做"。
- **最小实现**——只让当前测试过，不为后续测试预写代码（YAGNI）。
- **每步都跑 pnpm test**——红、绿、重构每步后都跑，错误立刻暴露。
- **Vitest + @vue/test-utils 组合拳**——Vitest 做断言与运行框架，`@vue/test-utils` 做组件挂载与交互。测组件时 mount 后断言 DOM 和 emits。
- **`[data-id="..."]` 是唯一定位方式**——测试代码只用 `data-id` 属性定位元素。禁止用 CSS 类名、DOM 结构索引、原生 `id`、文本内容定位。`data-id` 是开发与测试的共同契约，双方共用、双方对齐。
- **测行为不测实现**——断言组件渲染结果和发出的 emit 事件，不断言内部 ref 值或 computed 的中间计算结果。
- **pnpm/vite CLI 全程驱动**——`pnpm test`、`pnpm build`、`pnpm lint`，不依赖 IDE 按钮。

## 常见合理化（全错）

| 借口 | 现实 |
|------|------|
| "太简单不需要测试" | 简单代码也会坏。写测试只要 30 秒。 |
| "我之后补测试" | 后补的测试直接通过证明不了什么。 |
| "我已经手动测过了" | 手动测试无记录、不可复跑、容易忘。 |
| "删掉 X 小时的工作太浪费" | 沉没成本谬误。不可信的代码是技术债。 |
| "TDD 太教条，实用主义才灵活" | TDD 就是实用主义——比调试快、防回归、文档即测试。 |
| "就这一次" | 没有例外。 |
| "先探索一下" | 探索完删掉，从 TDD 开始。 |
| "测试不好写说明设计有问题" | 听测试的。不好测试 = 不好用。 |

## 常用 pnpm 命令速查

| 场景 | 命令 |
|------|------|
| 跑全部测试（单次） | `pnpm test run` |
| 跑单个测试文件 | `pnpm test run <路径>/Xxx.test.ts` |
| 跑匹配名称的测试 | `pnpm test run -t "<测试名关键词>"` |
| 生产构建 | `pnpm build` |
| 类型检查 | `pnpm vue-tsc --noEmit` |
| ESLint 检查 | `pnpm lint` |
| 创建 Vite + Vue 3 项目 | `pnpm create vite web --template vue-ts` |
| 添加 Vitest + vue-test-utils | `pnpm add -D vitest @vue/test-utils jsdom` |
| 添加 Pinia | `pnpm add pinia` |
| 添加 Vue Router | `pnpm add vue-router` |

## 示例

### 红阶段
```ts
// 文件：app/src/components/__tests__/UserCard.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserCard from '../UserCard.vue'

describe('UserCard', () => {
  it('点击删除按钮后触发 delete 事件并传递用户 id', async () => {
    // Arrange
    const wrapper = mount(UserCard, {
      props: { userId: 1, userName: '张三' }
    })

    // Act
    await wrapper.find('[data-id="user-card-delete-btn"]').trigger('click')

    // Assert
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')![0]).toEqual([1])
  })

  it('渲染用户名称', () => {
    // Arrange
    const wrapper = mount(UserCard, {
      props: { userId: 1, userName: '张三' }
    })

    // Assert
    expect(wrapper.text()).toContain('张三')
  })
})
```
→ `pnpm test run app/src/components/__tests__/UserCard.test.ts` — 失败（点击按钮后未 emit 'delete' 事件）

### 绿阶段
```vue
<!-- 文件：app/src/components/UserCard.vue -->
<script setup lang="ts">
interface Props { userId: number; userName: string }
defineProps<Props>()
const emit = defineEmits<{ (e: 'delete', id: number): void }>()
</script>

<template>
  <div class="user-card">
    <span>{{ userName }}</span>
    <button data-id="user-card-delete-btn" @click="emit('delete', userId)">删除</button>
  </div>
</template>

<style scoped>
.user-card { display: flex; align-items: center; gap: var(--space-sm); }
</style>
```
→ `pnpm test run app/src/components/__tests__/UserCard.test.ts` — 通过

### E2E 测试复用同一 `data-id`
> 以下示例展示项目后续引入 E2E 测试（如 Playwright）时，如何与单元测试共用 `data-id` 定位符。当前项目可能尚未配置 E2E 框架，此处作为规范参考。
```ts
// Playwright（E2E 测试）—— 与单元测试用同一个 data-id 值
await page.locator('[data-id="user-card-delete-btn"]').click()
```

### 重构阶段
- 若 `delete` 按钮逻辑变复杂（如需要二次确认），提取 `useConfirmDelete` composable
- 检查是否缺少 `data-id` 属性（按钮必须有，纯展示文本不需要）
- 检查样式是否用 CSS 变量而非硬编码颜色
→ `pnpm test run` — 全部通过
