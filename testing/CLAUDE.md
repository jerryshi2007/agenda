# testing/ · E2E 测试

关键用户流程的端到端测试。首期覆盖：微信登录、家庭创建与成员管理、日程 CRUD、日历视图切换、打卡确认。

> **状态**：待开发。由 Stage 3 测试流水线产出，本文件届时补充测试运行命令。

## 测试流水线

```
test-planner → test-writer → test-reviewer → test-runner → 人审批
```

- `test-planner`：调用 `test-case-design` skill 产出 test-plan.md
- `test-writer`：调用 `test-e2e-playwright` skill，**Page Object 先于 spec 创建，locator 只用 `data-id`**
- `test-runner`：Gate 0 环境就绪检查（应用/浏览器/seed 就绪才执行）→ 结构化报告 + 失败分类

## 编码约束

- [`../.claude/rules/test-standards.md`](../.claude/rules/test-standards.md) — 与源码同结构放置、命名表意图、测行为不测实现、必有失败路径、**稳定标识符定位**（`data-id`，禁止 CSS 类名/DOM 索引/文本定位）

定位契约与前端 `data-id` 规范一致，见 [`../.claude/rules/dev-vue3-standards.md`](../.claude/rules/dev-vue3-standards.md) 可测试性章节。