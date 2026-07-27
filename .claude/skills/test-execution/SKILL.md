---
name: test-execution
description: 执行 E2E 测试脚本并生成结构化报告时使用——Playwright CLI、多浏览器矩阵、失败分类、重试策略。
---

# test-execution · E2E 测试执行与报告

## 何时使用
- 需要执行 E2E 测试套件并生成结构化报告时
- 需要按标签/浏览器/优先级筛选执行时
- CI 流程中需要汇总多浏览器测试结果时
- 需要分析失败模式（真实 bug vs 环境问题 vs 脚本错误）时

## 前置条件
- E2E 测试脚本已存在于 `testing/e2e/specs/` 下（由 `test-writer` 产出）
- Playwright 已配置（`testing/e2e/playwright.config.ts`）
- 被测应用已启动（`pnpm dev` 或对应启动命令）

## 执行命令

### 基础命令

| 场景 | 命令 |
|------|------|
| 全量执行（全部浏览器） | `cd testing && npx playwright test --config e2e/playwright.config.ts` |
| 单浏览器 | `cd testing && npx playwright test --config e2e/playwright.config.ts --project=chromium` |
| 按标签筛选（smoke） | `cd testing && npx playwright test --config e2e/playwright.config.ts --grep "@smoke"` |
| 按标签筛选（regression） | `cd testing && npx playwright test --config e2e/playwright.config.ts --grep "@regression"` |
| 单文件 | `cd testing && npx playwright test --config e2e/playwright.config.ts e2e/specs/login.spec.ts` |
| 失败重跑 | `cd testing && npx playwright test --config e2e/playwright.config.ts --last-failed` |
| 生成 HTML 报告 | `cd testing && npx playwright show-report e2e/reports/html` |

### 标签约定

测试脚本中用 Playwright test tags 标记：
- `@smoke` — 冒烟测试（核心路径，每次提交必跑）
- `@regression` — 回归测试（已知 bug 修复验证）
- `@slow` — 慢速测试（涉及多步流程）
- `@p0` / `@p1` / `@p2` — 与 `test-plan.md` 优先级对齐

```ts
test('[E2E-01] 正常登录成功后跳转首页 @smoke @p0', async ({ page }) => {
  // ...
})
```

## 报告格式

### 摘要（必需字段）

```markdown
## E2E 测试执行报告

**执行时间**：2026-07-08 14:30:00
**总耗时**：2 分 34 秒
**被测地址**：http://localhost:5173

### 总览

| 浏览器 | 通过 | 失败 | 跳过 | 总计 | 通过率 |
|--------|------|------|------|------|--------|
| Chromium | 42 | 1 | 2 | 45 | 97.8% |
| Firefox | 43 | 0 | 2 | 45 | 100% |
| WebKit | 41 | 2 | 2 | 45 | 95.3% |
| **汇总** | **126** | **3** | **6** | **135** | **97.8%** |
```

### 失败明细（每用例）

```markdown
### 失败明细

#### ❌ E2E-07 · 删除用户后列表刷新 — Chromium
- **原因分类**：环境问题
- **错误信息**：`TimeoutError: page.waitForResponse: Timeout 5000ms exceeded`
- **截图**：`testing/e2e/reports/html/data/xxx.png`
- **追踪**：`testing/e2e/test-results/xxx/trace.zip`
- **建议**：后端删除接口响应超过 5s，检查数据库索引或增加等待超时

#### ❌ E2E-15 · 权限不足时隐藏编辑按钮 — WebKit
- **原因分类**：真实 bug
- **错误信息**：`Error: expect(locator).toBeHidden() failed — locator('[data-id="user-list-edit-btn-42"]') is visible`
- **截图**：`testing/e2e/reports/html/data/xxx.png`
- **建议**：前端权限判断逻辑有误，WebKit 下 `role` 判断条件命中 bug
```

### 分类规则

| 分类 | 判定标准 | 处理方式 |
|------|----------|----------|
| **真实 bug** | 行为与 spec 不符，可稳定复现 | 提交 bug 报告，关联 E2E 编号 |
| **环境问题** | 超时/网络错误/后端未启动/数据未 seed | 检查环境后重跑 |
| **脚本错误** | locator 找不到元素（data-id 变更）、断言写错 | 修复脚本后重跑 |
| **flaky** | 同一用例同一浏览器间歇性通过/失败 | 标记为 flaky，提 issue 单独治理 |

## 重试策略

- **本地开发**：`retries: 0`，立即看到失败，不隐藏 flaky
- **CI 环境**：`retries: 2`，自动重试减少环境噪声
- **Flaky 检测阈值**：同一用例在 3 次独立运行中至少 2 次失败 → 真实失败；其余为 flaky，不阻塞 CI 但记录到报告
- **重试后仍失败的用例**：按失败分类规则归类到真实 bug / 环境问题 / 脚本错误

## 多浏览器矩阵汇总

当执行全部浏览器后，生成交叉矩阵：

```markdown
### 浏览器兼容性矩阵

| 编号 | 场景 | Chromium | Firefox | WebKit |
|------|------|:---:|:---:|:---:|
| E2E-01 | 正常登录 | ✅ | ✅ | ✅ |
| E2E-02 | 密码错误 | ✅ | ✅ | ✅ |
| E2E-07 | 删除用户后列表刷新 | ❌ | ✅ | ✅ |
| E2E-15 | 权限不足隐藏编辑按钮 | ✅ | ✅ | ❌ |

浏览器特有失败：
- **Chromium only**：E2E-07（后端超时）
- **WebKit only**：E2E-15（权限判断 bug）
```

## 流程

1. **确认环境就绪**
   - 被测应用已启动（`pnpm dev` 或 `dotnet run` 运行中）
   - 种子上一次运行已完成（如有 seed 脚本）
   - 浏览器已安装（`npx playwright install --with-deps`）
2. **执行测试**
   - 默认跑全部浏览器全量用例
   - 可按参数筛选（`--project` / `--grep` / 单文件）
3. **收集产物**
   - 读取 `testing/e2e/reports/results.json` 获取结构化结果
   - 收集失败用例截图和 trace 路径
4. **分类失败**
   - 按分类规则判定每个失败的真实原因
   - 标记 flaky 用例（间歇性失败）
5. **生成报告**
   - 含摘要总览表 + 失败明细 + 浏览器兼容性矩阵
   - 输出到 `testing/e2e/reports/test-report.md`

## 报告输出位置

- **可读报告**：`testing/e2e/reports/test-report.md`
- **原始数据**：`testing/e2e/reports/results.json`（Playwright 原生 JSON reporter）
- **HTML 报告**：`testing/e2e/reports/html/`（`npx playwright show-report` 可视化）
- **截图/Trace**：`testing/e2e/test-results/`（Playwright 默认输出目录）
