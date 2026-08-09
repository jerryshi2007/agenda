# CLAUDE.md

家庭日程协作工具（agenda）—— 微信小程序，帮家长规划孩子日程、孩子查看执行。当前处于**产品规划阶段（Stage 1）**，代码目录尚未开始编码。日程管理模块需求已完成，其余模块（认证、家庭、模板、打卡统计、孩子展示模式）待创建。

## 技术约束速查

- **平台**：微信小程序（基础库 ≥ 2.10.0），iOS 12+ / Android 8.0+
- **性能底线**：首屏 ≤ 2s，视图切换 ≤ 500ms，打卡响应 ≤ 1s
- **账户模型**：个人账户 + 家庭绑定，数据按家庭隔离
- **日程模型**：三种类型（课后活动/日常作息/作业任务），时间槽按星期几独立配置
- **孩子端**：三种展示模式（学龄前/小学/高年级），第一期不区分，统一视图
- **关键流程**：创建日程 ≤ 3 步，所有 API 需微信登录态，敏感操作二次确认

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
Stage 2 研发: dev-architect → dev-architect-reviewer → 人审批 → dev-dotnet + dev-miniapp → commit
Stage 3 测试: test-planner → test-writer → test-reviewer → test-runner → 人审批
Stage 4 归档: openspec archive
```

完整编排规则、Gate 决策流程见 [`.claude/CLAUDE.md`](.claude/CLAUDE.md) 与 [`.claude/INDEX.md`](.claude/INDEX.md)。

## 提交前必读

创建 git 提交前，先 Read [`.claude/rules/git-commit.md`](.claude/rules/git-commit.md)。核心：动词开头、一事一提交、不直推 main。
