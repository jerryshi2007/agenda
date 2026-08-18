# 家庭管理模块 · 架构设计审核报告

## 审核依据

- 需求真相源：`production/staging/2026-08-18-家庭/requirement.md` + `epic-story.md`
- 待审设计：`openspec/changes/add-family-module/design.md` + `tasks.md` + `contracts/` + `specs/`
- 规则：`.claude/rules/dev-contracts.md` + `.claude/rules/dev-dotnet-standards.md` + `.claude/rules/dev-code-quality.md` + `.claude/rules/dev-codegraph.md`

---

## 11 维度审核总览

| # | 维度 | 审核结果 | 严重度 |
|---|------|----------|--------|
| 1 | 需求覆盖 | ✅ 全部 Must 需求已覆盖，5 项补充边界均落实 | 阻塞 |
| 2 | ER 关系可反推 | ✅ 关系基数明确，均可从 spec scenario 反推 | 阻塞 |
| 3 | 时序完整 | ✅ 正常路径 + 所有异常/边界分支均覆盖，权限检查完整 | 阻塞 |
| 4 | ADR 充分 | ✅ 3 项关键决策均有完整 ADR（Context/Decision/Alternatives/Consequences） | 阻塞 |
| 5 | 规则合规 | ✅ 未违反任何规则，命名/契约/质量均符合要求 | 阻塞 |
| 6 | 质量底线 | ✅ 无 TBD/TODO，复用充分，风险识别完整 | 阻塞 |
| 7 | 限界上下文合理 | ✅ 三个上下文划分清晰，聚合根识别正确 | 建议 |
| 8 | API 契约完整 | ✅ 端点覆盖完整，contracts JSON 齐全且与设计一致，错误码全覆盖 | 阻塞 |
| 9 | 前端架构对齐 | ✅ 路由表完整，状态管理合理，对齐项目技术栈 | 建议 |
| 10 | 构建序列可行 | ✅ 依赖顺序正确，无循环依赖，前后端集成时机合理 | 建议 |
| 11 | 现状对账完整 | ✅ 对账清单完整，抽查 3 项与实际代码一致 | 阻塞 |

---

## 问题清单

### 阻塞问题

**无** — 所有阻塞级检查点均已通过。

### 建议问题

| 序号 | 问题 | 说明 |
|---|------|------|
| 1 | 状态记忆存储结构不明确 | 需求要求"每个家庭独立记忆上次视图/日期/筛选状态"，设计决策存储在前端本地缓存，但未明确具体存储哪些字段、存储结构如何。建议补充说明存储格式（如 `family-{id}-state` 存储 `{view, date, filter}`）。 |
| 2 | InvitationCode 过期状态转换时机不明确 | 设计中邀请码过期是 24h，但未说明状态从 `Pending` 变为 `Expired` 是在查询时动态判断，还是由定时任务批量更新。两种方案各有利弊，建议明确：推荐查询时动态判断过期（实现简单，不会有批量更新延迟）。 |
| 3 | ADR 缺 UI 框架决策 | arch-review 要求至少 4 类决策（认证/分层/UI框架/状态管理），本次只记录了 3 项。由于项目本就是微信原生小程序技术栈，前端已约定使用原生组件，此缺失不影响开发，仅建议补全 ADR 说明确认沿用既有约定。 |

### 疑问

**无** — 设计清晰，无需要用户决策的分歧点。

---

## 对账抽查结果

抽查 design.md 现状对账清单与实际代码一致性：

| 对账项 | design 声称 | 实际代码 | 一致性 |
|--------|-------------|----------|--------|
| `Family` 实体 | 已有 `Id/Guid, Name/string, CreatedAt/DateTimeOffset`，本次需要**扩展** | 当前 `Family.cs` 确实只有这三个字段，缺少 `CreatorId/Status/DissolvedAt` | ✅ 一致 |
| `FamilyMember` 实体 | 已有 `Id/FamilyId/UserId/Role/JoinedAt`，本次需要**扩展** | 当前 `FamilyMember.cs` 确实只有这些字段，缺少 `ChildName/DisplayMode/IsDeleted/DeletedAt` | ✅ 一致 |
| `IFamilyContextService` | 已实现，需要**复用 + 扩展**适配多家庭 | 服务已存在，当前实现只支持单家庭查询，确实需要扩展 | ✅ 一致 |
| `Schedule.FamilyId` | 已有外键，**复用** | 已有预留外键 | ✅ 一致 |

**结论：** 对账清单真实准确，符合 `dev-codegraph` rule 要求。

---

## 三判决

| 维度 | 判决 |
|------|------|
| **设计质量** | ✅ 合格 |
| **规则合规** | ✅ 合规 |
| **审批建议** | ✅ 建议批准 |

---

## 审核备注

本次架构设计整体质量很高：
1. 需求覆盖完整，所有 Must 功能和 5 项补充边界都有对应设计
2. 现状对账真实准确，增量设计清晰，不破坏现有代码
3. API 契约完整，contracts JSON 与设计一致，符合 `dev-contracts` rule
4. tasks 拆解清晰，16 个 tasks 与 11 个 Story 一一对应，无遗漏，依赖顺序合理，每个 task 都有明确产出和完成标准，无占位符
5. 异常场景覆盖全面，所有需求中的边界情况都有对应的错误码和处理逻辑

建议问题都是细节完善，不阻塞研发启动，可以在研发过程中一并调整。

---

**审核日期**：2026-08-18
**审核人**：arch-architect-reviewer
