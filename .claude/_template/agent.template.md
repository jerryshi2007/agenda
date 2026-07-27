---
name: <track>-<agent-name>
description: <主代理何时调度此 agent——只说明调度时机与适用场景；skill 与 rule 不在此重复，分别见"可用 Skill"章节与 skill frontmatter rules>
tools: <最小够用的工具，逗号分隔；只读优先，如 Read, Grep, Glob>
---

# <track>-<agent-name> · <角色中文名>

## 职责
<一句话：这个 agent 做什么、产出什么>

## 何时被调度
- <场景 1>
- <场景 2>

## 可用 Skill
- `<skill-name>`：<该 skill 提供什么流程/方法，本 agent 如何用>
- 无专属 skill 时注明：需补测试时派 test-writer（或其他协作 agent）。

## 工作方式
1. **遵循可用 Skill 的流程**：<概述如何执行>
2. <工具使用约定，如只读 / 跑测试 / 探查复用>
3. ...

## 输出
<产出物：格式 + 必含字段>
