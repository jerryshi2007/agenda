## 规则触发关系（每条 rule 由哪个 skill / agent 引用）

> **此表展示规则的完整传递闭包**——包含 skill 和 agent 在 frontmatter `rules:` 中的**直接声明**，以及 agent 通过 skill 获得的**间接引用**。新增/修改 skill 或 agent 的 rule 引用时，需同步更新此表。
>
> 区分方式：agent 在 frontmatter `rules:` 中直接声明 → 直接引用；agent 通过其调用的 skill 获得 → 间接引用。两者均在此表列出，因为 rule 变更会影响所有直接和间接引用方。

| Rule | Skill（直接声明） | Agent（直接 + 间接） |
|------|-------------------|---------------------|
| req-staging | req-brainstorming, req-review, openspec-propose, test-case-design, test-e2e-playwright, staging-archive | req-analyst, req-reviewer, test-planner, archiver |
| openspec-workflow | openspec-propose, arch-planning, dev-finishing-branch, dev-code-review, arch-design, arch-review, openspec-archive-change, dev-sdd | arch-architect, arch-architect-reviewer, archiver |
| design-ui-standards | design-web, dev-vue3-tdd, arch-design, arch-review | ui-designer |
| ui-miniapp-standards | design-miniapp, dev-miniapp-tdd | ui-designer |
| dev-code-quality | arch-planning, dev-code-review, dev-refactoring, dev-dotnet-tdd, dev-vue3-tdd, dev-miniapp-tdd, arch-design, arch-review, openspec-apply-change, dev-sdd | — |
| dev-contracts | arch-design, arch-review | arch-architect, arch-architect-reviewer, dev-dotnet, dev-miniapp, dev-vue3, test-writer |
| dev-security | dev-debugging, dev-dotnet-tdd, dev-vue3-tdd, dev-miniapp-tdd, dev-code-review, arch-design, arch-review, openspec-apply-change, dev-sdd | — |
| dev-dotnet-standards | dev-dotnet-tdd, arch-design, arch-review, arch-planning | dev-dotnet |
| dev-vue3-standards | dev-vue3-tdd, arch-design, arch-review, test-e2e-playwright | dev-vue3 |
| dev-miniapp-standards | dev-miniapp-tdd, arch-planning | dev-miniapp |
| dev-refactor | dev-refactoring | — |
| test-standards | test-case-design, test-e2e-playwright, dev-dotnet-tdd, dev-vue3-tdd, dev-miniapp-tdd | test-planner, test-reviewer, test-runner |
| git-commit | — | （横切，CLAUDE.md 引用，主代理提交时遵循） |

> **说明**：
> - **Skill 列**：仅列出在 frontmatter `rules:` 中直接声明该 rule 的 skill。
> - **Agent 列**：列出在 frontmatter `rules:` 中直接声明该 rule 的 agent。**不包含**通过 skill 间接获得 rule 的 agent——间接引用通过 skill 列已可追溯（agent → skill → rule）。
> - 例如 `dev-dotnet` agent 通过 `dev-dotnet-tdd` skill 间接获得 `test-standards`，但 `dev-dotnet` 不在 `test-standards` 行的 agent 列中——因为 `dev-dotnet-tdd` 已在 skill 列中，追溯链完整。
> - agent 也可在决策流程中动态 Read 未声明的 rule（如 `dev-reviewer` 按审查对象 Read 不同 rule），此类动态引用不在此表列出。
> - 新增 rule 须被至少一个 skill 或 agent 直接引用，否则是死规则。