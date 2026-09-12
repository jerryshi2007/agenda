---
description: 测试规范——写或审查测试时遵循。
---

# test-standards · 测试规范

## 约束

- **与源码同结构放置**——测试文件放在被测代码旁或对应 test/ 目录，命名对应（`user.ts` ↔ `user.test.ts`），便于查找。
- **命名表意图**——测试名描述被验证的行为/场景（"密码错误 5 次后锁定账号"），而非"测试函数 X"。
- **一测一断言主旨**——一个测试聚焦一个行为点；多个断言应分属不同测试，定位失败更准。
- **测行为不测实现**——断言对外可观察的结果（输出、状态、副作用），不断言内部私有结构/调用次数。否则实现一改测试就挂。
- **必有失败路径**——除正常路径外覆盖错误、边界、空值。只测正常路径的测试是假保险。
- **稳定标识符定位**——测试代码定位元素时优先用稳定的语义标识符（`data-id`），**禁止**用 CSS 类名、DOM 结构索引（`findAll('button')[2]`）、或文本内容做首要定位手段。CSS 类名随设计调整而变，DOM 索引随重构而变，文本内容随国际化而变——这几种定位方式的测试脚本脆弱、改代码时容易断裂。`data-id` 的命名/必加清单/禁止定位方式见下方「data-id 契约」（权威定义）；各技术栈的写法差异（Vue 组件库透传 / 小程序自定义组件根节点）见对应 standards rule。
- **覆盖率是结果非目标**——追求有意义的覆盖（关键路径/分支），不为凑数字写无断言的测试。

## data-id 契约（权威定义）

`data-id` 是开发与测试双方共同约定、共同维护的可测试性锚点：开发在组件中写入，测试通过它定位元素，任何一方变更需与另一方对齐。一个属性，双方共识——不存在"这是测试的，我不能动"或"这是开发的，测试别碰"的模糊地带。开发还可以用它做事件委托、交互追踪、埋点。

- **命名规范**：`data-id` 值遵循 `<组件/页面缩写>-<元素角色>` 模式，用 kebab-case 串联、从大到小描述（`"user-list-search-input"`）。组件/页面缩写从组件文件名（`UserList.vue` → `user-list`）或页面目录名（`pages/schedule-list/` → `schedule-list`）推导，元素角色描述该元素在组件中的用途。
- **可交互元素必加**：按钮（含 icon-button）、输入框（input/textarea/select）、复选框（checkbox）、单选框（radio）、开关（switch）、链接（router-link/a/navigator）、弹窗容器、表格行/单元格、列表项、菜单项、Tab、分页控件——**必须**有 `data-id`。
- **纯展示元素按需**：纯展示文本（`<span>`、`<p>`）、装饰图标、布局容器（`<div>` 仅做 flex/grid 用）——不需要 `data-id`。
- **动态列表唯一性**：列表渲染（`v-for` / `wx:for`）的行内 `data-id` 必须包含唯一标识符（业务 id），保证集合内不重复（`:data-id="'user-list-row-' + user.id"`）。仅当项无 id 时才可用 `index`，但优先使用业务 id。
- **禁止的定位方式**：CSS 类名（`.btn-primary`、`.el-input`）、DOM 结构索引（`findAll('button')[2]`）、原生 `id`、文本内容。CSS 是设计师/组件库的领地，改类名、升级组件库、改 DOM 顺序、国际化换文案都不应触动测试。
- **不改原生 `id`**：HTML `id` 属性与 `data-id` 是两个东西——原生 `id` 用于 DOM 锚点、label `for` 关联、无障碍等各自用途，测试定位统一走 `data-id`，不混用。

### `data-id` 命名速查

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

## 示例

- ✅ `it('密码连续错误 5 次后锁定账号 15 分钟', ...)` 断言账号状态变为 locked
- ❌ `it('test1', () => { expect(user.name).toBe('a'); expect(user.age).toBe(1); expect(user.email).toBe('x'); })`（名表意图、多断言混杂、看不出测什么行为）
- ❌ 测了 `login()` 内部调了 `hashPassword()` 三次——换实现就挂（测实现而非行为）
- ❌ 测试中 `wrapper.find('.btn-danger')` —— 用 CSS 类名定位，类名随设计调整而变。应走稳定标识符（如 `[data-id="delete-btn"]`）
