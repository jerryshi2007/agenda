# CLAUDE.md · 项目入口

本文件每次会话常驻加载。项目专属信息填在下方占位区；通用开发规范见三层结构（rules / skills / agents）。

## 三层结构与加载机制

本套配置采用**正交三层 + track 前缀**组织：

- **Rule（rules/）** = 约束/标准（"不能越界"）。**不自动挂载**，由 skill 在 frontmatter 声明 `rules: [...]`，被激活时显式 `Read` 对应 rule 文件。agent 不直接声明 rule，rule 通过 skill 间接获得。
- **Skill（skills/）** = 方法/流程（"怎么一步步做"）。按 description 触发或 `/skill` 调用，渐进披露。
- **Agent（agents/）** = 角色（"谁来做"）。主代理识别匹配任务时通过 Agent 工具调度，限定工具集。

三层正交：存储/扩展独立，运行时通过"引用"组合——agent 调 skill，skill 显式 Read 其声明的 rule。详见 `INDEX.md`。

## 快捷命令

[`commands/opsx/`](commands/opsx/) 提供 OpenSpec 快捷斜杠命令（`/opsx:explore`、`/opsx:propose`、`/opsx:apply`、`/opsx:archive`），映射到对应的 skill。

## 横切 rule

`rules/git-commit.md` 是横切规则（提交由主代理直接做，无专属 agent）。**创建 git 提交前，先 Read `rules/git-commit.md` 并遵守其约束。**

## 工具组合速查

完整 track × 层映射见 `INDEX.md`。

## 默认行为

- **非平凡需求 → 按阶段分派**——用户提出非平凡功能需求或变更请求时，主代理根据当前阶段分派对应 agent。产品、研发、测试各自使用 Claude Code，通过 OpenSpec 文件（git 仓库共享）完成阶段交接：
  ```
  Stage 1 产品: req-analyst → req-reviewer → 人审批 → git commit
  Stage 2 研发: git pull → dev-architect → dev-architect-reviewer → 人审批 → dev-planning → dev-dotnet + dev-vue3 (并行) → git commit
  Stage 3 测试: git pull → test-planner → test-writer → test-reviewer → test-runner → 人审批
  Stage 4 归档: openspec archive（任何人）
  ```
  详细流程见 `pm-workflow.md`（流水线参考文档）。
- **agent 内含决策流程（Gate 机制）**——每个 agent 正文包含「决策流程」章节，定义入口评估 → 条件分支 → skill 调用规则。关键 gate：
  - **req-analyst**：Gate 0「需求完整度评估」→ 模糊走 brainstorming / 方向明确走 analysis / 完整走 openspec 过程管理。**brainstorming 未批准前禁止创建 OpenSpec change。**
  - **dev-architect**：Gate 0「变更规模评估」→ 纯单模块小改动跳过架构设计；非平凡变更走 arch-review。**划分原则（项目/命名空间/数据库）必须用 AskUserQuestion 确认后才能进入设计。**
  - **dev-dotnet / dev-vue3**：Gate 0「任务规模评估」→ task ≤2 且每 task ≤3 文件走轻量 openspec-apply-change；task >2 或有大 task 走 SDD（dev-sdd skill）。**SDD 完成后必须走收尾链（dev-verification → dev-code-review → dev-finishing-branch），跳步 = 未完成。**
  - **ui-designer**：Gate 0「需求清晰度评估」→ 需求模糊需澄清或走 req-analyst；Gate 1「需求分解 → 原型任务拆分」→ 按页面/状态/角色拆分独立任务；Gate 2「风格选型」→ 用户未选定 Element Plus / Ant Design / 项目标准风格前禁止开始设计。**仅做原型，不做生产代码实现。**
  - **test-runner**：Gate 0「环境就绪检查」→ 被测应用/浏览器/seed 任一未就绪禁止执行。
- **需求/架构/计划/测试阶段**的 agent（req-analyst、req-reviewer、dev-architect、dev-architect-reviewer、dev-planning、test-planner、test-writer、test-reviewer、test-runner）端到端执行，含 openspec CLI 操作（自己跑 `openspec new/status/instructions/archive` 等命令）。**skill 调用由 agent 决策流程的 gate 控制，不自由裁量。**
- **dev-dotnet / dev-vue3** 各自编排各自技术栈的 SDD（dev-sdd + dev-verification），可 dispatch 子代理实现、dispatch dev-reviewer 审查。
- **bug / 测试失败 / 异常**，由当前 agent（dev-dotnet / dev-vue3）直接调用 `dev-debugging` skill 系统化定位根因，不经过已删除的 dev-debugger agent。不要直接猜改。
- **重构**，由当前 agent 直接调用 `dev-refactoring` skill，不经过已删除的 dev-refactorer agent。
- **改动前先查复用点**（详见 `rules/dev-code-quality.md` 复用优先约束）——搜索现有函数/组件，能复用就不新写。
- 需要专门角色时，派对应 agent；agent 通过 skill 间接获得 rule 约束。
