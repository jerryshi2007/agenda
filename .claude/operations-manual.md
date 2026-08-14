# Claude Code 开发框架 — 操作手册

> **适用对象**：产品经理、研发工程师、测试工程师
> **版本**：2026-07-27
> **用途**：团队培训 + 日常操作参考

---

## 目录

- [一、框架概述](#一框架概述)
- [二、流水线总览](#二流水线总览)
- [三、产品阶段（Stage 1）](#三产品阶段stage-1)
- [四、设计阶段（Stage 2）](#四设计阶段stage-2)
- [五、研发阶段（Stage 3）](#五研发阶段stage-3)
- [六、测试阶段（Stage 4）](#六测试阶段stage-4)
- [七、归档阶段（Stage 5）](#七归档阶段stage-5)
- [八、横切规则](#八横切规则)
- [九、速查表](#九速查表)
- [十、常见问题](#十常见问题)

---

## 一、框架概述

### 1.1 三层结构

本项目通过 `.claude/` 目录配置开发辅助框架，采用**正交三层**组织：

```
.claude/
├── agents/         # 角色（"谁来做"）—— 含决策流程，自主评估输入并分派
├── skills/         # 方法（"怎么做"）—— 被 agent 调用，定义具体流程
├── rules/          # 约束（"不能越界"）—— 被 skill 声明引用，定义标准底线
├── CLAUDE.md       # Agent 编排手册（每次会话加载）
└── INDEX.md        # Track × 层 工具速查表
```

**三层协作关系**：Agent 调度 → Agent 内含决策流程（Gate 机制）→ 条件分支决定调用哪个 Skill → Skill 显式 Read 其声明的 Rule 文件。

### 1.2 角色分工

| 角色 | 使用的 Agent | 职责 |
|------|-------------|------|
| **产品经理** | req-analyst, req-reviewer, ui-designer | 需求探索、梳理、审核、原型设计 |
| **架构师** | arch-architect, arch-architect-reviewer | 架构设计、任务分解、设计审核 |
| **研发工程师** | dev-dotnet, dev-vue3, dev-miniapp, dev-reviewer | 编码实现、代码审查 |
| **测试工程师** | test-planner, test-writer, test-reviewer, test-runner | 测试策略、E2E 脚本、测试审查、执行报告 |
| **任何人** | （主代理直接执行） | 归档 |

### 1.3 调度方式

**所有 Agent 由主代理（Claude Code）调度**。用户只需用自然语言描述任务，主代理自动识别当前阶段并分派对应的 Agent。例如：

- "我想加一个批量导入用户的功能" → 主代理识别为需求阶段 → 分派 req-analyst
- "帮我审查一下这个 PR" → 主代理识别为审查阶段 → 分派 dev-reviewer
- "跑一下 E2E 测试" → 主代理识别为测试阶段 → 分派 test-runner

---

## 二、流水线总览

```text
Stage 1 产品: req-analyst → req-reviewer + ui-designer（并行）→ 人审批 → git commit
Stage 2 设计: git pull → arch-architect → arch-architect-reviewer → 人审批 → git commit
Stage 3 研发: git pull → dev-dotnet + dev-miniapp (并行) → dev-reviewer → git commit
Stage 4 测试: git pull → test-planner → test-writer → test-reviewer → test-runner → 人审批
Stage 5 归档: openspec archive（任何人）
```

**关键原则**：
- git commit 是阶段间的硬性交接点——前一阶段产出必须经 git commit 后才能被下一阶段 git pull 获取
- 三层人审批 gate 不可跳过：需求审核后 + 架构审核后 + E2E 测试后
- dev-dotnet 和 dev-vue3 并行工作，互不依赖

---

## 三、产品阶段（Stage 1）

### 3.1 Agent 速查

| Agent | 触发时机 | 输入 | 产出 |
|-------|---------|------|------|
| **req-analyst** | 产品阶段启动时，收到需求 | 模糊/原始需求描述 | proposal.md + delta specs |
| **req-reviewer** | req-analyst 完成后 | proposal + delta specs | review.md（三判决） |
| **ui-designer** | 需求确认后，需要交互原型时 | 需求描述/proposal | HTML 原型 |

### 3.2 req-analyst · 需求分析师

**职责**：把模糊需求梳理成可验证、有验收标准、覆盖边界异常的结构化 OpenSpec 文档。

**决策流程**：

```
收到需求输入
  ↓
【Gate 0: 需求完整度评估】
  检查：是否有明确的用户角色/场景？功能边界？成功标准？
  ├── 全部否 →【模糊】→ 调用 req-brainstorming skill（发散探索）
  │   ⚠️ 用户未批准设计前，禁止创建 OpenSpec change
  ├── 部分满足 →【方向明确，未结构化】→ agent 自身执行结构化分析（澄清 → GWT → 边界 → 优先级）
  └── 全部满足 →【完整】→ 进入 Gate 1
  ↓
【Gate 1: OpenSpec 过程管理】
  → 创建 openspec change → 调用 openspec-propose → 产出 proposal + delta specs
  → 交还主代理 → 下一步：req-reviewer
```

**关联 Skill**：

| Skill | 用途 | 触发条件 |
|-------|------|---------|
| `req-brainstorming` | 发散探索，理解用户意图，设计方案 | 需求模糊，方向不清 |
| `openspec-propose` | 创建 OpenSpec change 脚手架 | 需求完整，Gate 1 通过 |
| `openspec-explore` | 探查代码库/现有实现（辅助） | 需要了解现有功能时 |

**Agent 自身能力**（非 Skill）：

| 能力 | 用途 | 触发条件 |
|------|------|---------|
| 结构化分析 | 收敛梳理，澄清模糊词 → 描述业务流程 → 拆分用户故事 + GWT → 识别边界异常 → 优先级标注 | 方向明确，但缺验收标准/GWT |

**关联 Rule**：
- `req-staging` — 需求文档规范（每条可验证、含验收标准、边界异常、优先级分级、去歧义）
- `openspec-workflow` — 变更管理规范（先 proposal 再实现、delta spec 标记、RFC 2119 关键词）

**产出示例**：
- `openspec/changes/<name>/proposal.md` — 变更动机、范围、方法
- `openspec/changes/<name>/specs/<domain>/spec.md` — ADDED/MODIFIED/REMOVED Requirements + GWT Scenarios

### 3.3 req-reviewer · 需求审核员

**职责**：审核 proposal + delta specs，只读不改。按 10 维度扫描，给出三判决。

**决策流程**：

```
收到审核请求
  ↓
【前置检查】确认 proposal.md 和 delta specs 存在
  ↓
1. 理解变更意图（读 proposal + delta）
2. 对比现状 spec（openspec/specs/）
3. 调用 req-review skill（10 维度扫描）
4. 输出 review.md（三判决）
  ↓
交还主代理 → 人工审批 → git commit
```

**10 维度审核**：

| # | 维度 | 严重度 |
|---|------|--------|
| 1 | 动机合理性 | 阻塞 |
| 2 | 范围完整性 | 阻塞 |
| 3 | 需求可验证性 | 阻塞 |
| 4 | 场景覆盖（GWT 正常+异常） | 阻塞 |
| 5 | 边界与异常 | 建议 |
| 6 | 现状兼容性 | 阻塞 |
| 7 | 跨变更一致性 | 建议 |
| 8 | 影响分析完整性 | 建议 |
| 9 | 优先级合理性 | 建议 |
| 10 | RFC 2119 合规 | 建议 |

**三判决**：
- **需求质量**：✅ 合格 / ⚠️ 有保留 / ❌ 不合格
- **现状兼容性**：✅ 兼容 / ❌ 存在冲突
- **审批建议**：✅ 建议批准 / ⚠️ 建议有条件批准 / ❌ 建议驳回

### 3.4 产品阶段操作流程

```
1. 产品经理用自然语言描述需求给 Claude Code
2. 主代理自动分派 req-analyst
3. req-analyst 评估需求完整度 → 走 brainstorming 或 analysis → 产出 proposal + delta specs
4. 主代理并行分派 req-reviewer 审核 + ui-designer 出原型
5. req-reviewer 输出 review.md（三判决），ui-designer 输出 HTML 原型
6. 产品经理审批 review.md + 原型交互
7. 审批通过 → git commit（交接给研发阶段）
```

### 3.5 ui-designer · UI 原型设计师

**职责**：产出低保真 HTML 原型验证交互。**不做生产代码**——实现由 dev-vue3 负责。

**决策流程**：

```
收到 UI 原型请求
  ↓
【Gate 0: 需求清晰度评估】→ 模糊则澄清或建议走 req-analyst
  ↓
【Gate 1: 需求分解 → 原型任务拆分】→ 按页面/角色拆分，用户确认
  ↓
【Gate 2: 风格选型】→ AskUserQuestion 选 Element Plus / Ant Design / 项目已有风格
  ⚠️ 未选定风格前禁止开始设计
  ↓
【原型设计】调用 design-web skill → 产出原型 HTML → 用户确认交互
```

**Gate 违规清单（STOP）**：

| 场景 | 处理 |
|------|------|
| 需求模糊、关键交互路径不清楚 | STOP，澄清或建议走 req-analyst |
| 未拆分原型任务清单 | STOP，先分解需求为任务 |
| 用户未选定风格 | STOP，AskUserQuestion 确认 |
| 原型未覆盖 4 态（正常/空/错误/loading） | STOP，补齐 |
| 原型未确认就交还 | STOP，先确认交互 |
| 原型 HTML 放入 src/ 或写 Vue 组件 | STOP，原型只做纯 HTML/CSS |

**关联 Skill**：`design-web` — 低保真 HTML 原型验证交互

**关联 Rule**：`design-ui-standards` — UI 框架优先、设计令牌优先、响应式+可访问性、原型 HTML 不是生产代码

**产出**：`production/prototypes/` 下的 HTML 原型文件（含 4 态：正常态、空态、错误态、loading 态）

---

## 四、设计阶段（Stage 2）

### 4.1 Agent 速查

| Agent | 触发时机 | 输入 | 产出 |
|-------|---------|------|------|
| **arch-architect** | 产品审批通过后，编码前 | proposal + delta specs | design.md + tasks.md |
| **arch-architect-reviewer** | design.md 完成后 | design.md + tasks.md | design-review.md（三判决） |

### 4.2 arch-architect · 架构师

**职责**：基于需求文档完成全栈技术设计，产出 design.md。非平凡变更必须使用。

**决策流程**：

```
收到架构设计请求
  ↓
【Gate 0: 变更规模评估】
  是否涉及多个模块？新实体/API？跨模块数据流？
  ├── 全部否 → 纯单模块小改动 → 跳过本 agent，直接交给 dev-dotnet + dev-miniapp
  └── 任一是 → 非平凡变更 → 进入设计
  ↓
【前置检查】确认 proposal + delta specs 存在
  ↓
1. 探查 api/ + app/ 已有代码
2. 调用 arch-design skill（强制）
   ├── 5a. 确定划分原则（DDD 限界上下文）
   │   ⚠️ 必须用 AskUserQuestion 与用户确认：
   │       项目/命名空间/数据库策略
   ├── 5b. 架构设计（三线并行：后端 + 前端 + 跨切面）
   ├── 5c. ADR 决策记录（≥4 份）
   └── 5d. 写入 design.md
3. 自审 9 项检查 → 全部通过
  ↓
交还主代理 → 下一步：arch-architect-reviewer
```

**design.md 结构**（OpenSpec 标准 4 节骨架）：

```markdown
# Design: <变更名称>

## Context
  需求摘要 / 限界上下文 / 项目结构 / 可复用部分

## Goals / Non-Goals
  本次变更目标 / 明确排除范围

## Decisions
  ADR 决策记录 / ER 图 / API 契约 / 前端架构 / 时序图 / 构建序列

## Risks / Trade-offs
  已知风险与缓解 / 未覆盖项
```

### 4.3 arch-architect-reviewer · 架构审核员

**职责**：审核 design.md，只读不改。按 10 维度审核，给出三判决。

**10 维度审核**：

| # | 维度 | 严重度 |
|---|------|--------|
| 1 | 需求覆盖 | 阻塞 |
| 2 | ER 关系可反推 | 阻塞 |
| 3 | 时序完整 | 阻塞 |
| 4 | ADR 充分 | 阻塞 |
| 5 | 规则合规 | 阻塞 |
| 6 | 质量底线（无 TBD/TODO） | 阻塞 |
| 7 | 限界上下文合理 | 建议 |
| 8 | API 契约完整 | 建议 |
| 9 | 前端架构对齐 | 建议 |
| 10 | 构建序列可行 | 建议 |

**三判决**：设计质量 / 规则合规 / 审批建议

### 4.4 arch-architect 的 task 分解职责

**arch-architect** 在设计完成后，调用 `arch-planning` skill 将 design.md 分解为 bite-sized tasks，产出 tasks.md。

**Task 硬约束**：

| 约束 | 说明 |
|------|------|
| 右尺寸 | 1-3 个文件变更，半天内可完成 |
| 自带验证命令 | 每个 task 注明 `dotnet test --filter` 或 `pnpm test run` |
| 标注负责 agent | `.NET 后端` → `dev-dotnet`，`小程序前端` → `dev-miniapp` |
| 标注依赖 | 每个 task 标注依赖哪些 task 先完成 |
| 无占位符 | 禁止 TBD/TODO/"类似 Task N" |

**tasks.md 结构**：

```markdown
# Tasks: <变更名称>

## Task 依赖关系图
[ASCII 依赖图]

## Task 列表
### 第 0 梯队：基础设施
### 第 1 梯队：认证 + 基础数据
...
```

### 4.5 设计阶段操作流程

```
1. 架构师 git pull 获取产品阶段产出
2. "帮我做这个需求的架构设计" → 主代理分派 arch-architect → 产出 design.md
3. "审核一下这个设计" → 主代理分派 arch-architect-reviewer → 产出 design-review.md
4. 架构师审批设计
5. "分解一下任务" → 主代理分派 arch-architect → 产出 tasks.md（arch-architect 内部调用 arch-planning skill）
6. git commit（交接给研发阶段）
```

---

## 五、研发阶段（Stage 3）

### 5.1 Agent 速查

| Agent | 触发时机 | 输入 | 产出 |
|-------|---------|------|------|
| **dev-dotnet** | tasks.md 完成后（并行） | .NET task | .NET 代码 + 测试 |
| **dev-vue3** | tasks.md 完成后（并行） | Vue 3 task | Vue 3 代码 + 测试 |
| **dev-miniapp** | tasks.md 完成后（并行） | 小程序 task | 小程序代码 + 测试 |
| **dev-reviewer** | 代码改动后（SDD 内或独立调度） | git diff | 审查报告（双判决） |

### 5.2 dev-dotnet · .NET 研发负责人

**职责**：.NET 技术栈 SDD 编排者。自主执行 SDD + verification。

**决策流程**：

```
收到 .NET 实现请求
  ↓
【前置检查】确认 tasks.md 存在且有 dev-dotnet task
  ↓
【Gate 0: 任务规模评估】
  ├── task ≤2 且每个 ≤3 文件 →【轻量变更】→ 直接实现（openspec-apply-change）
  └── task >2 或有大 task →【SDD 流程】→ 调用 dev-sdd skill
      ├── 逐 task 循环：TDD 实现 → task review → fix 循环
      ├── final whole-branch review
      └── dev-verification（dotnet test + build + format）
  ↓
【收尾链】dev-verification → dev-code-review → dev-finishing-branch
```

**关联 Skill**：

| Skill | 用途 |
|-------|------|
| `dev-sdd` | 子代理驱动开发（SDD 流程编排） |
| `dev-dotnet-tdd` | .NET TDD 红绿重构循环（xUnit + Moq） |
| `dev-verification` | 验证纪律（dotnet test/build/format） |
| `dev-debugging` | 调试（bug/测试失败时，不猜改） |

### 5.3 dev-vue3 · Vue 3 研发负责人

**职责**：Vue 3 技术栈 SDD 编排者。与 dev-dotnet 并行被调度。

**决策流程**：与 dev-dotnet 结构相同，区别在于：
- TDD 工具链：Vitest + Vue Test Utils（而非 xUnit + Moq）
- 验证命令：`pnpm test run` + `pnpm build` + `pnpm lint` + `pnpm vue-tsc --noEmit`
- 额外约束：所有交互元素必须有 `data-id`，测试代码只用 `[data-id="..."]` 定位
- 规则：额外引用 `dev-vue3-standards` + `design-ui-standards`

**关联 Skill**：

| Skill | 用途 |
|-------|------|
| `dev-sdd` | 子代理驱动开发（SDD 流程编排） |
| `dev-vue3-tdd` | Vue 3 TDD 红绿重构循环（Vitest + Vue Test Utils） |
| `dev-verification` | 验证纪律（pnpm test/build/lint/typecheck） |
| `dev-debugging` | 调试（bug/测试失败时，不猜改） |

### 5.4 dev-reviewer · 代码审查员

**职责**：审查代码改动，只读不改。给出双判决。

**审查维度**：
- 正确性：逻辑对吗？边界覆盖了吗？
- 安全：输入校验？密钥处理？注入/XSS？
- 性能：N+1？不必要的循环？
- 可读性：命名清楚？职责单一？
- 复用：是否重复造轮子？
- Spec 合规：覆盖了所有 requirements？

**双判决**：

| 维度 | 判决 | 含义 |
|------|------|------|
| Spec 合规 | ✅ 符合 / ❌ 不符合 | 是否覆盖 spec 中所有 requirements |
| 代码质量 | Approved / NeedsWork | 命名、结构、错误处理、复用 |
| 严重度 | 阻断 must-fix / 建议 should-fix / 可选 nit | 每条发现附严重度 |

### 5.5 研发阶段操作流程

```
1. 研发人员 git pull 获取设计阶段产出
2. "开始实现" → 主代理并行分派 dev-dotnet + dev-miniapp
3. 编码完成后自动走收尾链：dev-verification → dev-code-review → dev-finishing-branch
4. git commit（交接给测试阶段）
```

---

## 六、测试阶段（Stage 4）

### 6.1 Agent 速查

| Agent | 触发时机 | 输入 | 产出 |
|-------|---------|------|------|
| **test-planner** | 研发完成 git commit 后 | proposal + delta specs + 原型 | test-plan.md |
| **test-writer** | test-plan.md 完成后 | test-plan.md | Playwright E2E 脚本 |
| **test-reviewer** | E2E 脚本完成后 | 测试文件 | 测试质量报告 |
| **test-runner** | 测试审查通过后 | E2E 脚本 | 结构化测试报告 |

### 6.2 test-planner · 测试策划师

**职责**：设计 E2E 测试策略，输出结构化用例矩阵。**只出文档，不写代码，不执行测试。**

**产出 test-plan.md 结构**：
- 元信息（关联需求/测试环境/优先级）
- 测试矩阵（编号 / Given / When / Then / 优先级 / 标签）
- 测试数据需求（预置账号/预置数据/seed 脚本）
- 页面/路由清单（路由/data-id 前缀）
- 缺失 data-id 标记
- 风险点

**核心方法**：等价类划分 → 边界值 → 错误路径 → 去冗余 → 测试矩阵

### 6.3 test-writer · E2E 测试脚本编写员

**职责**：按 test-plan.md 用例矩阵写 Playwright E2E 脚本。

**铁律**：
- ⚠️ **Page Object 必须先于 spec 创建**——未创建 Page Object 前禁止写 spec
- Locator 只用 `[data-id="..."]`
- 一行矩阵 = 一个 test()

**产出**：
- `testing/e2e/pages/*.page.ts` — Page Object
- `testing/e2e/specs/*.spec.ts` — 测试脚本
- `testing/e2e/fixtures/*.fixture.ts` — 测试数据/登录态夹具

### 6.4 test-reviewer · 测试审查员

**职责**：审查测试质量与覆盖缺口，只读不改。

**审查维度**：
- brittle：依赖 CSS 类名定位/DOM 索引 → 实现一改就挂
- flaky：时间/并发/顺序依赖导致随机失败
- 测实现而非行为：断言内部结构而非可观察结果
- 假覆盖：有测试但无实质断言
- E2E 专项：Page Object 合理性 / data-id 一致性 / fixture 可复跑性 / spec-test-plan 对应

### 6.5 test-runner · E2E 测试执行员

**职责**：执行 E2E 测试，生成结构化测试报告。

**失败分类（4 类）**：

| 分类 | 判定标准 | 处理方式 |
|------|----------|----------|
| **真实 bug** | 行为与 spec 不符，可稳定复现 | 提交 bug 报告 |
| **环境问题** | 超时/网络错误/后端未启动 | 检查环境后重跑 |
| **脚本错误** | locator 找不到元素/断言写错 | 修复脚本后重跑 |
| **flaky** | 同一用例间歇性通过/失败 | 标记 flaky，单独治理 |

**产出**：
- 摘要总览表（通过/失败/跳过/通过率，按浏览器拆分）
- 失败明细（编号/场景/浏览器/原因分类/截图路径/建议）
- 浏览器兼容性矩阵（每个用例 × 每个浏览器 ✅/❌）

### 6.6 测试阶段操作流程

```
1. 测试人员 git pull 获取研发阶段产出
2. "设计测试策略" → 主代理分派 test-planner → 产出 test-plan.md
3. "写 E2E 脚本" → 主代理分派 test-writer → 产出 Playwright 脚本
4. "审查测试质量" → 主代理分派 test-reviewer → 产出测试质量报告
5. "执行 E2E 测试" → 主代理分派 test-runner → 产出测试报告
6. 测试人员审批 E2E 结果
```

---

## 七、归档阶段（Stage 5）

### 7.1 收尾链

编码完成后必须走完收尾链，不可跳步：

```
1. dev-verification  → 运行完整验证（测试 + 构建 + 类型检查 + Lint）
2. dev-code-review   → 全分支代码审查
3. dev-finishing-branch → 确认 artifacts 完整性、清理遗留文件、合并/PR
4. /opsx:archive     → OpenSpec 归档（delta specs 合并入 openspec/specs/）
```

**跳步 = 未完成**。openspec status 会报告 artifacts 缺失。

### 7.2 归档命令

```bash
# 归档指定变更
/opsx:archive <change-name>
```

归档后：
- Delta specs 合并入 `openspec/specs/<domain>/spec.md`
- 变更目录移至 `openspec/changes/archive/YYYY-MM-DD-<name>/`

---

## 八、横切规则

### 8.1 Rule 清单

| Rule | 适用范围 | 约束要点 |
|------|---------|---------|
| **git-commit** | 所有人 | 动词开头、一行摘要+空行+详情、一事一提交、不直推 main |
| **req-staging** | 产品 | 每条可验证、含验收标准、边界异常、优先级分级、去歧义 |
| **openspec-workflow** | 全员 | 先 proposal 再实现、delta spec 标记、变更完成后 archive |
| **dev-code-quality** | 研发 | 命名表意图、单一职责、YAGNI、优先复用、无占位符 |
| **dev-contracts** | 研发+测试 | 枚举值/错误码/DTO 定义在 openspec/contracts/，三端共享，禁止各自手写字符串字面量 |
| **dev-security** | 研发 | 外部输入必校验、不硬编码密钥、参数化查询、最小权限 |
| **dev-dotnet-standards** | 研发(.NET) | PascalCase/camelCase、异步到底、构造注入、DTO 隔离 |
| **dev-vue3-standards** | 研发(Vue3) | `<script setup>` 优先、data-id 契约、Element Plus 组件优先、设计令牌走 CSS 变量 |
| **design-ui-standards** | 研发+设计 | UI 框架优先、设计令牌优先、响应式+可访问性、原型 HTML 不是生产代码 |
| **dev-refactor** | 研发 | 不改外部行为、小步可验证、不夹带功能、先有测试再重构 |
| **test-standards** | 测试 | 与源码同结构放置、命名表意图、一测一断言、测行为不测实现、稳定标识符定位 |

### 8.2 Rule 触发关系

Rule 不自动加载，由 Skill 在 frontmatter 中声明 `rules: [...]`，被激活时显式 Read。Agent 不直接声明 Rule，Rule 通过 Skill 间接获得。

| Rule | 引用它的 Skill |
|------|---------------|
| req-staging | req-brainstorming, req-review |
| openspec-workflow | req-brainstorming, req-review, arch-planning, dev-finishing-branch, dev-code-review, arch-design, arch-review |
| design-ui-standards | design-web, dev-vue3-tdd, arch-design, arch-review |
| dev-code-quality | arch-planning, dev-code-review, dev-refactoring, dev-dotnet-tdd, dev-vue3-tdd, arch-design, arch-review |
| dev-contracts | arch-design, arch-review；agent: arch-architect, arch-architect-reviewer, dev-dotnet, dev-miniapp, test-writer |
| dev-security | dev-debugging, dev-dotnet-tdd, dev-code-review, arch-design, arch-review |
| dev-dotnet-standards | dev-dotnet-tdd, arch-design, arch-review |
| dev-vue3-standards | dev-vue3-tdd, test-e2e-playwright, arch-design, arch-review |
| dev-refactor | dev-refactoring |
| test-standards | test-case-design, test-e2e-playwright, dev-dotnet-tdd, dev-vue3-tdd |
| git-commit | （横切，CLAUDE.md 引用，主代理提交时遵循） |

---

## 九、速查表

### 9.1 按阶段速查

| 我要做什么 | 对 Claude Code 说什么 | 会分派哪个 Agent |
|-----------|----------------------|-----------------|
| 梳理需求 | "帮我分析一下这个需求：XXX" | req-analyst |
| 审核需求 | "审核一下这个需求文档" | req-reviewer |
| 架构设计 | "帮我做 XXX 的架构设计" | arch-architect |
| 审核架构 | "审核一下这个技术设计" | arch-architect-reviewer |
| 分解任务 | "把 XXX 拆成任务" | arch-architect（内部调用 arch-planning skill） |
| 写后端代码 | "帮我实现 XXX 的后端" | dev-dotnet |
| 写前端代码 | "帮我实现 XXX 的前端" | dev-vue3 |
| 代码审查 | "帮我审查一下这个改动" | dev-reviewer |
| 设计原型 | "帮我设计 XXX 的交互原型" | ui-designer |
| 测试策略 | "帮我设计 XXX 的测试策略" | test-planner |
| 写 E2E 脚本 | "帮我写 XXX 的 E2E 测试" | test-writer |
| 审查测试 | "审查一下测试质量" | test-reviewer |
| 跑 E2E | "执行 E2E 测试" | test-runner |
| 归档 | "/opsx:archive XXX" | 主代理直接执行 |

### 9.2 常用命令速查

```bash
# 后端
dotnet build api/<Project>.sln                   # 构建
dotnet test api/<Project>.sln                     # 全部测试
dotnet test --filter "FullyQualifiedName~Xxx"   # 单个测试
dotnet run --project api/src/<Project>.Api        # 启动 API

# 前端
cd web && pnpm dev                              # 启动 dev server
cd web && pnpm test run                         # 单元/组件测试
cd web && pnpm build                            # 生产构建
cd web && pnpm lint                             # ESLint
cd web && pnpm vue-tsc --noEmit                 # 类型检查

# E2E 测试
npx playwright test --config testing/e2e/playwright.config.ts
npx playwright test --config testing/e2e/playwright.config.ts --grep "规则"

# EF Core 迁移
cd api/src/<Project>.Infrastructure
dotnet ef migrations add <Name> --startup-project ../<Project>.Api
dotnet ef migrations script --startup-project ../<Project>.Api
dotnet ef database update --startup-project ../<Project>.Api

# OpenSpec
openspec list                                    # 查看活跃变更
openspec status --change "<name>"                # 查看变更状态
openspec archive <name>                          # 归档变更
```

### 9.3 验证矩阵

| 技术栈 | 测试 | 构建 | 类型检查 | Lint/格式化 |
|--------|------|------|----------|------------|
| .NET | `dotnet test` | `dotnet build` | — | `dotnet format --verify-no-changes` |
| Vue 3 | `pnpm test run` | `pnpm build` | `pnpm vue-tsc --noEmit` | `pnpm lint` |

---

## 十、常见问题

### Q1：我想跳过某个阶段，直接写代码，可以吗？

**不可以**。即使变更很小，也应走完整链路。简单变更可以快（比如轻量变更路径直接实现），但不能跳阶段。跳阶段会导致：
- 需求没有文档化，后续无法追溯
- 设计没有审核，架构问题到测试阶段才发现
- openspec status 报告 artifacts 缺失

### Q2：轻量变更和 SDD 流程怎么选？

由 dev-dotnet / dev-vue3 的 Gate 0 自动判定：
- task 数 ≤2 且每个 task ≤3 文件 → **轻量变更**（直接实现）
- task 数 >2 或有大 task（>3 文件）→ **SDD 流程**（子代理驱动开发）

### Q3：需求文档写多详细算够？

Gate 0 判定标准：
- 每条需求有 GWT 场景（正常路径 + 至少 1 异常路径）
- 有优先级标注（Must/Should/Could）
- 边界与异常场景已识别
- req-staging rule 全部约束满足

### Q4：data-id 是什么？为什么这么重要？

`data-id` 是开发与测试的共同契约——开发在组件中写入，测试通过它定位元素。规范：`<组件缩写>-<元素角色>`（如 `user-list-search-input`）。

**禁止**测试代码用 CSS 类名、DOM 索引、文本内容定位——那些会随设计和重构变动。

### Q5：编码完成了，怎么才算真正完成？

必须走完收尾链：
1. `dev-verification` — 新鲜运行全部验证命令
2. `dev-code-review` — 全分支代码审查（双判决通过）
3. `dev-finishing-branch` — 清理遗留、合并/PR
4. `/opsx:archive` — 归档

跳步 = 未完成。

### Q6：Agent 不听话怎么办？

每个 Agent 正文有「Gate 违规清单（STOP）」——如果 Agent 违反流程，主代理会按清单拦截。如果问题持续，可以将问题反馈给 Agent 配置维护者。

### Q7：多个需求并行怎么处理？

每个需求创建独立的 OpenSpec change。多个 change 并行时，req-reviewer 会做跨变更一致性检查。研发阶段各 change 独立执行，注意合并冲突。

### Q8：怎么查看当前有哪些进行中的变更？

```bash
openspec list
```

或直接问 Claude Code："当前有哪些进行中的需求？"

---

> **文档维护**：本手册基于 `.claude/` 目录下的 Agent/Skill/Rule 文件自动生成。框架变更后需同步更新本手册。