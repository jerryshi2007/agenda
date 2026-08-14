---
description: staging 需求文档规范——SDLC 全过程管理。产出或评审需求时遵循。覆盖需求内容标准、暂存目录约定、Stage 进度追踪、与 OpenSpec 握手。
---

# req-staging · staging 全过程管理规范

本 rule 定义 staging 目录的**全过程管理**（需求→设计→研发→测试→归档），是 SDLC 外层容器。开发阶段的技术设计由 OpenSpec 管理（见 `openspec-workflow` rule），两者通过握手点衔接。

## 需求内容标准

**可验证性**
- **每条需求可验证**——能用"通过/未通过"判定，而非主观感受。
- **必须含验收标准**——写明在什么输入/条件下应得到什么结果，作为交付与测试依据。
- **优先级分级**——必须(Must)/应该(Should)/可选(Could)，避免全部"高优先"导致无法取舍。

**边界与异常**
- **边界与异常明确**——正常路径之外，覆盖空值、越界、并发、失败回退等场景。只写"正常流程"的需求是半成品。
- **去歧义**——模糊词（"快""足够""友好"）量化为可测指标，或显式标注为待澄清。

**设计边界**
- **不做数据库字段设计**——需求阶段不定义数据库字段（列名、类型、约束）、不设计数据表结构、不写 SQL DDL。这些属于技术设计阶段的产出，需求文档聚焦于用户故事、验收标准、边界与异常。

**追溯性**
- **变更留痕**——需求变更记录原因、时间、影响范围。无历史的需求文档无法追溯决策。

## 暂存目录规范

需求文档先在 `production/staging/` 下以草稿演进，作为需求→设计→研发→测试→归档全过程的外层容器。开发完成、分支合并后，才将 staging 文档合并到 `production/requirements/`。

```
production/staging/
  YYYY-MM-DD-需求概要/
    requirement.md    # 本次需求变更内容，引用 requirements/ 已有内容，只写新增/修改
    epic-story.md     # Epic/Story 拆解清单
    STATUS.md         # 状态标记 + Stage 进度表 + OpenSpec 关联
```

| 文件 | 用途 |
|------|------|
| `requirement.md` | 聚焦本次变更，已有内容用 Markdown 链接引用（如 `详见 [用户角色](../../../requirements/index.md#用户角色)`），减少重复 |
| `epic-story.md` | Epic/Story 拆解清单，含本地 ID、标题、描述、优先级、状态 |
| `STATUS.md` | 外层状态追踪：粗粒度状态机 + Stage 进度表 + OpenSpec 关联 |

- **命名唯一性**：`YYYY-MM-DD-概要` 中"概要"需确保同日唯一。若同日已有同名概要，追加数字后缀（如 `2026-08-04-日程管理-2`）。创建前先检查 `production/staging/` 中是否已有同名目录。

### 状态机

粗粒度状态机追踪模块级生命周期。`in-progress` 内部由 Stage 进度表驱动。

```
draft → confirmed → dev-ready → in-progress → done
```

| 状态 | 含义 | 触发条件 |
|------|------|---------|
| `draft` | 初始草稿 | 暂存目录创建时 |
| `confirmed` | 需求已确认 | 用户审阅确认 requirement.md + epic-story.md，分支已创建 |
| `dev-ready` | 下游可开工 | req-reviewer 审批通过 |
| `in-progress` | 研发/测试进行中 | arch-architect 开始架构设计。内部由 Stage 进度表细分 |
| `done` | 全流程完成 | 分支合并，staging 文档合并入 `requirements/` |

### Stage 进度表

STATUS.md MUST 包含 Stage 进度表，追踪 SDLC 五阶段的细粒度进度。该表在状态从 `dev-ready` 转为 `in-progress` 时创建。

```markdown
## 阶段进度

| 阶段 | 状态 | OpenSpec 关联 |
|------|:--:|------|
| Stage 1 产品 | ✅ done | — |
| Stage 2 设计 | ✅ done | add-auth-module |
| Stage 3 研发 | 🔄 in-progress | add-auth-module |
| Stage 4 测试 | ⬜ pending | — |
| Stage 5 归档 | ⬜ pending | add-auth-module |
```

**状态取值**：`⬜ pending`（未开始）/ `🔄 in-progress`（进行中）/ `✅ done`（已完成）/ `⛔ blocked`（阻塞）。

**OpenSpec 关联列**：Stage 2 设计、Stage 3 研发、Stage 5 归档与 OpenSpec 交互，填入对应的 OpenSpec 变更名（如 `add-auth-module`）。Stage 1 产品和 Stage 4 测试不涉及 OpenSpec，填 `—`。Stage 5 完成后，OpenSpec 变更已归档至 `openspec/changes/archive/`。

### STATUS.md 格式

```markdown
# STATUS

| 字段 | 值 |
|------|-----|
| 状态 | draft |
| 创建日期 | YYYY-MM-DD |
| 最后更新 | YYYY-MM-DD |

## 状态流转

    draft → confirmed → dev-ready → in-progress → done
      ↑ 当前

## 阶段进度

| 阶段 | 状态 | OpenSpec 关联 |
|------|:--:|------|
| Stage 1 产品 | 🔄 in-progress | — |
| Stage 2 设计 | ⬜ pending | — |
| Stage 3 研发 | ⬜ pending | — |
| Stage 4 测试 | ⬜ pending | — |
| Stage 5 归档 | ⬜ pending | — |
```

- `状态` 取值为状态机中定义的五种状态之一
- `创建日期` 为暂存目录创建日期
- `最后更新` 为 STATUS.md 最近一次修改日期
- 状态流转图用 `↑ 当前` 标注当前所处状态
- 阶段进度表中 `OpenSpec 关联` 仅在 Stage 2 设计、Stage 3 研发、Stage 5 归档填入实际变更名

### 全局模块状态表

`production/CLAUDE.md` 中 MUST 维护一张全局模块实现进度表，汇总所有模块的 Stage 进度：

```markdown
## 模块实现进度

| 模块 | Stage 1 产品 | Stage 2 设计 | Stage 3 研发 | Stage 4 测试 | Stage 5 归档 | OpenSpec |
|------|:--:|:--:|:--:|:--:|:--:|------|
| 日程管理 | ✅ | ✅ | ✅ | 🔄 | ⬜ | add-event-module |
| 认证 | ✅ | ✅ | 🔄 | ⬜ | ⬜ | add-auth-module |
| 打卡 | ✅ | 🔄 | ⬜ | ⬜ | ⬜ | add-checkin-module |
```

该表在每次 STATUS.md 更新后同步更新，保证 staging STATUS.md 与全局视图一致。

## Staging 需求文档结构

`requirement.md` 采用引用优先原则——`requirements/` 中已有的内容用 Markdown 链接引用，不重复。必须覆盖以下章节：

1. **产品概述** — 产品定位、核心价值、平台策略
2. **用户角色** — 角色定义、账户模型、权限矩阵
3. **功能模块** — 每个模块的功能描述和功能点列表
4. **日程类型详细设计**（如适用）— 类型对比、字段定义、示例
5. **展示模式**（如适用）— 不同模式的视觉与交互差异
6. **页面结构** — 各端页面列表和功能说明
7. **业务概念模型**（如适用）— 业务实体及其关系的概念描述，聚焦业务概念（如"案件包含多个审理阶段"），不定义数据库字段、表结构、SQL DDL。技术设计阶段的数据库设计由 arch-architect 产出
8. **非功能需求** — 性能、兼容性、安全性、可用性
9. **分期规划** — 分阶段落地计划
10. **附录** — 关键决策记录

### 更新策略

- 首次创建：需求结构化分析完成后，写入 staging 目录
- 需求变更：Read 现有 staging 文件 → 增量修改对应章节 → 追加决策记录
- 每次更新后需用户审阅确认
- 开发完成后、分支合并时，将 staging 文档合并到 `production/requirements/`

## dev-ready 标记

需求审核通过后，在 `STATUS.md` 中将状态更新为 `dev-ready`，并在 `requirement.md` 头部添加标记：

```markdown
<!-- STAGING-STATUS: dev-ready -->
<!-- CONFIRMED: YYYY-MM-DD -->
```

后续状态变更时 MUST 同步更新此标记（`in-progress` → `done`），保持标记与 STATUS.md 一致。

`dev-ready` 是下游 agent 的启动信号——arch-architect 通过读取 staging 目录中的此标记判断需求是否可执行。

## 与 OpenSpec 的握手

staging 是 SDLC 外层容器，OpenSpec 管理 Stage 2 设计、Stage 3 研发的技术实现和 Stage 5 归档。两者在以下节点握手：

### 握手点 1：dev-ready → 创建 OpenSpec 变更

- **触发**：STATUS.md 状态变为 `dev-ready`
- **动作**：主代理创建 `openspec/changes/<name>/`，写入 proposal.md（技术视角的 Why/What/How 概要，引用 staging requirement.md 中的需求动机）
- **约束**：proposal.md MUST 在 "Why" 段引用 staging 目录路径和 requirement.md

### 握手点 2：OpenSpec 设计完成 → Stage 2 设计标记完成

- **触发**：arch-architect + arch-architect-reviewer 完成，design.md + tasks.md 已产出
- **动作**：主代理将 STATUS.md 中 Stage 2 设计状态更新为 `✅ done`

### 握手点 3：OpenSpec 归档完成 → Stage 5 归档标记完成 → done

- **触发**：`openspec archive` 执行完成，变更移至 `openspec/changes/archive/`
- **动作**：主代理将 STATUS.md 中 Stage 5 归档状态更新为 `✅ done`，整体状态更新为 `done`

### 职责边界总结

| 维度 | staging | OpenSpec |
|------|---------|----------|
| **管什么** | SDLC 全生命周期：需求→设计→研发→测试→归档 | 开发阶段：技术设计→任务拆解→代码→归档 |
| **入口条件** | 有新需求/变更 | staging 到达 `dev-ready` |
| **出口条件** | 分支合并，STATUS.md → done | `openspec archive` 完成 |
| **状态粒度** | Stage 级（5 个阶段） | 文件级（proposal/design/tasks/code/archive） |
| **核心文件** | requirement.md, epic-story.md, STATUS.md | proposal.md, design.md, tasks.md, specs/ |
| **受众** | 产品 + 设计 + 研发 + 测试 + 归档全角色 | 研发角色（架构师+开发者） |

## 示例

- ✅ "登录接口在密码连续错误 5 次后锁定账号 15 分钟，并返回 HTTP 429 + 错误码 ACCOUNT_LOCKED"
- ❌ "登录要安全、友好、性能好"（不可验证、无验收标准、无边界）
