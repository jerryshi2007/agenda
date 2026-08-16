---
name: dev-vue3-tdd
description: Vue 3 TDD 开发——基于 Vitest + Vue Test Utils + pnpm CLI 的红绿重构循环。
rules: [dev-vue3-standards, test-standards, dev-code-quality, design-ui-standards, dev-security, dev-codegraph]
---

# dev-vue3-tdd · Vue 3 TDD 开发流程

## 铁律

**无失败测试无生产代码。** 先写代码再补测试？删掉重来。

## 流程

1. **Read 规则** — dev-vue3-standards / test-standards / dev-code-quality / design-ui-standards（涉及 auth/输入处理另读 dev-security）

2. **探查项目** — 用 `codegraph_explore`（或 `codegraph explore`）查被测组件/composable 及其调用关系、定位复用点（见 `dev-codegraph` rule）；Read CLAUDE.md 了解目录约定，确认测试文件位置（`__tests__/` 下，与源码同结构），`pnpm test run` 了解已有测试风格

3. **红——写失败测试**
   - Vitest + `@vue/test-utils` + jsdom
   - 文件：`<被测文件名>.test.ts`，`describe('<组件名>', ...)`，`it('行为描述', ...)`
   - Arrange: mount 组件，设 props，注入 mock
   - Act: `[data-id="..."]` 定位 + 触发交互
   - Assert: 断言 DOM/emits/composable 返回值，不断言内部实现
   - 运行确认因"功能未实现"失败（非语法错误）

4. **绿——最小实现**
   - 只写让当前测试通过的代码（YAGNI）
   - `<script setup lang="ts">`、`defineProps<T>()`、`defineEmits<T>()`、`<style scoped>`
   - 每个可交互元素加 `data-id`（`<组件缩写>-<元素角色>` 命名）
   - 运行确认通过

5. **重构——不改行为清理**
   - 提取 composable、改善命名、拆分大组件
   - 检查规则违规（未 scoped、硬编码颜色、缺 data-id 等）
   - 每步后跑 `pnpm test run` 确认通过

6. **循环** — 回到步骤 3，直到功能完整。每个测试独立可运行。

7. **回归验证** — `pnpm test run`（全部通过）+ `pnpm build` + `pnpm lint` + `pnpm vue-tsc --noEmit`

## 关键原则

- **测试先于实现**：测试描述"要什么"，实现回答"怎么做"
- **最小实现**：只让当前测试过，不预写代码
- **`[data-id="..."]` 唯一定位**：禁止 CSS 类名/DOM 索引/原生 id/文本内容定位
- **测行为不测实现**：断言渲染结果和 emits，不断言内部 ref/computed
- **pnpm CLI 全程驱动**：`pnpm test`、`pnpm build`、`pnpm lint`，不依赖 IDE