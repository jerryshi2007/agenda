---
name: dev-sdd
description: 有实现计划且任务相互独立时使用——逐任务 dispatch 子代理实现、每任务 review、修复循环、最终全分支 review
rules: [dev-code-quality, dev-security, openspec-workflow]
---

# dev-sdd · 子代理驱动开发

## 核心原则

Fresh subagent per task + task review（spec + quality）+ broad final review = 高质量快速迭代

**SDD 纪律**：
- **任务右尺寸**——每 task 自带测试循环 + reviewer gate（1-3 文件，半天内可完成）
- **File handoff**——task brief（文件）→ implementer 子代理读 brief 实现 → 写 report（文件）
- **Progress ledger**——维护进度账本，标记每个 task 状态和 fix 循环次数

**为什么用子代理**：每个子代理拥有独立上下文，只拿到它需要的精确信息。控制器上下文不被大量实现细节撑爆。

## 何时使用

- 已有 `openspec/changes/<name>/tasks.md` 作为实现计划
- 任务之间基本独立，可以逐个执行
- 在当前会话中执行（不切换到并行会话）

**与 `openspec-apply-change` 的关系**：`openspec-apply-change` 是轻量级实现路径（直接实现，适合简单变更），本 skill 是重量级路径（子代理 SDD，适合多 task 复杂变更）。选择规则：tasks.md 中 task 数 ≤2 且每个 ≤3 文件 → 用 openspec-apply-change；task 数 >2 或有大 task（>3 文件）→ 用 dev-sdd

## 流程

```
读计划 → 建 todo → 逐任务循环：
  ├── 写 task brief（文件）
  ├── dispatch implementer 子代理（读 brief → 实现 → 写 report）
  ├── 处理 implementer 状态
  ├── 生成 review package（git diff 文件）
  ├── dispatch task reviewer（读 diff → spec 合规 + 代码质量）
  ├── 有 Critical/Important → dispatch fix → 重新 review
  └── 通过 → 进度账本记录 → 下一任务

全部任务完成：
  dispatch final whole-branch reviewer
  → 引导收尾链（见"完成后引导"）
```

## 完成后引导

全部 task 完成且 final reviewer 通过后，must 引导用户走收尾链，不直接跳到 archive：

1. **`dev-verification`** — 如果本轮对话中尚未运行完整验证（测试 + 构建 + 类型检查），先运行 `dev-verification` skill
2. **`dev-code-review`** — 如果本轮对话中尚未执行全分支代码审查，先运行 `dev-code-review` skill
3. **`dev-finishing-branch`** — 引导用户执行收尾：确认状态、清理遗留文件、合并/PR（不归档，归档由 Stage 5 archiver 负责）

> 实现完成≠可以归档。finishing-branch 负责检查 artifacts 完整性、清理遗留文件、确认验证与审查已通过——跳过它会导致 openspec status 报告 artifacts 缺失。

## File Handoff

不贴文本到 prompt，传文件路径：

| 文件 | 谁产生 | 谁消费 | 内容 |
|------|--------|--------|------|
| task brief | 控制器（从 tasks.md 提取） | implementer | 单个 task 的需求、接口、约束 |
| report file | implementer | 控制器 | 实现详情、测试结果、自审发现 |
| review package | 控制器（`git diff` 输出） | reviewer | commit 列表 + diff stat + 完整 diff |

## Implementer 状态处理

| 状态 | 处理方式 |
|------|----------|
| DONE | 生成 review package，dispatch reviewer |
| DONE_WITH_CONCERNS | 先读 concerns，正确性/范围问题→修复后再 review；观察性备注→继续 review |
| NEEDS_CONTEXT | 提供缺失上下文，重新 dispatch |
| BLOCKED | 上下文问题→补充重试；需要更强推理→升级模型；太大→拆分；计划错误→升级给用户 |

## 进度账本

在 `.superpowers/sdd/progress.md` 记录每个 task 完成状态和 commit 范围。这是 compaction 后的恢复地图——信任账本和 `git log` 超过自己的记忆。

## 模型选择

| 任务类型 | 模型 |
|----------|------|
| 机械实现（1-2 文件，完整 spec） | 便宜模型 |
| 集成任务（多文件，需要协调） | 标准模型 |
| 架构/设计判断 | 最强模型 |
| 最终全分支 review | 最强模型 |

## Red Flags

- 跳过 task review
- 接受缺少任一判决的 review（spec 合规 AND 代码质量都需要）
- 同时 dispatch 多个 implementer（会冲突）
- 让 implementer 读整个 plan 文件（应该只给它 task brief）
- 告诉 reviewer "不要标记 X 问题"（预判发现）
- 进度账本已标记完成的 task 重新 dispatch
