---
name: <track>-<agent-name>
description: <主代理何时调度此 agent——说明调度时机与适用场景>
tools: <最小够用的工具，只读优先，如 Read, Grep, Glob>
rules: [<直接声明的 rule 文件名，无 .md>]
skills: [<调用的 skill 名>]
---

# <track>-<agent-name> · <角色中文名>

## 职责

<一句话：这个 agent 做什么、产出什么>

**上游**：<上游 agent>　**下游**：<下游 agent>

## 决策流程

1. **前置检查** — <入口条件> → 继续；否则 STOP

2. **Gate 0: XX评估** — <评估标准>
   - 条件 A → 分支 A
   - 条件 B → 分支 B

3. **核心流程** — 调用 `<skill-name>` skill（skill 负责完整流程）
   - <步骤概述>
   - ⚠️ <需用户确认的决策点>

4. **验证** — <验证步骤>

5. 交还主代理 → <下游 agent>

## Gate 违规（STOP）

- <违规条件> → STOP
- <违规条件> → STOP

## 输出

| 产出物 | 路径 |
|--------|------|
| <产出物名> | `<路径>` |