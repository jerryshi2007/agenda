# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 三层结构与加载机制

本套配置采用**正交三层 + track 前缀**组织：

- **Rule（rules/）** = 约束/标准（"不能越界"）。**不自动挂载**，由 skill 或 agent 在 frontmatter 声明 `rules: [...]`，被激活时显式 `Read` 对应 rule 文件。rule 可通过 skill 间接获得，也可由 agent 直接声明。
- **Skill（skills/）** = 方法/流程（"怎么一步步做"）。按 description 触发或 `/skill` 调用，渐进披露。
- **Agent（agents/）** = 角色（"谁来做"）。主代理识别匹配任务时通过 Agent 工具调度，限定工具集。

三层正交：存储/扩展独立，运行时通过"引用"组合——agent 调 skill，skill 显式 Read 其声明的 rule。详见 `INDEX.md`。

## 主代理职责

主代理是流水线的编排者，负责按 SDLC 阶段顺序调度各 agent，不直接执行具体阶段任务。职责包括：

- **阶段调度**：按 Stage 1→2→3→4→5 顺序，根据任务类型匹配并 dispatch 对应 agent
- **Gate 管理**：各阶段审批 gate 分别对应 staging STATUS.md 和 OpenSpec 的状态节点，任一 gate 未通过，禁止进入下一阶段
- **git 提交**：按 `git-commit` rule 创建提交，agent 产出的文档和代码由主代理统一提交
- **状态追踪**：在 staging STATUS.md 和 OpenSpec 间维护一致性
- **异常处理**：agent 返回 BLOCKED 或失败时，决策重试/升级/回退

## 横切 rule

`rules/git-commit.md` 是横切规则（提交由主代理直接做，无专属 agent）。**创建 git 提交前，先 Read `rules/git-commit.md` 并遵守其约束。**

## 工具组合速查

> Rule 归属统一由 [`INDEX.md`](.claude/INDEX.md) 管理（rule → skill/agent 反向表）。本表只列 Agent + Skill 的正向调度关系。

### 产品 track

| 阶段 | Agent | Skill |
|------|-------|-------|
| 需求分析 | req-analyst | req-brainstorming |
| 需求审核 | req-reviewer | req-review |
| 原型设计 | ui-designer | design-web（Web）/ design-miniapp（小程序） |

### 设计 track

| 子 track | Agent | Skill |
|----------|-------|-------|
| 架构设计 | arch-architect | arch-design, arch-planning, openspec-propose |
| 架构审核 | arch-architect-reviewer | arch-review |

### 研发 track

| 子 track | Agent | Skill |
|----------|-------|-------|
| .NET 后端 | dev-dotnet | dev-dotnet-tdd, dev-sdd, dev-verification |
| Vue 3 Web 应用前端 | dev-vue3 | dev-vue3-tdd, dev-sdd, dev-verification |
| 小程序前端 | dev-miniapp | dev-miniapp-tdd, dev-sdd, dev-verification |
| 代码审查 | dev-reviewer | dev-code-review |

### 测试 track

| 阶段 | Agent | Skill | 适用 |
|------|-------|-------|------|
| 测试策划 | test-planner | test-case-design | Web / 小程序 |
| 脚本编写（Web） | test-writer | test-e2e-playwright | 仅 Web |
| 脚本编写（小程序） | dev-dotnet + dev-miniapp | dev-dotnet-tdd, dev-miniapp-tdd | 仅小程序 |
| 测试审查 | test-reviewer | test-case-design | Web / 小程序 |
| 测试执行（Web） | test-runner | test-execution, dev-verification | 仅 Web |
| 测试执行（小程序） | 主代理直接执行 | — | 仅小程序 |

> **Stage 4 分支逻辑**：主代理先判断项目类型。Web 应用走 `test-planner → test-writer → test-reviewer → test-runner → 人审批`。小程序走 `test-planner → 已有测试评估 → 按需补充后端(dev-dotnet)/前端(dev-miniapp) → test-reviewer → 主代理执行测试并生成报告 → 人审批`。主代理进入 Stage 4 前 MUST 先 Glob 扫描已有测试文件，将结论写入 test-planner 提示词。

### 横切

| 关注点 | Skill |
|--------|-------|
| 调试 | dev-debugging |
| 重构 | dev-refactoring |
| 收尾 | dev-finishing-branch |
| 归档 | openspec-archive-change, staging-archive（由 archiver agent 编排） |
| Git 提交 | —（见 `rules/git-commit.md`） |
