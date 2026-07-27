---
name: req-analysis
description: 收到需求或模糊任务时使用——澄清需求、描述功能、拆用户故事、定验收标准、识别边界与异常、排优先级，产出结构化需求文档。
rules: [req-spec, openspec-workflow]
---

# req-analysis · 需求分析

## 在流程中的位置

`req-brainstorming`（设计约定）→ **req-analysis**（结构化文档）→ `openspec-propose`（创建 OpenSpec change）

## 何时使用
- 用户给出模糊/原始需求，需要梳理成可执行规格时
- 评审已有需求文档，检查是否可验证、是否覆盖边界时
- brainstorming 设计获批后，需要产出结构化 OpenSpec 文档时

**与 `req-brainstorming` 的关系**：如用户需求方向不清，先走 brainstorming 发散探索。待方向确定后，analysis 将需求梳理为可执行规格（delta specs + proposal）。brainstorming = 发散（what/why），analysis = 收敛（how to specify）。

## 流程
1. **先 Read `rules/req-spec.md` 和 `rules/openspec-workflow.md` 并严格遵守其约束。**
2. **澄清模糊**——列出需求中的模糊词（"快""友好""安全"），逐个量化为可测指标或标记为待澄清问题。
3. **描述功能**——
   - 先描述**业务流程**——梳理端到端的业务全流程，说明角色在流程中的参与节点和数据流转路径。
   - 再描述**业务功能**——基于流程，逐一说明每个功能节点"做什么、谁来做、输入/输出是什么"。
4. **拆分用户故事并配验收标准**——用户故事与验收标准一一绑定，以 Given-When-Then 形式描述（正常路径 + 异常路径）。
5. **识别边界与异常**——空值、越界、并发、失败回退、权限不足等场景显式列出。
6. **排优先级**——Must / Should / Could 分级。
7. **产出 OpenSpec 文档**——
   - Delta specs **内容**：以 ADDED/MODIFIED/REMOVED 标记变更类型，写入 `openspec/changes/<name>/specs/`
   - Proposal **内容**：变更动机、范围、方法，写入 `openspec/changes/<name>/proposal.md`
   - 需求真相源：`openspec/specs/<domain>/spec.md`（archive 后更新）
   - 如果 change 目录尚未创建（由 `openspec-propose` 负责脚手架），需先运行 `openspec new change <name>`
8. **变更留痕**——若修改已有需求，记录原因/时间/影响。

## 关键原则
- 需求不可验证就不是需求，是愿望。
- 只写正常流程的需求是半成品——边界异常同等重要。
- 有疑义宁可停下来澄清，不要假设后往下做。
- 故事与验收标准一一绑定——没有验收标准的故事不可交付。
