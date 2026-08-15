---
name: test-e2e-playwright
description: 按测试用例矩阵写 Playwright E2E 脚本时使用——项目结构、data-id 定位、Page Object 模式、fixture/seed、多浏览器。
rules: [test-standards, dev-miniapp-standards, req-staging]
---

# test-e2e-playwright · Playwright E2E 脚本编写

## 何时使用
- 按 `test-plan.md` 提供的用例矩阵编写 Playwright E2E 脚本时
- 需要搭建 E2E 测试目录结构、配置多浏览器、设计 Page Object 时
- 编写 fixture / seed 数据管理脚本时

## 前置条件
- 已有 `test-plan.md`（`test-planner` 产出），含测试矩阵、data-id 清单、测试数据需求
- Read `production/staging/<name>/requirement.md` + `epic-story.md`（验收标准/边界异常/优先级）
- Read 项目根目录的 `CLAUDE.md`，了解 `app/` 下前端目录约定
- Read `rules/dev-miniapp-standards.md` 了解 `data-id` 命名规范

## 目录结构

```
testing/
└── e2e/                          # E2E 测试根目录
    ├── playwright.config.ts      # Playwright 配置
    ├── fixtures/                 # 测试夹具（seed 数据、登录态、mock）
    │   ├── auth.fixture.ts       # 登录态夹具（各角色 token/session）
    │   └── data.fixture.ts       # 测试数据工厂（seed / reset）
    ├── pages/                    # Page Object
    │   ├── login.page.ts         # 登录页
    │   ├── dashboard.page.ts     # 首页
    │   └── ...                   # 每个路由/页面一个 Page Object
    ├── specs/                    # 测试脚本
    │   ├── login.spec.ts         # 与 test-plan.md 中 E2E-01~E2E-0N 对应
    │   ├── user-management.spec.ts
    │   └── ...
    └── utils/                    # 工具函数
        ├── constants.ts          # URL、超时、data-id 常量
        └── helpers.ts            # 复用断言、等待策略
```

## Page Object 模式

每个页面一个 class，封装 locator 和 action。Locator 只用 `data-id` 定位。

```ts
// testing/e2e/pages/login.page.ts
import { Page, Locator } from '@playwright/test'

export class LoginPage {
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly submitBtn: Locator
  readonly errorMsg: Locator

  constructor(public readonly page: Page) {
    // 只用 data-id 定位，与 Vitest 单元测试共用同一标识符
    this.usernameInput = page.locator('[data-id="login-username-input"]')
    this.passwordInput = page.locator('[data-id="login-password-input"]')
    this.submitBtn = page.locator('[data-id="login-submit-btn"]')
    this.errorMsg = page.locator('[data-id="login-error-msg"]')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username)
    await this.passwordInput.fill(password)
    await this.submitBtn.click()
  }
}
```

**约定**：
- Page Object 文件名 = `<页面名>.page.ts`（kebab-case），class 名 = `<页面名>Page`（PascalCase）
- 每个 Locator 成员只对应一个 `data-id`
- action 方法封装业务操作（不止单次 click），不把组合步骤暴露给 spec

## data-id 定位策略

**定位规范定义见 `rules/dev-miniapp-standards.md` data-id 节（权威来源）。** 以下为 Playwright 特有补充：

- **Playwright 定位方式**：使用 `page.locator('[data-id="..."]')` 定位元素，禁止 CSS 类名、DOM 索引、原生 `id`、文本内容。
- **单元测试与 E2E 共用**：同一个 `data-id` 值在 Vitest 和 Playwright 中复用，保证两套测试定位一致性。
- **动态列表唯一性**：行内元素 `data-id` 含业务 id（如 `[data-id="user-list-row-42"]`），Playwright 中用模板字符串拼接。
- **组件库透传**：UI 框架组件上写 `data-id` 时，属性可能透传到根 wrapper 而非内部元素。若需定位内部元素，优先用 `page.locator('[data-id="xxx"]').locator('input')`。
- **data-id 前缀清单**：读取 `test-plan.md` 中的"页面/路由清单"表格获取各页面的 `data-id` 前缀。

## Fixture / Seed 数据

### 登录态夹具
```ts
// testing/e2e/fixtures/auth.fixture.ts
import { test as base } from '@playwright/test'
import { LoginPage } from '../pages/login.page'

export type Role = 'admin' | 'user' | 'locked'

// 预置测试账号（从 test-plan.md "测试数据需求" 获取）
const TEST_ACCOUNTS: Record<Role, { username: string; password: string }> = {
  admin: { username: 'admin', password: 'Test@123' },
  user: { username: 'normal_user', password: 'Test@123' },
  locked: { username: 'locked_user', password: 'Test@123' },
}

export const test = base.extend<{ loginAs: (role: Role) => Promise<void> }>({
  loginAs: async ({ page }, use) => {
    await use(async (role: Role) => {
      const loginPage = new LoginPage(page)
      await loginPage.goto()
      await loginPage.login(TEST_ACCOUNTS[role].username, TEST_ACCOUNTS[role].password)
    })
  },
})
```

### 数据夹具
```ts
// testing/e2e/fixtures/data.fixture.ts
// 测试前执行 seed 脚本重置数据库到已知状态
// 对应 test-plan.md "测试数据需求" 中的 seed:e2e 脚本
import { test as base } from '@playwright/test'

export const test = base.extend<{ seedData: () => Promise<void> }>({
  seedData: async ({}, use) => {
    await use(async () => {
      // 调用后端 seed API 或执行 seed 脚本
      // await request.post('/api/test/seed', { data: 'e2e' })
    })
  },
})
```

**原则**：
- 每个 spec 运行前确保数据可预测——seed 重置 / API 创建 / 依赖注入
- 测试账号不从生产环境获取，在测试环境预置
- 不依赖其他测试的执行顺序

## 测试脚本规范

### 命名
- spec 文件名 = `<功能>.spec.ts`（kebab-case），一个 spec 对应 `test-plan.md` 中一个功能模块的用例组
- test() 名称 = `[E2E-编号] 场景描述`（如 `[E2E-01] 正常登录成功后跳转首页`），与测试矩阵编号一一对应

### 结构
```ts
// testing/e2e/specs/login.spec.ts
import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { DashboardPage } from '../pages/dashboard.page'

test.describe('登录功能', () => {
  let loginPage: LoginPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    await loginPage.goto()
  })

  // 对应 test-plan.md E2E-01
  test('[E2E-01] 正常登录成功后跳转首页', async ({ page }) => {
    await loginPage.login('admin', 'Test@123')

    const dashboard = new DashboardPage(page)
    await expect(dashboard.welcomeHeading).toBeVisible()
    await expect(dashboard.welcomeHeading).toContainText('admin')
  })

  // 对应 test-plan.md E2E-02
  test('[E2E-02] 密码错误时显示错误提示', async ({ page }) => {
    await loginPage.login('admin', 'WrongPassword')

    await expect(loginPage.errorMsg).toBeVisible()
    await expect(loginPage.errorMsg).toContainText('密码错误')
    // 停留在登录页
    await expect(loginPage.submitBtn).toBeVisible()
  })
})
```

### 断言原则
- 断用户可见结果（页面跳转、UI 文本、元素可见性），不断网络请求内部细节
- Given → When → Then 与 `test-plan.md` 用例矩阵一致
- 一个 test() 对应一个用例矩阵行

## Playwright 配置

```ts
// testing/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './specs',
  timeout: 30000,
  expect: { timeout: 10000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'reports/html' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
```

**说明**：以上为模板配置，实际创建时根据项目 `CLAUDE.md` 和 `playwright.config.js` 调整 `baseURL`、`testDir` 等参数。

## 流程

1. **Read 输入文件**——读取 `production/staging/<name>/requirement.md` + `epic-story.md`（验收标准/边界/优先级）+ `openspec/changes/<name>/test-plan.md`，获取测试矩阵、data-id 前缀清单、测试数据需求
2. **探查前端结构**——用 Grep/Glob 确认组件中已有的 `data-id` 值，与 test-plan 中的前缀清单对齐；若发现缺失的 data-id，标记在 test-plan 中并通知 dev 补上
3. **搭建 E2E 目录**——按本 skill 定义的目录结构创建 `testing/e2e/`、`playwright.config.ts`、`fixtures/`、`pages/`、`specs/`、`utils/`
4. **先写 Page Object**——为 test-plan 中每个页面创建 Page Object（`pages/<page>.page.ts`），封装其 `data-id` locator 和业务 action
5. **按用例矩阵逐行写 spec**——按 test-plan 中的编号和优先级，一行矩阵 = 一个 `test()`，用 Page Object 组合 Given → When → Then
6. **实现 fixture/seed**——按 test-plan 的"测试数据需求"实现数据夹具和登录态夹具
7. **本地验证**——运行 `npx playwright test` 确认脚本语法正确、可执行（只验证不阻塞）。正式执行和失败分类由 `test-execution` skill 负责
8. **输出**——Playwright 脚本 + `npx playwright test` 运行结果全通过

## 关键原则

- **一行矩阵 = 一个 test()**——测试脚本是 `test-plan.md` 用例矩阵的可执行版本，编号一一对应。
- **Page Object 隔离变化**——未来 UI 改版只改 Page Object，不改 spec。Spec 只描述用户旅程，不碰 locator。
- **data-id 唯一锚点**——与单元测试用同一套 `data-id`，E2E 不创造新的定位方式。
- **可复跑性**——每个 spec 独立运行、不依赖执行顺序。fixture/seed 保证数据初始状态一致。
