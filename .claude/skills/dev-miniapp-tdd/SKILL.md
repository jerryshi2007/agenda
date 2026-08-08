---
name: dev-miniapp-tdd
description: 微信小程序 TDD 开发——基于 Jest + miniprogram-simulate + miniprogram-automator 的红绿重构循环。
rules: [dev-miniapp-standards, test-standards, dev-code-quality, ui-miniapp-standards, dev-security]
---

# dev-miniapp-tdd · 小程序 TDD 开发流程

## 铁律

**无失败测试无生产代码。** 先写代码再补测试？删掉重来。

## 流程

1. **Read 规则** — dev-miniapp-standards / test-standards / dev-code-quality / ui-miniapp-standards（涉及 auth/输入处理另读 dev-security）

2. **探查项目** — Read CLAUDE.md 了解目录约定，确认测试文件位置（`__tests__/` 下，与源码同结构），`npm test` 了解已有测试风格

3. **红——写失败测试**
   - Jest 28+ 作为测试框架
   - 组件测试用 `miniprogram-simulate`（微信官方组件模拟器，模拟 WXML/WXSS/JS 运行时）
   - E2E 测试用 `miniprogram-automator`（微信官方自动化工具，操作微信开发者工具）
   - **不适用 Playwright**（Playwright 操作浏览器 DOM，无法操作小程序 WXML 渲染层和微信原生组件）
   - 文件：`__tests__/<被测文件名>.test.js`（或 `.ts`），`describe('<组件/页面名>', ...)`，`it('行为描述', ...)`
   - Arrange: 使用 `simulate.load()` / `simulate.render()` 加载组件，设 props/data
   - Act: `[data-id="..."]` 定位 + 触发交互（`simulate.trigger()` / `component.setData()`）
   - Assert: 断言 DOM 内容/事件触发/`setData` 调用，不断言内部实现
   - 运行确认因"功能未实现"失败（非语法错误）

4. **绿——最小实现**
   - 只写让当前测试通过的代码（YAGNI）
   - WXML + WXSS + JS/TS（或等效的框架 SFC），各文件保持同名同目录
   - 每个可交互元素加 `data-id`（`<页面/组件缩写>-<元素角色>` 命名）
   - 运行确认通过

5. **重构——不改行为清理**
   - 提取 behaviors / mixins / composables（取决于技术栈），改善命名，拆分大组件
   - 检查规则违规（data-id 缺失、硬编码颜色、Storage key 未用常量等）
   - 每步后跑 `npm test` 确认通过

6. **循环** — 回到步骤 3，直到功能完整。每个测试独立可运行。

7. **回归验证** — `npm test`（全部通过）+ `npm run build` + `npm run lint`

## 测试工具链

### 单元测试与组件测试：miniprogram-simulate

`miniprogram-simulate` 是微信官方提供的组件单元测试工具，在 Node.js 环境中模拟小程序的 WXML/WXSS/JS 运行时。

```
npm install --save-dev jest miniprogram-simulate
```

**组件测试示例**：

```js
const simulate = require('miniprogram-simulate')
const path = require('path')

describe('event-card', () => {
  let componentId

  beforeAll(() => {
    // 加载自定义组件（需先 build 或使用源码路径）
    componentId = simulate.load(path.resolve(__dirname, '../../components/event-card/index'))
  })

  test('渲染日程名称和类型标签', () => {
    const component = simulate.render(componentId, {
      name: '钢琴课',
      type: 'activity',
      timeSlot: '16:00-17:00'
    })

    const nameEl = component.querySelector('[data-id="event-card-name"]')
    const typeEl = component.querySelector('[data-id="event-card-type-tag"]')

    expect(nameEl.textContent).toBe('钢琴课')
    expect(typeEl.textContent).toBe('课后活动')
  })

  test('点击打卡按钮触发 confirm 事件', () => {
    const component = simulate.render(componentId, {
      name: '练琴',
      type: 'routine',
      canCheckin: true
    })

    const checkinBtn = component.querySelector('[data-id="event-card-checkin-btn"]')
    const onCheckin = jest.fn()
    component.addEventListener('checkin', onCheckin)

    checkinBtn.dispatchEvent('tap') // simulate 中 tap 事件用 dispatchEvent
    expect(onCheckin).toHaveBeenCalled()
  })
})
```

**模拟 wx.* API**：

```js
// __tests__/helpers/wx-mock.js
global.wx = {
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  request: jest.fn(),
  navigateTo: jest.fn(),
  showToast: jest.fn(),
  showModal: jest.fn(),
  login: jest.fn()
}
```

**原则**：
- 微信原生 API（`wx.*`）MUST 在测试中 mock，MUST NOT 依赖真实的微信环境
- 每个测试文件独立设置 mock，MUST NOT 在测试间共享 mock 状态
- mock 调用断言（`expect(wx.login).toHaveBeenCalled()`）属于测行为的合理范围——调用微信 API 是不可见的外部副作用

### E2E 测试：miniprogram-automator

`miniprogram-automator` 是微信官方提供的自动化测试工具，通过 WebSocket 连接微信开发者工具进行页面操作和截图。

**配置与使用**：

```js
// testing/e2e/automator.config.js
const { launch } = require('miniprogram-automator')

// 启动微信开发者工具并连接小程序
const miniProgram = await launch({
  projectPath: 'path/to/app',  // 小程序项目路径
  cliPath: 'path/to/cli',      // 微信开发者工具 CLI 路径（CI 环境必须）
  args: ['--no-sandbox']       // CI 环境参数
})

const page = await miniProgram.currentPage()
// 使用 data-id 定位元素
const btn = await page.$('[data-id="event-list-add-btn"]')
await btn.tap()
```

**E2E 测试示例**：

```js
const { launch } = require('miniprogram-automator')

describe('[E2E] 日程创建', () => {
  let miniProgram
  let page

  beforeAll(async () => {
    miniProgram = await launch({ projectPath: 'path/to/app' })
  }, 30000) // 启动超时放宽

  afterAll(async () => {
    await miniProgram.close()
  })

  test('[E2E-01] 从首页进入创建日程页', async () => {
    page = await miniProgram.currentPage()
    const addBtn = await page.$('[data-id="home-add-event-btn"]')
    await addBtn.tap()
    await miniProgram.waitFor(500) // 等待页面跳转

    page = await miniProgram.currentPage()
    expect(page.path).toBe('pages/event-form/index')
  })

  test('[E2E-02] 填写并提交日程', async () => {
    const nameInput = await page.$('[data-id="event-form-name-input"]')
    await nameInput.input('钢琴课')

    const saveBtn = await page.$('[data-id="event-form-save-btn"]')
    await saveBtn.tap()

    await miniProgram.waitFor(1000)
    const toast = await page.$('[data-id="common-toast"]')
    expect(toast).toBeTruthy()
  })
})
```

**注意事项**：
- `miniprogram-automator` MUST 在有微信开发者工具的环境下运行（本地或 CI 预装）
- CI 中 MUST 使用微信开发者工具 CLI 模式（`--no-sandbox`）
- E2E 测试执行时间较长（启动开发者工具约 10-20s），MUST 与单元测试分开运行
- 每个 spec 运行前 MUST 重置数据（通过 seed API 或后端预设）
- **api() 方法**：可直接调用小程序中的 JS 方法（如 `miniProgram.call('api/login')`）做 seed 数据准备，避免通过 UI 操作设置数据

### 测试分层策略

| 层级 | 工具 | 覆盖范围 | 速度 | 占比建议 |
|------|------|---------|------|:--:|
| 单元测试 | Jest + mock | 工具函数、逻辑方法、数据处理 | 快（ms 级） | 40% |
| 组件测试 | Jest + miniprogram-simulate | 组件渲染、交互、事件、状态变化 | 较快（100ms 级） | 40% |
| E2E 测试 | miniprogram-automator | 关键用户流程、多页面跳转、数据持久化 | 慢（s 级） | 20% |

## 关键原则

- **测试先于实现**：测试描述"要什么"，实现回答"怎么做"
- **最小实现**：只让当前测试过，不预写代码
- **`[data-id="..."]` 唯一定位**：禁止 CSS 类名/WXML 标签嵌套路径/原生 id/文本内容定位
- **测行为不测实现**：断言渲染结果、事件触发、API 调用，不断言内部 data 字段值
- **小程序 mock 优先于真实环境**：单元和组件测试不依赖微信开发者工具
- **miniprogram-automator 用于关键 E2E**：只在需要验证跨页面流程、原生组件交互时才使用
- **测试文件与源码同结构放置**：`__tests__/` 下，命名 `<源码文件名>.test.js`（或 `.ts`）
- **npm CLI 全程驱动**：`npm test`、`npm run build`、`npm run lint`，不依赖 IDE
