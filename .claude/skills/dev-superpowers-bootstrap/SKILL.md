---
name: dev-superpowers-bootstrap
description: 每次会话启动时使用——建立 skill 优先原则，确保在任何操作前检查并调用对应 skill
---

# dev-superpowers-bootstrap · 守门人

## 铁律

**在任何响应或行动之前，先检查是否有适用的 skill。即使只有 1% 的可能，也必须调用。**

这不是可协商的。你不能合理化绕过它。

## Skill 优先级

多个 skill 适用时，流程 skill 优先于实现 skill：

- **非平凡需求变更** → 按阶段分派 agent（详见 CLAUDE.md 流水线）：`req-analyst → req-reviewer → 人审批 → dev-architect → dev-architect-reviewer → 人审批 → dev-planning → dev-dotnet + dev-vue3（并行）`
- **简单需求探索** → `req-brainstorming` 先，然后 `openspec-propose`
- **修这个 bug** → `dev-debugging` 先，定位根因后再实现
- **审查这段代码** → `dev-code-review`

## Red Flags 自检

以下想法意味着 STOP——你在合理化绕过：

| 想法 | 现实 |
|------|------|
| "这只是个简单问题" | 问题也是任务。检查 skill。 |
| "我需要先了解更多上下文" | skill 检查在澄清问题之前。 |
| "让我先探索代码库" | skill 告诉你如何探索。先检查。 |
| "这个 skill 太小题大做了" | 简单的事情会变复杂。用它。 |
| "我先做这一件小事" | 做事之前先检查。 |
| "我记得这个 skill 的内容" | skill 会演进。读当前版本。 |

## 全局纪律

以下纪律适用于所有 agent 和所有任务：

1. **验证后再说完成**（`dev-verification` skill）——无新鲜验证证据不做完成声明
2. **变更走 OpenSpec**（`openspec-workflow` rule）——非平凡变更先有 proposal
3. **TDD 铁律**（`dev-vue3-tdd` / `dev-dotnet-tdd` skill）——无失败测试无生产代码

## 用户指令优先

用户的直接指令（CLAUDE.md、AGENTS.md、直接要求）优先于 skill，skill 优先于默认行为。仅在用户明确告知时跳过 skill 流程。
