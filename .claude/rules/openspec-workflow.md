# openspec-workflow · OpenSpec 变更管理规范

## 约束

- **先 proposal 再实现**——任何非平凡需求变更必须先创建 `openspec/changes/<name>/proposal.md`，经审批后方可进入实现。禁止跳过 proposal 直接写代码。简单 bug 修复、格式调整、文档更新等平凡变更可豁免。
- **Delta spec 标记变更类型**——变更的 spec 使用 ADDED（新增）、MODIFIED（修改）、REMOVED（移除）三个段落标记，不重写整个 spec。
- **RFC 2119 关键词**——需求用 MUST/SHALL（绝对要求）、SHOULD（推荐）、MAY（可选）标明约束强度。
- **Given-When-Then 场景**——每个 Requirement 至少配一个 Scenario，用 Given-When-Then 描述正常路径和至少一个异常路径。
- **变更完成后 archive**——实现完成并验证通过后，必须执行 `openspec archive`，将 delta 合并入 `openspec/specs/`，变更移至 `archive/`。
- **`openspec/specs/` 是需求真相源**——所有需求以 `openspec/specs/<domain>/spec.md` 为准，人类和 agent 均以此为依据。

## 示例

- ✅ 新增 2FA 功能：先创建 `openspec/changes/add-2fa/proposal.md` + `specs/auth/spec.md`（delta: ADDED 2FA 需求）→ 审批 → 实现 → archive → `openspec/specs/auth/spec.md` 合并了 2FA 需求
- ❌ 直接改认证模块代码，没写 proposal，没写 delta spec——不知道为什么要改、改了什么

## Proposal 内容规范

`openspec/changes/<name>/proposal.md` 必须包含以下章节：

- **Why（动机）**：为什么现在要做这个变更？解决什么问题？
- **What（范围）**：变更涉及哪些模块/领域？明确包含和排除的边界。
- **How（方法）**：变更的技术路径和关键设计决策概要。

## Delta spec 内容规范

`openspec/changes/<name>/specs/<domain>/spec.md` 的变更内容：

- **ADDED Requirements**：新增需求，每条配 Given-When-Then Scenarios（正常路径 + 至少 1 异常路径）
- **MODIFIED Requirements**：修改需求，标注修改原因和影响范围
- **REMOVED Requirements**：移除需求，标注移除原因和迁移方案

## 与 req-spec 的关系

本 rule 定义变更管理的**流程**（什么时候做什么），`req-spec` 定义需求的**内容标准**（需求怎么写）。**Delta spec 格式（ADDED/MODIFIED/REMOVED）以本 rule 为权威定义。**
