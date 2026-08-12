---
name: dev-planning
description: 技术设计 design.md 完成后使用——将需求分解为 bite-sized tasks，产出 tasks.md 到 openspec/changes/<name>/。非平凡实现任务动手前使用。
rules: [dev-code-quality, openspec-workflow, dev-miniapp-standards, dev-dotnet-standards]
---

# dev-planning · 研发计划

## 在流程中的位置

`dev-arch`（架构设计 → `openspec/changes/<name>/design.md`）→ **dev-planning**（任务分解 → `openspec/changes/<name>/tasks.md`）→ `dev-sdd`（执行） 或 `openspec-apply-change`（执行）

## 何时使用

- 技术设计 design.md 完成后、动手编码前
- OpenSpec proposal 已审批，需分解为 tasks 时
- 需要将设计分解为可逐个执行的 bite-sized tasks 时
- 跨模块变更需要协调开发顺序时

## 流程

0. **确认输入来源**

   本 skill 统一走 OpenSpec 路径，输入材料均位于 `openspec/changes/<name>/` 下：
   - 运行 `openspec list --json` 获取活跃变更
   - Read `proposal.md` + delta spec（`openspec/changes/<name>/specs/`）
   - Read `openspec/changes/<name>/design.md` — 限界上下文、ER 图、API 契约、前端路由、构建序列、ADR
   - 如果 `openspec-propose` 已创建骨架 tasks.md，在此基础上展开为详细 tasks.md；如果不存在，从头创建
   - 从 delta spec 的 ADDED/MODIFIED Requirement 和 design.md 的构建序列中提取 task 范围

   输出统一写入 `openspec/changes/<name>/tasks.md`。

1. **读取输入材料**

   - Read `openspec/changes/<name>/proposal.md` — 了解变更动机与范围
   - Read `openspec/changes/<name>/specs/<domain>/spec.md` — 提取 ADDED/MODIFIED Requirement
   - Read `openspec/changes/<name>/design.md` — 提取限界上下文、ER 图、API 契约、构建序列、关键设计决策
   - 从 Requirement 和 Scenario 反推 task 粒度

2. **读取编码规范**（约束 task 粒度与规范）
   - Read `rules/dev-dotnet-standards.md`
   - Read `rules/dev-miniapp-standards.md`
   - Read `rules/dev-code-quality.md`
   - Read `rules/dev-security.md`

3. **按构建序列分解 tasks**

   每个 task 必须满足以下约束：

   - **右尺寸**——1–3 个文件变更，半天内可完成
   - **自带测试循环**——每个 task 描述中注明"完成后运行什么命令验证"
   - **无占位符**（遵循 `dev-code-quality` rule）——禁止 TBD、TODO、"类似 Task N"、"参考 XX 实现"
   - **有明确的输入/输出**——输入是什么（依赖哪个 task 的产出）、输出是什么（产生哪些文件）
   - **标注负责 agent**——`.NET 后端` → `dev-dotnet`，`小程序前端` → `dev-miniapp`
   - **标注上层依赖**——此 task 依赖哪些 task 先完成

   task 模板：

   ```markdown
   ### Task N: <简短描述>

   - **负责 agent**：`dev-dotnet` / `dev-miniapp`
   - **依赖**：Task N-1, Task N-2（无依赖则写"无"）
   - **输入**：<依赖 task 产出的文件/接口>
   - **产出文件**：
     - `api/src/<Project>.Domain/xxx/Xxx.cs`
     - `api/src/<Project>.Application/xxx/XxxService.cs`
   - **完成标准**：
     1. <具体可验证的条件 1>
     2. <具体可验证的条件 2>
   - **验证命令**：`dotnet test --filter "FullyQualifiedName~Xxx"` 或 `pnpm test --run Xxx`
   ```

4. **标注跨模块集成点**
   - 哪些 task 是前后端联调 task（依赖双方 API 稳定）
   - 哪些 task 跨上下文（如 RolePositionBinding 依赖 StandardPosition）
   - 这些 task 的时机说明

5. **输出 tasks.md**

   写入 `openspec/changes/<name>/tasks.md`。

   格式：

   ```markdown
   # Tasks: <变更名称>

   > 日期：YYYY-MM-DD
   > 总 task 数：N

   ## Task 依赖关系图

   [用缩进或 ASCII 图表示 task 依赖关系]

   ## Task 列表

   ### 第 0 梯队：基础设施

   [task 列表]

   ### 第 1 梯队：认证 + 基础数据

   [task 列表]

   ...
   ```

6. **自审**

   - [ ] 每个 task ≤ 3 个文件变更？
   - [ ] 每个 task 有验证命令？
   - [ ] 无 TBD/TODO？
   - [ ] 依赖关系无循环？
   - [ ] 文件路径与 design.md 一致？

## 关键原则

- **task 右尺寸**——1–3 个文件，半天完成。大了拆，小了合
- **按构建序列分组**——同一梯队的 task 可并行，跨梯队串行
- **每个 task 可独立验证**——有自己的测试命令
- **task 是交接单元**——dev-sdd 按 task 逐条调度 agent，task 描述是 agent 的唯一输入
- **不写代码**——只产出 tasks.md，不写实现
