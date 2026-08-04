---
name: dev-arch-review
description: dev-architect 产出 design.md 后使用——按 10 维度审核架构设计，查需求覆盖、ER 可反推、时序完整、ADR 充分、规则合规等，给审批建议。只读不改 design.md。
rules: [dev-dotnet-standards, dev-vue3-standards, design-ui-standards, dev-code-quality, dev-security, openspec-workflow]
---

# dev-arch-review · 架构设计审核

## 在流程中的位置

`dev-arch`（架构设计 → `openspec/changes/<name>/design.md`）→ **dev-arch-review**（架构审核 → `openspec/changes/<name>/design-review.md`）→ 人审批 → `dev-planning`（任务分解）

## 何时使用

- dev-architect 产出 `design.md` 后，需要审核设计质量时
- 架构设计存在疑虑，需要系统化审查时
- 跨模块变更的架构决策需要独立审视时

跳过场景：纯单模块小改动（不涉及 design.md 产出）、纯 UI 调整、纯 bug 修复。

## 流程

1. **先 Read 规则并严格遵守其约束**
   - `rules/dev-dotnet-standards.md` — .NET 分层/异步/DI/异常/数据访问/API 设计约束
   - `rules/dev-vue3-standards.md` — Vue 3 组件组织/Composition API/状态管理/路由/API 调用约束
   - `rules/design-ui-standards.md` — UI 框架优先/设计令牌/响应式/可访问性约束
   - `rules/dev-code-quality.md` — 单一职责/YAGNI/优先复用/命名表意图
   - `rules/dev-security.md` — 认证授权/输入校验/密钥管理/最小权限
   - `rules/openspec-workflow.md` — 变更先 proposal、delta spec 标记、RFC 2119 关键词

2. **理解输入来源**
   - 读 `openspec/changes/<name>/proposal.md`：变更动机、范围、方法
   - 读 `openspec/changes/<name>/specs/` 下所有 delta spec：ADDED/MODIFIED/REMOVED 的 Requirements + Scenarios
   - 搞清楚：这次变更要解决什么问题？需求是什么？

3. **理解架构设计**
   - 读 `openspec/changes/<name>/design.md`：完整的技术设计
   - 逐节理解：Context（需求摘要/限界上下文/项目结构）、Goals/Non-Goals、Decisions（ADR/ER/API/前端架构/时序/构建序列）、Risks/Trade-offs
   - 搞清楚：设计是如何回应需求的？每个 Requirement 在设计中是否有对应的落地？

4. **按 10 维度扫描**

   | # | 维度 | 检查内容 | 严重度 |
   |---|------|---------|--------|
   | 1 | 需求覆盖 | design.md 中的实体/API/时序是否覆盖 proposal 和 delta spec 的每条 Requirement？是否有 Requirement 在设计中无对应落地？是否覆盖了所有 spec 中标注的用户角色？ | 阻塞 |
   | 2 | ER 关系可反推 | 每个 ER 关系基数能否从 spec scenario 中反推验证？是否存在"凭空设计"的关系（spec 中没有场景支撑）？关系汇总表是否完整（源/目标/基数/关系说明）？ | 阻塞 |
   | 3 | 时序完整 | 核心时序图是否覆盖正常路径 + 每类异常/边界分支？鉴权链路的多级拒绝（应用→角色→标准岗位→组织节点）是否都有时序说明？认证流（登录→token→刷新→登出）是否整链路覆盖？ | 阻塞 |
   | 4 | ADR 充分 | 是否至少对认证授权方案、分层架构选择、UI 框架选型、状态管理策略 4 类决策出具了 ADR？每份 ADR 是否包含 Context/Decision/Consequences（正+负）/Alternatives？ | 阻塞 |
   | 5 | 规则合规 | 设计是否违反 6 条 rule 的约束？是否有违规点（如 .NET 同步阻塞异步、前端不用 data-id、硬编码密钥等）未在设计说明中解释？ | 阻塞 |
   | 6 | 质量底线 | design.md 中是否有 TBD/TODO 等占位符？是否有"重复造轮子"（框架已有组件但自研）？Risks/Trade-offs 是否识别了跨上下文事务边界、并发幂等、删除影响范围等关键风险？design.md 是否落在 `openspec/changes/<name>/` 目录内？ | 阻塞 |
   | 7 | 限界上下文合理 | DDD 限界上下文划分是否符合聚合边界原则（一起变、一起保证一致性的实体在同一上下文）？聚合根识别是否正确？跨上下文交互规则是否明确（ID 引用 vs 对象引用）？项目数量和命名空间策略是否经用户确认？ | 建议 |
   | 8 | API 契约完整 | API 端点列表是否覆盖所有 spec scenario？请求/响应 DTO 形状是否与前端数据需求对齐？错误码约定是否明确（含 HTTP 状态码 + 业务错误码）？分页结构是否标准化（items/totalCount/page/pageSize）？ | 建议 |
   | 9 | 前端架构对齐 | 路由表是否完整（路由路径/页面组件/子组件/数据来源/权限要求）？状态管理方案是否合理（Pinia store 划分 vs 服务端缓存分离）？是否与所选 UI 框架（Element Plus / Ant Design Vue）对齐？ | 建议 |
   | 10 | 构建序列可行 | 构建序列是否按依赖正确排序？是否有循环依赖？每个梯队是否明确了前置条件？前后端集成 task 的时机是否合理？ | 建议 |

5. **列发现**
   - 每条发现记录：所属维度、具体位置（design.md 的节标题/AD 编号/ER 表/时序图名称）、问题描述、为什么是问题

6. **逐条验证**
   - 对每条发现反问"这真的会导致实现返工或架构缺陷吗？"
   - 排除误报——风格偏好、命名细微差异等不算问题
   - 确认阻塞项确实阻塞审批（不澄清就无法进入 dev-planning）

7. **按严重度排序**
   - **阻塞**：审批前必须修复（如需求未覆盖、ER 关系无 spec 依据、时序缺异常分支、ADR 缺失、规则违规、有 TBD/TODO）
   - **建议**：审批前建议关注（如上下文数量过多/过少、API 细节不完整、路由表缺权限标注）
   - **疑问**：需审批人确认的事项（如"这个分层策略是否正确？""这个限界上下文划分是否合理？"）

8. **给审批建议**
   - 用 AskUserQuestion 逐条追问阻塞和疑问项，不假设答案
   - 收集澄清结果后，给出三判决：
     - **设计质量**：✅ 合格 / ⚠️ 有保留 / ❌ 不合格
     - **规则合规**：✅ 合规 / ❌ 存在违规
     - **审批建议**：✅ 建议批准 / ⚠️ 建议有条件批准 / ❌ 建议驳回

9. **输出审核报告**
   - 写入 `openspec/changes/<name>/design-review.md`
   - 报告模板：

   ```markdown
   ## 架构审核报告: <change-name>

   > 审核日期：YYYY-MM-DD
   > 审核范围：openspec/changes/<name>/design.md

   ### 1. 总览

   | # | 维度 | 结果 | 问题数 |
   |---|------|------|--------|
   | 1 | 需求覆盖 | ✅ | 0 |
   | 2 | ER 关系可反推 | ✅ | 0 |
   | 3 | 时序完整 | ✅ | 0 |
   | 4 | ADR 充分 | ✅ | 0 |
   | 5 | 规则合规 | ✅ | 0 |
   | 6 | 质量底线 | ✅ | 0 |
   | 7 | 限界上下文合理 | ⚠️ | 1 |
   | 8 | API 契约完整 | ⚠️ | 2 |
   | 9 | 前端架构对齐 | ✅ | 0 |
   | 10 | 构建序列可行 | ✅ | 0 |

   ### 2. 问题清单

   #### 阻塞（审批前必须修复）
   | # | 维度 | 位置 | 问题 | 建议 |
   |---|------|------|------|------|

   #### 建议（审批前建议关注）
   | # | 维度 | 位置 | 问题 | 建议 |
   |---|------|------|------|------|

   #### 疑问（需审批人确认）
   | # | 维度 | 位置 | 问题 | 选项 |
   |---|------|------|------|------|

   ### 3. 审核判决

   | 判决 | 结果 |
   |------|------|
   | 设计质量 | ✅ / ⚠️ / ❌ |
   | 规则合规 | ✅ / ❌ |
   | 审批建议 | ✅ 建议批准 / ⚠️ 建议有条件批准 / ❌ 建议驳回 |

   ### 4. 待澄清问题及结果

   [AskUserQuestion 收集到的澄清内容]

   ### 5. 审核备注

   [其他值得审批人注意的事项]
   ```

## 关键原则

- **不代替人审批**——给出建议，标注置信度，最终决策由人做出
- **先验证再下结论**——可疑不等于有问题，每条发现必须能说出"这为什么会导致实现返工"
- **报真问题，不为凑数**——假问题淹没真问题，降低审核报告可信度
- **严重度区分严格**——阻塞 = 审批前必须解决；建议 = 值得关注但可先通过；疑问 = 需人确认
- **对照需求审核 design**——不只看 design.md 本身，必须对照 proposal + delta spec 检查设计是否回应了所有需求
- **ER 从 spec 反推**——每个设计中的关系必须能在 spec scenario 中找到依据，不能凭空设计
- **时序覆盖异常分支**——不只检查正常路径，每条时序必须覆盖 spec 中定义的异常/边界场景
- **可执行**——每条建议必须能直接操作（具体改 design.md 的哪个位置、怎么改）
