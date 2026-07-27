# 流水线参考文档

> **本文档是流水线参考，非可调度 agent。** 流水线已拆分为三个独立阶段，由产品、研发、测试各自驱动，通过 OpenSpec 文件 + git 完成阶段交接。

## 三阶段模型总览

```
Stage 1 产品: req-analyst → req-reviewer → 人审批 → git commit
Stage 2 研发: git pull → dev-architect → dev-architect-reviewer → 人审批 → dev-planning → dev-dotnet + dev-vue3 (并行) → git commit
Stage 3 测试: git pull → test-planner → test-writer → test-reviewer → test-runner → 人审批
Stage 4 归档: openspec archive（任何人）
```

- **产品人员**驱动 Stage 1，产出 proposal + delta specs + review.md
- **研发人员**驱动 Stage 2，产出 design.md + tasks.md + 代码
- **测试人员**驱动 Stage 3，产出 test-plan.md + E2E 脚本 + 测试报告
- git commit 是阶段间的硬性交接点——前一阶段的所有产出必须经 git commit 后才能被下一阶段 git pull 获取
- 人审批 gate 保留在关键节点：需求审核后、架构审核后、E2E 测试后

## 各阶段详细步骤

### Stage 1: 产品阶段

1. **需求探索**：产品人员 dispatch req-analyst，产出 `openspec/changes/<name>/proposal.md` + delta specs
2. **需求审核**：产品人员 dispatch req-reviewer，产出 `openspec/changes/<name>/review.md`
3. **人审批**：产品人员审批需求文档质量，通过后 git commit 提交到仓库

### Stage 2: 研发阶段

1. **git pull**：研发人员拉取产品阶段产出的 proposal + specs + review
2. **技术设计**：研发人员 dispatch dev-architect，产出 `openspec/changes/<name>/design.md`
3. **架构审核**：研发人员 dispatch dev-architect-reviewer，产出 `openspec/changes/<name>/design-review.md`
4. **人审批**：研发人员审批技术设计，通过后进入任务分解
5. **任务分解**：研发人员 dispatch dev-planning，产出 `openspec/changes/<name>/tasks.md`
6. **并行编码**：研发人员并行 dispatch dev-dotnet + dev-vue3，各自执行 SDD + verification
7. **git commit**：编码完成并验证通过后，研发人员 git commit 提交代码

### Stage 3: 测试阶段

1. **git pull**：测试人员拉取研发阶段产出的代码 + tasks.md
2. **测试策略**：测试人员 dispatch test-planner，产出 `openspec/changes/<name>/test-plan.md`
3. **E2E 脚本**：测试人员 dispatch test-writer，产出 Playwright E2E 脚本
4. **脚本审查**：测试人员 dispatch test-reviewer，产出测试质量报告
5. **测试执行**：测试人员 dispatch test-runner，执行 E2E 并生成报告
6. **人审批**：测试人员审批 E2E 结果

### Stage 4: 归档

1. 收尾：Read `dev-finishing-branch` skill（规格）→ openspec status 确认 → 清理遗留 → 合并/PR
2. 归档：Read `openspec-archive-change` skill（规格）→ openspec archive

## 原全链路步骤（参考）

以下为原 pm-workflow 全链路 15 步骤，保留作为历史参考：

```
① dispatch req-analyst → 需求探索 + 梳理 → proposal.md + delta specs
② dispatch req-reviewer → 审核 → review.md（10 维度 + 三判决）
③ 人审批（硬 gate——未批准不进入下一步）
④ dispatch dev-architect → 技术设计 → openspec/changes/<name>/design.md
⑤ dispatch dev-architect-reviewer → 架构审核 → design-review.md（10 维度 + 三判决）
⑥ 人审批（硬 gate——未批准不进入下一步）
⑦ dispatch dev-planning → 任务分解 → tasks.md
⑧ dispatch test-planner → E2E 测试策略 → openspec/changes/<name>/test-plan.md
⑨ 并行 dispatch dev-dotnet + dev-vue3 → 各自 SDD + verification
⑩ dispatch test-writer → Playwright E2E 脚本（Page Object + spec + fixture）
⑪ dispatch test-reviewer → 审核脚本质量 → 覆盖缺口 + 质量问题 + data-id 一致性
⑫ dispatch test-runner → 执行 E2E + 生成报告 → testing/e2e/reports/test-report.md
⑬ 人审批 E2E 结果（硬 gate——未批准不进入下一步）
⑭ 收尾 → openspec status + 清理 + 合并/PR
⑮ 归档 → openspec archive
```

## 关键原则

- **不产出内容**——proposal/specs/design/tasks/代码均由专职 agent 产出
- **硬 gate**——三层人审批不可跳过（需求审核后 + 架构审核后 + E2E 测试后）
- **并行机会**——dev-dotnet 和 dev-vue3 同时 dispatch，利用并行加速
- **问题升级**——任何 agent 返回 BLOCKED 或失败时，向用户报告并等待指示
- **不跳步**——即使变更很小，也走完整链路（简单变更可以快，但不能跳）