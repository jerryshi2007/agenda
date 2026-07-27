---
name: req-brainstorming
description: 收到新功能或重大修改需求时使用——先探索上下文、逐一澄清、设计方案、用户审批，批准后才进入实现。禁止跳过设计直接写代码。
rules: [req-spec, openspec-workflow]
---

# req-brainstorming · 设计先行

**与 `req-analysis` 的关系**：brainstorming 负责发散（探索可能性、理解用户意图、设计方案），analysis 负责收敛（将确定方向梳理为结构化需求规格）。brainstorming 产出方向性结论，交接给 analysis 写 spec。

## 硬 Gate

**用户未批准设计前，禁止调用任何实现 skill、禁止写代码、禁止创建 OpenSpec change。** 这适用于所有项目，无论看起来多简单。

## 流程

1. **探索项目上下文**——检查 `openspec/specs/` 中相关 spec、现有代码、最近提交
2. **逐一澄清**——每次只问一个问题，多选优先于开放式，聚焦目的/约束/成功标准
3. **提出 2-3 个方案**——每个方案说明权衡，给出推荐
4. **分节展示设计**——每节展示后询问用户"这个方向对吗？"
   - 整体架构
   - 数据/接口
   - 流程/交互
   - 错误处理
   - 测试策略
5. **用户逐节审批**——有异议回到第 2 步
6. **写设计文档**——设计结论写入 `openspec/changes/<name>/design.md`
7. **自审**——检查占位符、矛盾、模糊、范围
8. **用户审阅设计文档**——批准后交接给 `openspec-propose`

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

## 交接

设计文档写入 `openspec/changes/<name>/design.md` 并经用户审批后：
- 调用 `openspec-propose` skill 创建 OpenSpec change（proposal + delta specs + tasks）
- 然后调用 `dev-planning` skill 拆解 bite-sized tasks
