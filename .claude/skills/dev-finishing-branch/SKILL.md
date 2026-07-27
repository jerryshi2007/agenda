---
name: dev-finishing-branch
description: 实现完成、所有测试通过后使用——指导如何完成开发分支：确认 artifacts 完整性、清理遗留文件、合并/PR。
rules: [openspec-workflow]
---

# dev-finishing-branch · 完成开发分支

## 何时使用

- 所有 `openspec/changes/<name>/tasks.md` 任务已完成
- 所有测试通过（已通过 `dev-verification` 验证）
- 代码审查已通过（`dev-code-review` 双判决均为 ✅）
- 准备将工作合并回主分支

> 本 skill 负责开发侧收尾（git 合并/PR），归档阶段（delta spec 合并、openspec archive）由 `openspec-archive-change` skill 负责。完整收尾链定义见 `dev-sdd` skill。

## 流程

1. **确认状态**

   - 确认 `dev-verification` 已在本轮运行且通过
   - 确认 `dev-code-review` 已在本轮运行且通过

2. **清理遗留文件**

   检查并清理外部追踪文件，这些文件不属于 OpenSpec artifact/源码/配置，应该在归档前删除：
   - `docs/code-review-fix-list.md` — 代码审查修复清单（修复完成后删除）
   - `docs/*fix*` — 任何修复追踪类文件
   - `.superpowers/sdd/progress.md` — SDD 进度账本（dev-sdd 使用，归档前不再需要）

   清理后不残留，避免后续会话误判状态。

3. **选择完成方式**

   | 方式 | 适用场景 |
   |------|----------|
   | 直接合并到 main | 个人分支、小改动、已通过所有检查 |
   | 创建 PR | 团队协作、需要他人审查 |
   | 清理（放弃改动） | 实验性工作、方向变更 |

4. **执行**

   合并：
   ```bash
   git checkout main
   git merge <branch>
   git push origin main
   ```

   PR：
   ```bash
   git push -u origin <branch>
   # 创建 PR，包含 openspec/changes/<name>/proposal.md 摘要
   ```

5. **Archive**

   合并/PR 后，执行 OpenSpec archive：
   ```
   /opsx:archive <change-name>
   ```
   Delta specs 合并入 `openspec/specs/`，变更移至 `archive/`。

## 关键原则

- 不跳过 archive——未 archive 的变更会让 `openspec/specs/` 与代码脱节
- 合并前确认 `dev-verification` 新鲜通过
- PR 描述引用 `openspec/changes/<name>/proposal.md` 作为变更动机
