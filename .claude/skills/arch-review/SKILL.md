---
name: arch-review
description: 非平凡需求确认后、dev-planning 前使用——全栈架构设计，覆盖 .NET 后端分层/模块边界/API 契约 + Vue 3 前端组件树/路由/状态管理/数据流，产出技术设计 design.md（OpenSpec change 目录内，4 节骨架 + 按需扩展）+ ADR 交接给 dev-planning。
rules: [dev-dotnet-standards, dev-vue3-standards, design-ui-standards, dev-code-quality, dev-security, openspec-workflow]
---

# arch-review · 全栈架构设计

## 在流程中的位置

req-analyst agent / `openspec-propose` → **arch-review**（架构设计 → `openspec/changes/<name>/design.md`）→ `dev-planning`（任务分解）→ `dev-sdd`（执行）

## 何时使用

- 非平凡需求确认后、动手编码前，需要做架构设计时
- 跨模块变更（涉及 api/ + app/ 两端时）
- 涉及认证授权、数据流、模块边界等架构决策时
- 新技术引入或技术选型需要权衡时
- 已有架构需要评审或调整时

跳过场景：纯单模块小改动（改一个 Controller/组件内部逻辑）、纯 UI 调整不涉及数据流变化、纯 bug 修复。

## 流程

1. **先 Read 规则并严格遵守其约束**
   - `rules/dev-dotnet-standards.md` — .NET 分层/异步/DI/异常/数据访问/API 设计约束
   - `rules/dev-vue3-standards.md` — Vue 3 组件组织/Composition API/状态管理/路由/API 调用约束
   - `rules/design-ui-standards.md` — UI 框架优先/设计令牌/响应式/可访问性约束
   - `rules/dev-code-quality.md` — 单一职责/YAGNI/优先复用/命名表意图
   - `rules/dev-security.md` — 认证授权/输入校验/密钥管理/最小权限
   - `rules/openspec-workflow.md` — 变更先 proposal、delta spec 标记、RFC 2119 关键词

2. **理解需求**
   - 读 `openspec/specs/<domain>/spec.md` 和 `openspec/changes/<name>/proposal.md`
   - 提取功能需求（用户能做什么）+ 非功能需求（性能/安全/可用性目标）
   - 识别跨切面关注点（认证、审计、缓存、错误处理——哪些模块都需要的？）

3. **现状分析**
   - 探查 `api/` 和 `app/` 下已有代码结构（如有）
   - 识别已有分层模式、命名约定、组件组织方式
   - 标注可复用部分（哪些不改、哪些扩展、哪些新建）
   - 不推翻现有模式——在已有约定上增量设计

4. **确定划分原则**（架构设计前必须先和用户对齐）

   遵循 DDD 限界上下文原则，而非按数据库表划分：

   - **从 spec 中识别聚合根**——哪些实体控制其他实体的生命周期？哪些实体一起变、一起保证一致性？
   - **识别限界上下文**——哪些聚合共享同一套业务语言？哪些聚合之间通过 ID 弱引用而非对象引用？
   - **判断标准**：
     - 一个聚合内的实体级联停用/删除（如标准岗位停用 → 实际岗位同步停用）→ 同属一个上下文
     - 两个实体通过外键 ID 关联、各自独立生命周期 → 可能属不同上下文（如角色-岗位绑定 → 角色的生命周期不受岗位控制）
     - 一套业务语言、一个业务团队维护 → 同一个上下文
   - 上下文不宜过多（通常 4–8 个），过细则按表划分、失去聚合意义

   确定上下文后，和用户对齐以下决策，不自行假设：

   | 需对齐的决策 | 选项 A | 选项 B |
   |-------------|--------|--------|
   | 项目/程序集数量 | 每个上下文一个项目 | 按层分项目，上下文用命名空间隔离 |
   | 命名空间策略 | `Company.Project.{Context}.{Layer}` | `Company.Project.{Layer}.{Context}` |
   | 数据库 | 每上下文独立 DbContext | 共享一个 DbContext |

   **必须用 AskUserQuestion 和用户确认以上决策**，确认后才能进入步骤 5。

5. **架构设计（全栈三线并行）**

   **后端（.NET）：**
   - 分层与模块边界——按步骤 4 确定的限界上下文和项目/命名空间策略，定义依赖方向
   - **ER 图**——所有实体 + 字段要点 + 关系基数（1:1/1:N/N:M）+ 级联规则 + 唯一性约束。每个关系必须能从 spec scenario 反推验证
   - API 契约轮廓——端点列表、请求/响应 DTO 形状、错误码约定、分页结构
   - 认证授权方案——JWT/OIDC 集成、Policy-based Authorization、权限模型
   - 数据访问策略——EF Core 实体关系、仓储边界、迁移策略
   - 跨上下文交互规则——哪些实体通过 ID 引用跨上下文、哪些通过 Service 接口调用

   **前端（Vue 3）：**
   - 组件树与路由结构——页面层级、路由懒加载边界、导航守卫职责
   - 状态管理方案——Pinia store 划分（哪些数据进 store、哪些走请求缓存）
   - API 对接层——axios 封装结构、请求取消策略、错误拦截层级
   - UI 框架对齐——Element Plus / Ant Design Vue 选型确认、主题 token 映射

   **跨切面：**
   - API 契约形状（前后端共同约定——请求/响应格式、错误码语义）
   - 数据流方向（单向/双向、owner 在哪端、缓存与失效策略）
   - 错误处理策略（前端显示什么、后端记录什么、用户看到什么）
   - 认证流（登录→token 存储→刷新→401 处理→登出，整链路）

6. **ADR 决策记录**

   对每个关键决策，按以下模板输出 ADR：

   ```markdown
   ### ADR-序号: 决策标题

   #### Context
   要解决什么问题？当前状态是什么？

   #### Decision
   选择了什么方案？

   #### Consequences

   ##### Positive
   - 好处 1
   - 好处 2

   ##### Negative
   - 代价/风险 1
   - 代价/风险 2

   #### Alternatives Considered
   - 方案 A：简述 + 为什么没选
   - 方案 B：简述 + 为什么没选

   #### Status
   Accepted / Proposed / Superseded

   #### Date
   YYYY-MM-DD
   ```

   至少对以下决策类型出具 ADR：
   - 认证授权方案（JWT 策略、OIDC 集成方式）
   - 分层架构选择（包含项目-命名空间策略：按上下文拆 vs 按层拆，命名空间隔离方案）
   - UI 框架选型（Element Plus vs Ant Design Vue）
   - 状态管理策略（Pinia store 划分原则、缓存方案）

7. **输出技术设计并写入 `openspec/changes/<name>/design.md`**

   采用 OpenSpec 标准 4 节骨架（Context / Goals-NonGoals / Decisions / Risks-Trade-offs），架构细节作为 Decisions 下子节扩展：

   ```markdown
   # Design: <变更名称>

   > 关联 OpenSpec 变更：<name>
   > 日期：YYYY-MM-DD

   ## Context

   [背景、当前状态、约束、利益相关者]

   ### 需求摘要
   [功能需求清单 + 非功能约束 + 用户角色]

   ### 限界上下文划分
   | 上下文 | 聚合根 | 核心实体 | 划分理由 |
   |--------|--------|----------|----------|
   [跨上下文交互规则说明]

   ### 项目结构与分层方案
   [项目/程序集结构树、命名空间约定、依赖关系图、前端项目]

   ### 现状与可复用部分
   [已有代码探查结论、哪些复用/扩展/新建]

   ## Goals / Non-Goals

   **Goals:**
   [本 change 的架构目标]

   **Non-Goals:**
   [明确排除的范围]

   ## Decisions

   [关键设计决策 + ADR + 架构细节，按需扩展子节]

   ### ADR 决策记录
   [至少：认证授权方案、分层架构选择、UI 框架选型、状态管理策略]

   ### 实体关系图（ER）
   [每个上下文：实体 + 字段要点 + 关系基数 + 级联规则 + 唯一性约束]
   [关系汇总表：序号 | 源 | 目标 | 基数 | 关系说明]
   [每个关系必须能从 spec scenario 反推验证]

   ### API 契约轮廓
   | 端点 | 方法 | 说明 | 认证 |

   ### 前端架构
   | 路由路径 | 页面组件 | 子组件 | 数据来源 | 权限要求 |
   [状态管理方案、API 对接层、UI 框架对齐]

   ### 核心时序图
   [至少包含以下时序，覆盖正常路径 + 异常分支：]
   - 认证流（OIDC → JWT 签发 → 刷新 → 登出）
   - 鉴权链路（多级拒绝：应用→角色→标准岗位→组织节点，每一级的拒绝处理）
   - 核心业务流程中的关键时序

   ### 构建序列
   [按依赖排序的梯队式构建顺序，交接 dev-planning 用]

   ## Risks / Trade-offs

   [已知风险与权衡，格式：[风险] → [缓解]]
   - 跨上下文事务边界、并发幂等、删除影响范围等
   - 未覆盖/推迟项
   ```

8. **交接 dev-planning**

   说明 design.md 如何被 dev-planning 分解：
   - 每个模块对应哪些 task
   - 跨模块集成 task 在什么时候做（前后端对接 task 的时机）
   - 哪些 task 有前置依赖（后端 API 先于前端对接）
   - 风险提示——哪些 task 有不确定性、需要验证或更细粒度的技术研究

9. **自审**

   - [ ] spec 覆盖——每个 requirement 有对应实体/API/时序覆盖？
   - [ ] ER 关系验证——每个关系基数能从 spec scenario 反推？
   - [ ] 时序覆盖——正常路径 + 每类异常分支都有时序说明？
   - [ ] 项目结构已和用户对齐——项目数量、命名空间策略经用户确认？
   - [ ] 复用检查——没有重复造已有轮子？
   - [ ] 占位符扫描——无 TBD/TODO？
   - [ ] 规则合规——设计不违反引用的 6 条 rule？
   - [ ] 文档已落盘——技术设计写入 `openspec/changes/<name>/design.md`？

## 关键原则

- **产出走 OpenSpec 标准**——技术设计写入 `openspec/changes/<name>/design.md`（change 目录内，OpenSpec 标准 artifact）。不产出跨 change 的联合蓝图，不在 `docs/architecture/` 产出游离文档。per-change 自洽：design.md 自身完整，不靠跨文件引用
- **先定划分原则再设计**——按 DDD 限界上下文（聚合边界 + 业务语言），不按数据库表划分模块。项目数量和命名空间策略必须先和用户对齐
- **架构服务需求，不反过来**——设计基于 spec 和已有代码，不为臆想需求加复杂度
- **最简单够用**——YAGNI，不为未来扩展预建抽象。三分相似代码优于过早抽象
- **对齐已有模式**——不推翻现有分层/组件组织/命名约定，增量设计而非重写
- **文档化 WHY**——每个决策解释「为什么这样做」而不只是「做了什么」。ADR 是关键产出
- **全栈视角**——前后端一起设计，API 契约是共同约定，不在后端或前端单端做假设
- **只设计不实现**——产出 design.md 后交给 dev-planning 分解任务、交给 dev-dotnet/dev-vue3 编码实现
- **ER 从 spec 反推**——每个关系基数必须能从 spec scenario 中验证，不能凭空设计。实体字段从 spec 字段表中提取
- **时序覆盖异常分支**——不只画正常路径，每个时序图必须覆盖 spec 中定义的异常/边界场景
- **输出落盘**——技术设计写入 `openspec/changes/<name>/design.md`，不止在对话中输出。确保 dev-planning 和其他 agent 可引用

## 示例

### 输入
- OpenSpec change: `expand-app-management` — 扩展应用管理（应用注册、功能点树、角色管理、角色-岗位关系、应用入口）
- 现有代码：项目尚未初始化（api/ 和 app/ 为空）

### 产出
- 技术设计：`openspec/changes/expand-app-management/design.md`
- 限界上下文：App 上下文（AppRegistry 聚合根）+ 与 Position 上下文跨上下文交互
- ER 图：App 域实体 + RolePositionBinding 跨上下文引用 StandardPosition
- 核心时序：鉴权链路 App 步骤、系统标准岗位生成（跨 App↔Position）
- ADR：JWT Bearer + OIDC、Clean Architecture、Element Plus、Pinia + TanStack Query
- 构建序列：App 域梯队
- 交接说明：Task 分解建议 + 前置依赖图 + 风险提示
