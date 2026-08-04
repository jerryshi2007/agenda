## 规则触发关系（每条 rule 由哪个 skill / agent 引用）

> **此表由 skill 和 agent frontmatter 的 `rules:` 字段推导。新增/修改 skill 或 agent 的 rule 引用时，需同步更新此表。**

| Rule | 引用它的 skill / agent |
|------|------------------------|
| req-spec | req-brainstorming, req-review, openspec-propose；agent: req-analyst, req-reviewer |
| openspec-workflow | openspec-propose, dev-planning, dev-finishing-branch, dev-code-review, dev-arch, dev-arch-review, openspec-archive-change；agent: dev-architect, dev-architect-reviewer |
| design-ui-standards | design-web, dev-vue3-tdd, dev-arch, dev-arch-review；agent: dev-architect, dev-architect-reviewer, dev-vue3 |
| dev-code-quality | dev-planning, dev-code-review, dev-refactoring, dev-dotnet-tdd, dev-vue3-tdd, dev-arch, dev-arch-review, openspec-apply-change；agent: dev-architect, dev-architect-reviewer, dev-planning, dev-dotnet, dev-vue3, dev-reviewer |
| dev-security | dev-debugging, dev-dotnet-tdd, dev-vue3-tdd, dev-code-review, dev-arch, dev-arch-review, openspec-apply-change；agent: dev-architect, dev-architect-reviewer, dev-planning, dev-dotnet, dev-reviewer |
| dev-dotnet-standards | dev-dotnet-tdd, dev-arch, dev-arch-review；agent: dev-architect, dev-architect-reviewer, dev-planning, dev-dotnet |
| dev-vue3-standards | dev-vue3-tdd, test-e2e-playwright, dev-arch, dev-arch-review；agent: dev-architect, dev-architect-reviewer, dev-planning, dev-vue3 |
| dev-refactor | dev-refactoring |
| test-standards | test-case-design, test-e2e-playwright, dev-dotnet-tdd, dev-vue3-tdd；agent: dev-dotnet, dev-vue3 |
| git-commit | （横切，CLAUDE.md 引用，主代理提交时遵循） |

> agent 可直接声明 rule（在 frontmatter `rules:` 中），也可通过 skill 间接获得。agent 通过决策流程（Gate 机制）控制 skill 调用——每个 agent 正文的「决策流程」章节定义了何时 Invoke skill、何时只 Read 作参考、哪些是强制 gate。新增 rule 须被至少一个 skill 或 agent 引用，否则是死规则。