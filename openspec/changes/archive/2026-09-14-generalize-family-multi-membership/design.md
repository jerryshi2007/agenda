## Context

动机见 proposal.md「Why」。当前家庭模块处于单家庭与多家庭的矛盾态：数据模型与多数代码已按多家庭实现，仅 `InvitationCodeService.JoinByCodeAsync` 的加入守卫仍按单家庭实现，且 spec 措辞残留「无家庭时」前提。

技术栈与约束：.NET 10 Web API + EF Core（PostgreSQL），前端微信原生小程序；数据按家庭隔离，权限模型为每家庭独立的家长/孩子角色。

### 现状对账清单

| 现有符号/模块 | 本次处置 | 说明 |
|------|---------|------|
| `InvitationCodeService.JoinByCodeAsync` | **扩展** | 守卫从「任意家庭」改为「该家庭」，其余校验链（邀请码状态/家庭已解散/人数上限）复用不变 |
| `FamilyLifecycleService.CreateAsync` | **复用** | 已无「须无家庭」守卫，不改 |
| `FamilyLifecycleService.GetMyFamiliesAsync` / `ExitAsync` | **复用** | 已支持多家庭（返回列表 / `HasOtherFamilies`），不改 |
| `FamilyMember` 数据模型 | **复用** | 唯一索引 `(FamilyId, UserId)` 已支持跨家庭，无 DB 变更 |
| `UserRole` 枚举与权限判定（40 处） | **复用** | 家长/孩子每家庭独立角色保持不变，不动 |
| `USER_ALREADY_IN_FAMILY` 契约 | **复用** | 文案「你已是该家庭成员」在修复后语义吻合，零改动 |
| `InvitationCodeServiceTests` | **扩展** | 补多家庭加入用例 |
| 前端 `mine` / `family-switch` / `family-welcome` | **复用** | 已提供创建/加入/切换入口，零改动 |

## Goals / Non-Goals

**Goals:**

- 使「一人多家庭」在加入路径上行为一致：已属于其他家庭的用户可通过有效邀请码加入新家庭。
- 消除 spec 中残留的单家庭措辞，使 spec 与数据模型、代码一致。

**Non-Goals:**

- 不改家庭命名（不引入「小组/团队」等新概念）。
- 不动权限模型（家长/孩子每家庭独立角色保持）。
- 不引入标签/角色泛化系统（留待后续路线图）。
- 不做任何 DB migration。

## Decisions

### Decision 1: 加入守卫从「任意家庭」改为「该家庭」

将 `JoinByCodeAsync` 中：

```csharp
// 改前
var alreadyInFamily = await _db.FamilyMembers
    .AnyAsync(m => m.UserId == userId && m.IsDeleted == false, ct);
```

改为：

```csharp
// 改后
var alreadyInFamily = await _db.FamilyMembers
    .AnyAsync(m => m.FamilyId == family.Id && m.UserId == userId && m.IsDeleted == false, ct);
```

- **理由**：数据模型唯一索引是 `(FamilyId, UserId)`，跨家庭重复成员关系天然合法；单家庭守卫与 `GetMyFamilies` 返回列表、`ExitAsync` 返回 `HasOtherFamilies` 自相矛盾。
- **备选方案 A**：保留单家庭守卫，反向收敛其余多家庭痕迹（改 `GetMyFamilies`、删切换页）。否决——多家庭是既定产品意图（spec 已有「多家庭切换」需求），反向收敛破坏已上线功能。
- **备选方案 B**：引入显式的「当前家庭」概念重写加入逻辑。否决——过度设计，数据模型已天然支持，无需额外状态。
- 该守卫修复后 `USER_ALREADY_IN_FAMILY` 错误码语义回归文案本义「已在该家庭」，契约零改动。

### Decision 2: CreateAsync 保持无守卫

现状 `CreateAsync` 已允许任意用户创建多个家庭，无需新增守卫。多家庭语义下「创建」与「加入」对称放开，仅通过 spec 措辞对齐。

### Decision 3: 契约零改动

`USER_ALREADY_IN_FAMILY` 文案「你已是该家庭成员」在 Decision 1 修复后正好吻合（只拦「该家庭」），无需改 `contracts/family/errors.json`。无新增错误码、无 DTO 变更。

## Risks / Trade-offs

- **[同家庭重复加入]** → 已由修复后的守卫 + `(FamilyId, UserId)` 唯一索引双层兜底拦截。
- **[退出/解散跨家庭误删]** → `ExitAsync` / `RemoveMemberAsync` 均按 `(familyId, userId)` 精确定位成员关系，用户退出某家庭不影响其在其他家庭的成员关系；已正确隔离。
- **[加入第二个家庭后的跳转]** → 前端 `family-join` 页加入成功后的跳转目标需确认：已有家庭的用户应留在当前家庭、新家庭进「切换家庭」列表，而非强制切走。此为验证项，非阻塞（前端零改动是本次目标，若发现跳转不理想另行跟进）。

## Migration Plan

无 DB 变更，无需 migration。仅修改 `InvitationCodeService.cs` 一处守卫逻辑 + 补充测试 + 收敛 spec 措辞，可独立回滚（守卫改动是纯逻辑，回退即恢复单家庭行为）。

## Open Questions

（无。本次范围已收敛，无影响 spec/方案/任务拆解的未决问题。）
