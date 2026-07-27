# INDEX.md · SDLC 工具组合速查

按软件开发阶段（track）× 三层（rule / skill / agent）组织的速查表。要做某阶段的事，查此表组合对应工具。

## 速查表

| Track | Rule（约束） | Skill（方法） | Agent（角色） |
|---|---|---|---|
| 需求 `req-` | [req-spec](rules/req-spec.md), [openspec-workflow](rules/openspec-workflow.md) | [req-brainstorming](skills/req-brainstorming/SKILL.md), [req-analysis](skills/req-analysis/SKILL.md), [req-review](skills/req-review/SKILL.md), [openspec-propose](skills/openspec-propose/SKILL.md), [openspec-explore](skills/openspec-explore/SKILL.md) | [req-analyst](agents/req-analyst.md), [req-reviewer](agents/req-reviewer.md) |
| 架构 `arch-` | （复用 dev- rules） | [arch-review](skills/arch-review/SKILL.md), [arch-review-check](skills/arch-review-check/SKILL.md) | [dev-architect](agents/dev-architect.md), [dev-architect-reviewer](agents/dev-architect-reviewer.md) |
| 设计 `design-` | [design-ui-standards](rules/design-ui-standards.md) | [design-web](skills/design-web/SKILL.md) | [ui-designer](agents/ui-designer.md) |
| 研发 `dev-` | [dev-code-quality](rules/dev-code-quality.md), [dev-security](rules/dev-security.md), [dev-refactor](rules/dev-refactor.md), [dev-dotnet-standards](rules/dev-dotnet-standards.md), [dev-vue3-standards](rules/dev-vue3-standards.md) | [dev-superpowers-bootstrap](skills/dev-superpowers-bootstrap/SKILL.md), [dev-planning](skills/dev-planning/SKILL.md), [dev-sdd](skills/dev-sdd/SKILL.md), [dev-code-review](skills/dev-code-review/SKILL.md), [dev-debugging](skills/dev-debugging/SKILL.md), [dev-refactoring](skills/dev-refactoring/SKILL.md), [dev-verification](skills/dev-verification/SKILL.md), [dev-finishing-branch](skills/dev-finishing-branch/SKILL.md), [dev-dotnet-tdd](skills/dev-dotnet-tdd/SKILL.md), [dev-vue3-tdd](skills/dev-vue3-tdd/SKILL.md), [openspec-apply-change](skills/openspec-apply-change/SKILL.md), [openspec-archive-change](skills/openspec-archive-change/SKILL.md) | [dev-planning](agents/dev-planning.md), [dev-reviewer](agents/dev-reviewer.md), [dev-dotnet](agents/dev-dotnet.md), [dev-vue3](agents/dev-vue3.md) |
| 测试 `test-` | [test-standards](rules/test-standards.md) | [test-case-design](skills/test-case-design/SKILL.md), [test-e2e-playwright](skills/test-e2e-playwright/SKILL.md), [test-execution](skills/test-execution/SKILL.md) | [test-planner](agents/test-planner.md), [test-writer](agents/test-writer.md), [test-runner](agents/test-runner.md), [test-reviewer](agents/test-reviewer.md) |
| 横切 `git-` | [git-commit](rules/git-commit.md) | [openspec-archive-change](skills/openspec-archive-change/SKILL.md) | — |

## 各 track 典型组合

> **编排模式：agent 内含决策流程（Gate 机制）**。agent 自主评估输入 → 条件分支 → 决定调用哪个 skill、跳过哪个阶段。每个 agent 正文的「决策流程」章节定义了完整的 gate 逻辑。以下是各 track 主要路径速查：

- **需求·评估+分流**：派 `req-analyst` → Gate 0「需求完整度评估」→ 模糊走 `req-brainstorming` / 方向明确走 `req-analysis` / 完整走 `openspec-propose`。**brainstorming 未批准前禁止创建 OpenSpec change。**
- **需求·审核**：派 `req-reviewer` → 前置检查 proposal+delta specs → 调用 `req-review` skill（强制）→ review.md → 三判决 → 人审批
- **架构·评估+设计**：派 `dev-architect` → Gate 0「变更规模评估」→ 纯单模块小改动跳过 / 非平凡变更走 `arch-review`。**划分原则未确认前禁止进入设计。**
- **架构·审核**：派 `dev-architect-reviewer` → 前置检查 design.md → 调用 `arch-review-check` skill（强制）→ design-review.md → 三判决 → 人审批 → 交接 dev-planning
- **研发·计划**：派 `dev-planning` → 前置检查 design.md → 调用 `dev-planning` skill（强制）→ tasks.md（含骨架复用判断）
- **研发·SDD 执行（.NET）**：派 `dev-dotnet` → Gate 0「任务规模评估」→ 轻量走 `openspec-apply-change` / SDD 走 `dev-sdd`（逐 task 调用 `dev-dotnet-tdd` + dispatch dev-reviewer）。**SDD 完成后必须走收尾链。**
- **研发·SDD 执行（Vue 3）**：派 `dev-vue3` → Gate 0「任务规模评估」→ 轻量走 `openspec-apply-change` / SDD 走 `dev-sdd`（逐 task 调用 `dev-vue3-tdd` + dispatch dev-reviewer）。**SDD 完成后必须走收尾链。**
- **研发·审查**：派 `dev-reviewer` → 前置检查 diff → 调用 `dev-code-review` skill（强制）→ 双判决。只读不改代码。
- **研发·调试**：由当前 agent 直接调用 `dev-debugging` skill，四阶段法修根因
- **研发·重构**：由当前 agent 直接调用 `dev-refactoring` skill，小步重构+每步跑测试
- **研发·收尾**：研发人员执行（编码+测试完成后）→ `dev-finishing-branch` skill → openspec status 确认 → 清理遗留 → git commit
- **归档**：任何人执行（E2E 人审批通过后）→ `openspec-archive-change` skill → openspec archive
- **测试·策划**：派 `test-planner` → 前置检查输入材料 → 调用 `test-case-design` skill（强制）→ test-plan.md
- **测试·写（E2E）**：派 `test-writer` → 前置检查 test-plan.md → 调用 `test-e2e-playwright` skill（强制）→ **Page Object 必须先于 spec 创建，locator 只用 data-id**
- **测试·审查**：派 `test-reviewer` → 前置检查测试文件 → 调用 `test-case-design` skill（反向审查）→ 质量报告。只读不改测试。
- **测试·执行**：派 `test-runner` → Gate 0「环境就绪检查」→ 调用 `test-execution` skill（强制）→ 结构化测试报告 + 失败分类
- **提交**：主代理直接做，先 Read `git-commit` rule

## 规则触发关系（每条 rule 由哪个 skill 引用）

> **此表由 skill frontmatter 的 `rules:` 字段推导。新增/修改 skill 的 rule 引用时，需同步更新此表。**

| Rule | 引用它的 skill |
|---|---|
| req-spec | req-analysis, req-brainstorming, req-review |
| openspec-workflow | req-brainstorming, req-analysis, req-review, dev-planning, dev-finishing-branch, dev-code-review, arch-review, arch-review-check |
| design-ui-standards | design-web, dev-vue3-tdd, arch-review, arch-review-check |
| dev-code-quality | dev-planning, dev-code-review, dev-refactoring, dev-dotnet-tdd, dev-vue3-tdd, arch-review, arch-review-check |
| dev-security | dev-debugging, dev-dotnet-tdd, dev-code-review, arch-review, arch-review-check |
| dev-dotnet-standards | dev-dotnet-tdd, arch-review, arch-review-check |
| dev-vue3-standards | dev-vue3-tdd, test-e2e-playwright, arch-review, arch-review-check |
| dev-refactor | dev-refactoring |
| test-standards | test-case-design, test-e2e-playwright, dev-dotnet-tdd, dev-vue3-tdd |
| git-commit | （横切，CLAUDE.md 引用，主代理提交时遵循） |

> agent 不直接声明 rule，rule 通过 skill 间接获得。agent 通过决策流程（Gate 机制）控制 skill 调用——每个 agent 正文的「决策流程」章节定义了何时 Invoke skill、何时只 Read 作参考、哪些是强制 gate。新增 rule 须被至少一个 skill 引用，否则是死规则。
