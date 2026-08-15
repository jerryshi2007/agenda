---
name: req-brainstorming
description: 收到新功能或重大修改需求时使用——先探索上下文、逐一澄清、设计方案、用户审批，批准后才进入实现。禁止跳过设计直接写代码。
rules: [req-staging]
---

# req-brainstorming · 设计先行

**与 `req-analyst` agent 的关系**：brainstorming 负责发散（探索可能性、理解用户意图、设计方案），req-analyst agent 负责收敛（将确定方向执行结构化分析：GWT、优先级、边界异常）。brainstorming 产出方向性结论，交接给 req-analyst agent 继续处理。

## 硬 Gate

**用户未批准设计前，禁止调用任何实现 skill、禁止写代码。** 这适用于所有项目，无论看起来多简单。

## 流程

1. **探索项目上下文**——阅读 `production/requirements/` 中已有业务文档、`production/staging/` 中进行中的需求草稿。**不探索 `web/`、`api/` 等代码目录**——需求阶段聚焦业务上下文，代码细节留给下游研发阶段。
2. **逐一澄清**——每次只问一个问题，多选优先于开放式，聚焦目的/约束/成功标准
3. **提出 2-3 个方案**——每个方案说明权衡，给出推荐
4. **分节展示设计**——每节展示后询问用户"这个方向对吗？"
   - 用户角色与场景
   - 功能边界与范围
   - 核心业务流程
   - 边界与约束
5. **用户逐节审批**——有异议回到第 2 步
6. **汇总方向性结论**——整理已确认的用户角色、功能边界、核心场景、优先级判断，形成清晰的方向性结论
7. **自审**——检查结论中是否有矛盾、模糊、遗漏
8. **写入 staging 目录**——将方向性结论写入 `production/staging/YYYY-MM-DD-概要/brainstorming-conclusion.md`（staging 目录由 req-analyst 在 Step 0 创建，brainstorming 被调用时目录已存在）。写入内容包含：
   - 确定的用户角色及权限差异
   - 功能边界（做什么、不做什么）
   - 核心业务场景与流程
   - 优先级判断（哪些 Must、哪些 Should、哪些 Could）
   - 关键决策记录（为什么选这个方案、拒绝了哪些替代方案）
9. **用户审阅方向性结论**——批准后交接给 req-analyst agent 继续结构化分析

## 与 req-analyst 的交接边界

| 产出物 | 由谁产出 | 说明 |
|--------|---------|------|
| 用户角色定义 | brainstorming | 确定角色列表和权限差异 |
| 功能边界 | brainstorming | 确定做什么、不做什么 |
| 核心场景 | brainstorming | 确定主要业务流程 |
| 优先级方向 | brainstorming | 确定 Must/Should/Could 的大方向 |
| 用户故事 | req-analyst | 将场景细化为 GWT 格式用户故事 |
| 验收标准 | req-analyst | 为每个用户故事写 GWT 验收标准 |
| 边界异常覆盖 | req-analyst | 覆盖空值、越界、并发、失败回退 |
| requirement.md | req-analyst | 按 10 章结构写入完整需求文档 |
| Epic/Story 拆解 | req-analyst | 评估规模、拆解清单 |

**brainstorming 只产出方向性结论，不产出 requirement.md、不做 GWT 验收标准、不做 Epic/Story 拆解。** req-analyst 在 Gate 0 回到【方向明确】分支时，直接读取 `brainstorming-conclusion.md` 作为结构化分析的输入，不重新确认已有结论。

## 反模式

| 想法 | 现实 |
|------|------|
| "这太简单不需要设计" | 每个项目都要走这个过程，简单的设计可以短 |
| "我先探索代码库" | 先问清楚要做什么，再决定看什么 |
| "用户已经说清楚了" | 逐项确认，避免假设 |

## 关键原则

- **一次一个问题**——不要一次抛多个问题
- **多选优先**——比开放式更容易回答
- **YAGNI 无情**——从所有设计中移除不必要的功能
- **渐进确认**——每节设计展示后获取批准，不做一锤子买卖