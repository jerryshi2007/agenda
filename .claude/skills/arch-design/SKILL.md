---
name: arch-design
description: 全栈架构设计——覆盖 .NET 后端分层/API 契约 + Vue 3 前端组件树/路由/状态管理，产出 design.md + ADR。
rules: [dev-dotnet-standards, dev-vue3-standards, design-ui-standards, dev-code-quality, dev-security, openspec-workflow, dev-contracts]
---

# arch-design · 全栈架构设计

## 何时使用

非平凡需求确认后、编码前。跳过：纯单模块小改动、纯 UI 调整、纯 bug 修复。

## 流程

### 1. Read 规则（7 条）
dev-dotnet-standards / dev-vue3-standards / design-ui-standards / dev-code-quality / dev-security / openspec-workflow / dev-contracts

### 2. 理解需求
读 proposal.md + delta specs → 提取功能/非功能需求 + 跨切面关注点

### 3. 现状分析
探查 api/ + app/（小程序）+ web/（Web 应用）已有代码 → 标注可复用/扩展/新建。不推翻现有模式，增量设计。

### 4. 确定划分原则（DDD 限界上下文）
- 从 spec 识别聚合根（哪些实体一起变、一起保证一致性？）
- 识别限界上下文（共享业务语言、通过 ID 弱引用跨上下文）
- 上下文通常 4-8 个，过细则按表划分失去聚合意义
- ⚠️ 用 AskUserQuestion 确认：项目数量 / 命名空间策略 / 数据库策略

### 5. 架构设计（三线并行）

**后端（.NET）：**
- 分层与模块边界、ER 图（实体+字段要点+关系基数+级联规则+唯一性约束）
- API 契约轮廓（端点+DTO 形状+错误码+分页）、认证授权方案
  - **提取共享常量**：将 API 契约中的枚举值、错误码、DTO 结构提取为 `openspec/contracts/<domain>/` 下的机器可读 JSON（enums.json、errors.json、dto.json），格式遵循 `dev-contracts` rule
- 数据访问策略（EF Core 实体关系、仓储边界、迁移策略）
- 跨上下文交互规则（ID 引用 vs Service 接口调用）

**前端（Vue 3）：**
- 组件树与路由结构、状态管理方案（Pinia store 划分）
- API 对接层（axios 封装、请求取消、错误拦截）
- UI 框架对齐（Element Plus / Ant Design Vue 选型、主题 token 映射）

**跨切面：**
- API 契约形状（前后端共同约定）、数据流方向、错误处理策略
- 认证流（登录→token→刷新→401→登出，整链路）

### 6. ADR 决策记录
对关键决策出具 ADR，格式：Context / Decision / Consequences（Positive + Negative）/ Alternatives Considered / Status / Date。至少覆盖：认证授权方案、分层架构选择、UI 框架选型、状态管理策略。

### 7. 输出 design.md
采用 OpenSpec 标准 4 节骨架（Context / Goals-NonGoals / Decisions / Risks-Trade-offs），架构细节作为 Decisions 子节扩展。必须包含：
- 需求摘要 + 限界上下文划分 + 项目结构
- ADR 决策记录
- ER 图（每个关系可从 spec scenario 反推）
- API 契约轮廓 + 前端架构 + 核心时序图（正常路径+异常分支）
- 构建序列 + 风险与权衡

### 8. 生成实现任务
调用 `arch-planning` skill（基于 design.md 拆解为 bite-sized tasks），产出 `openspec/changes/<name>/tasks.md`。交接 dev-dotnet + dev-miniapp：
说明：模块→task 映射、集成 task 时机、前置依赖、风险提示

### 9. 自审
- [ ] spec 覆盖 / ER 可反推 / 时序完整 / 项目结构已对齐
- [ ] 复用检查 / 无 TBD/TODO / 规则合规 / 文档已落盘

## 关键原则

- **产出走 OpenSpec 标准**：per-change 自洽，不产出跨 change 联合蓝图
- **先定划分原则再设计**：按 DDD 限界上下文，不按数据库表划分
- **架构服务需求**：基于 spec 和已有代码，不为臆想需求加复杂度
- **YAGNI**：三分相似代码优于过早抽象
- **对齐已有模式**：增量设计，不重写
- **文档化 WHY**：每个决策解释"为什么"，ADR 是关键产出
- **全栈视角**：前后端一起设计，API 契约是共同约定
- **ER 从 spec 反推**：每个关系基数必须能从 spec scenario 验证
- **时序覆盖异常分支**：不只画正常路径
- **只设计不实现**：产出 design.md + tasks.md 后交接 dev-dotnet + dev-miniapp