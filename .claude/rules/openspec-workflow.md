# openspec-workflow · OpenSpec 变更管理规范

本 rule 定义 OpenSpec 的**开发阶段管理**（Stage 2 设计 → Stage 5 归档），是 staging 外层容器内的开发引擎。SDLC 全过程管理由 `req-staging` rule 负责，两者通过握手点衔接。

## 职责边界

OpenSpec 覆盖 SDLC 中的**开发段**：

```
Stage 1 产品      Stage 2 设计        Stage 3 研发      Stage 4 测试     Stage 5 归档
(staging 管理) → (OpenSpec 管理) → (OpenSpec 管理) → (staging 管理) → (OpenSpec 管理)
                proposal → design
                → tasks            → code                           → archive
```

- **OpenSpec 管**：技术设计、任务拆解、spec delta、代码实现跟踪、归档合并
- **staging 管**：产品需求、用户故事、测试策略、全过程状态追踪、全局视图

## 约束

- **入口条件**：OpenSpec 变更创建前，对应的 staging 目录 MUST 处于 `dev-ready` 状态。proposal.md 的 "Why" 段 MUST 引用 staging 目录路径和 requirement.md。
- **先 proposal 再实现**——任何非平凡需求变更必须先创建 `openspec/changes/<name>/proposal.md`，经审批后方可进入实现。禁止跳过 proposal 直接写代码。简单 bug 修复、格式调整、文档更新等平凡变更可豁免。
- **Delta spec 标记变更类型**——变更的 spec 使用 ADDED（新增）、MODIFIED（修改）、REMOVED（移除）三个段落标记，不重写整个 spec。
- **RFC 2119 关键词**——需求用 MUST/SHALL（绝对要求）、SHOULD（推荐）、MAY（可选）标明约束强度。
- **Given-When-Then 场景**——每个 Requirement 至少配一个 Scenario，用 Given-When-Then 描述正常路径和至少一个异常路径。
- **变更完成后 archive**——实现完成并验证通过后，必须执行 `openspec archive`，将 delta 合并入 `openspec/specs/`，变更移至 `archive/`。
- **归档回写 staging**——archive 完成后，主代理 MUST 调度 `archiver` agent 完成归档收口：回写对应 staging 目录 STATUS.md 中 Stage 5 归档为 `✅ done`、整体状态为 `done`，并将 staging 目录移入 `production/archive/`。
- **`openspec/specs/` 是需求真相源**——所有需求以 `openspec/specs/<domain>/spec.md` 为准，人类和 agent 均以此为依据。

## 示例

- ✅ 新增 2FA 功能：staging `dev-ready` → 创建 `openspec/changes/add-2fa/proposal.md`（引用 staging 需求）+ `specs/auth/spec.md`（delta: ADDED 2FA 需求）→ 审批 → 实现 → archive → `openspec/specs/auth/spec.md` 合并了 2FA 需求 → 回写 staging STATUS.md Stage 5 归档 → done
- ❌ 直接改认证模块代码，没写 proposal，没写 delta spec——不知道为什么要改、改了什么
- ❌ staging 还在 `draft` 就创建 OpenSpec 变更——需求未确认，技术设计先跑

## Proposal 内容规范

`openspec/changes/<name>/proposal.md` 必须包含以下章节：

- **Why（动机）**：为什么现在要做这个变更？解决什么问题？MUST 引用对应 staging 目录路径和 requirement.md。
- **What（范围）**：变更涉及哪些模块/领域？明确包含和排除的边界。
- **How（方法）**：变更的技术路径和关键设计决策概要。

## Delta spec 内容规范

`openspec/changes/<name>/specs/<domain>/spec.md` 的变更内容：

- **ADDED Requirements**：新增需求，每条配 Given-When-Then Scenarios（正常路径 + 至少 1 异常路径）
- **MODIFIED Requirements**：修改需求，标注修改原因和影响范围
- **REMOVED Requirements**：移除需求，标注移除原因和迁移方案

## 与 req-staging 的关系

本 rule 定义变更管理的**开发段流程**，`req-staging` 定义 SDLC **全生命周期**（需求内容标准 + Stage 进度追踪 + 全局视图）。

- **握手点 1**：staging `dev-ready` → 创建 OpenSpec 变更
- **握手点 2**：OpenSpec 设计完成（design.md + tasks.md 产出）→ staging Stage 2 设计 ✅ done
- **握手点 3**：OpenSpec archive 完成 → `archiver` 回写 staging Stage 5 归档 ✅ done + staging 目录移入 `production/archive/` → 整体 `done`

Delta spec 格式（ADDED/MODIFIED/REMOVED）以本 rule 为权威定义。
