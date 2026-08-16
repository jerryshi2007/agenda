---
name: arch-review
description: 审核 design.md——按 11 维度查需求覆盖、ER 可反推、时序完整、ADR 充分、规则合规、现状对账。只读不改。
rules: [dev-dotnet-standards, dev-vue3-standards, design-ui-standards, dev-code-quality, dev-security, openspec-workflow, dev-contracts, dev-codegraph]
---

# arch-review · 架构设计审核

## 何时使用

arch-architect 产出 design.md 后。跳过：纯单模块小改动、纯 UI 调整、纯 bug 修复。

## 流程

### 1. Read 规则（8 条）
dev-dotnet-standards / dev-vue3-standards / design-ui-standards / dev-code-quality / dev-security / openspec-workflow / dev-contracts / dev-codegraph

### 2. 理解输入
读 proposal.md + delta specs → 搞清楚变更要解决什么问题

### 3. 理解设计
读 design.md → 逐节理解设计如何回应需求

### 4. 按 11 维度扫描

| # | 维度 | 检查内容 | 严重度 |
|---|------|---------|--------|
| 1 | 需求覆盖 | 每个 Requirement 在 design.md 中有对应实体/API/时序？ | 阻塞 |
| 2 | ER 关系可反推 | 每个关系基数能从 spec scenario 反推？无"凭空设计"的关系？ | 阻塞 |
| 3 | 时序完整 | 正常路径 + 异常/边界分支？鉴权链路多级拒绝有说明？认证流整链路？ | 阻塞 |
| 4 | ADR 充分 | 至少 4 类决策（认证/分层/UI框架/状态管理）有 ADR？含 Context/Decision/Consequences/Alternatives？ | 阻塞 |
| 5 | 规则合规 | 设计是否违反 6 条 rule？（如 .NET 同步阻塞异步、前端不用 data-id、硬编码密钥） | 阻塞 |
| 6 | 质量底线 | 无 TBD/TODO？无重复造轮子？Risks 识别了关键风险？ | 阻塞 |
| 7 | 限界上下文合理 | 聚合边界正确？聚合根识别正确？跨上下文交互规则明确？ | 建议 |
| 8 | API 契约完整 | 端点覆盖所有 scenario？DTO 与前端对齐？错误码明确？分页标准化？**contracts/ 下 enums.json / errors.json / dto.json 齐全且与 design.md 一致？** | 阻塞 |
| 9 | 前端架构对齐 | 路由表完整？状态管理合理？与 UI 框架对齐？ | 建议 |
| 10 | 构建序列可行 | 按依赖正确排序？无循环依赖？前后端集成 task 时机合理？ | 建议 |
| 11 | 现状对账完整 | design.md 含现状对账清单？已用 codegraph 探查已有代码并标注复用/扩展/新建？复用已有实体（User/Schedule 等）的字段增删与状态迁移显式声明？ | 阻塞 |

### 5. 列发现 → 逐条验证 → 按严重度排序
- 阻塞：审批前必须修复（需求未覆盖、ER 无 spec 依据、时序缺异常、ADR 缺失、规则违规、有 TBD）
- 建议：审批前建议关注（上下文数量不当、API 细节不完整、路由表缺权限标注）
- 疑问：需审批人确认（如"这个分层策略是否正确？"）

### 6. 给审批建议
用 AskUserQuestion 追问阻塞和疑问项 → 三判决：
- 设计质量：✅ 合格 / ⚠️ 有保留 / ❌ 不合格
- 规则合规：✅ 合规 / ❌ 存在违规
- 审批建议：✅ 建议批准 / ⚠️ 建议有条件批准 / ❌ 建议驳回

### 7. 输出审核报告
写入 `openspec/changes/<name>/design-review.md`。格式：11 维度总览表 + 问题清单（阻塞/建议/疑问）+ 三判决 + 待澄清问题及结果 + 审核备注。

## 关键原则

- **不代替人审批**：给出建议，最终决策由人做出
- **先验证再下结论**：每条发现必须能说出"这为什么会导致实现返工"
- **报真问题，不为凑数**：假问题淹没真问题
- **对照需求审核设计**：必须对照 proposal + delta spec 检查覆盖
- **ER 从 spec 反推**：每个关系必须在 spec scenario 中有依据
- **时序覆盖异常分支**：不只检查正常路径
- **可执行**：每条建议必须能直接操作（具体改哪里、怎么改）