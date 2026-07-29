# CLAUDE.md

家庭日程协作工具（agenda）—— 微信小程序，帮家长规划孩子日程、孩子查看执行。当前处于**产品规划阶段**，代码目录尚未开始编码。

## 目录导航

各目录有独立 CLAUDE.md，进入对应目录时按需加载：

| 目录 | 内容 | 说明 |
|------|------|------|
| [`api/`](api/CLAUDE.md) | 后端云函数 | 待开发 |
| [`app/`](app/CLAUDE.md) | 微信小程序前端 | 待开发 |
| [`testing/`](testing/CLAUDE.md) | E2E 测试 | 待开发 |
| [`production/`](production/CLAUDE.md) | 产品需求与原型 | 需求文档已就绪 |
| [`.claude/`](.claude/CLAUDE.md) | 三层编排系统（agent/skill/rule） | 工作流权威定义 |

## 工作流概览

agent 驱动的四阶段流水线，通过 OpenSpec 文件（git 共享）交接：

```
Stage 1 产品: req-analyst → req-reviewer → 人审批 → commit
Stage 2 研发: dev-architect → dev-architect-reviewer → 人审批 → dev-planning → dev-dotnet + dev-vue3 → commit
Stage 3 测试: test-planner → test-writer → test-reviewer → test-runner → 人审批
Stage 4 归档: openspec archive
```

完整编排规则、Gate 决策流程见 [`.claude/CLAUDE.md`](.claude/CLAUDE.md) 与 [`.claude/INDEX.md`](.claude/INDEX.md)。

## 提交前必读

创建 git 提交前，先 Read [`.claude/rules/git-commit.md`](.claude/rules/git-commit.md)。核心：动词开头、一事一提交、不直推 main。
