# Proposal: 家庭多成员归属（generalize-family-multi-membership）

## Why

现有家庭模块中，「一个用户属于多个家庭」已是既定的产品意图，在多处确立：`family-lifecycle` 的「多家庭切换」需求 SHALL 允许属于多个家庭的用户切换家庭，后端 `GetMyFamiliesAsync` 返回家庭列表、`ExitFamilyResponse.HasOtherFamilies` 显式建模多家庭、数据模型 `FamilyMember` 的唯一索引为 `(FamilyId, UserId)`（天然支持跨家庭）。但 `InvitationCodeService.JoinByCodeAsync` 的加入守卫仍按单家庭实现——「用户已在**任意**家庭（active）则拒绝加入」，导致已属于一个家庭的用户无法通过邀请码加入第二个家庭。同时 `family-lifecycle`「创建家庭」与 `family-invite`「邀请码加入」的 spec 措辞仍残留「无家庭时」的单家庭前提。三处互相矛盾，需收敛为一致的多家庭模型。

本次变更仅开放「一人多家庭」，不改家庭命名、不动权限模型（家长/孩子每家庭独立角色保持不变）、不引入标签系统（留待后续路线图）。

## What Changes

- **放宽加入守卫**：`InvitationCodeService.JoinByCodeAsync` 从「已在任意家庭（active）则拒绝」改为「已在该家庭则拒绝」，允许已属于其他家庭的用户通过有效邀请码加入新家庭。`USER_ALREADY_IN_FAMILY` 错误码语义回归其文案本义「你已是该家庭成员」，契约文案零改动。
- **创建家庭保持无守卫**：`FamilyLifecycleService.CreateAsync` 现状已无「用户须无家庭」守卫（可创建多个家庭），本次不改动代码，仅通过 spec 措辞对齐语义。
- **spec 措辞收敛**：
  - `family-lifecycle`「创建家庭」去掉「无家庭时」前提（MODIFIED）。
  - `family-invite`「邀请码加入」去掉「用户无家庭」前提、补「已在其他家庭也可加入」场景（MODIFIED）。
- **前端零改动**：`mine` 页已提供「创建家庭」「加入家庭」入口（未按家庭数隐藏），`family-switch` 页已支持多家庭切换，`family-welcome` 首启引导对已有家庭用户自动跳转、行为正确。
- **测试补充**：`InvitationCodeServiceTests` 补「用户在家庭 A、用邀请码加入家庭 B 成功」与「用户已在该家庭、重复加入报 `USER_ALREADY_IN_FAMILY`」。

## Capabilities

### New Capabilities

（无。本次是对已归档家庭模块的存量一致性收敛，不引入新领域能力。）

### Modified Capabilities

- `family-invite`: 「邀请码加入」要求从「用户无家庭」放宽为「允许已属于其他家庭的用户加入」，仅拦截「已在该家庭」的重复加入。
- `family-lifecycle`: 「创建家庭」要求去掉「无家庭时」前提，允许已有家庭的用户创建新家庭。

## Impact

**受影响代码路径**：

| 路径 | 变更类型 | 说明 |
|------|---------|------|
| `api/Agenda.Api/Family/Services/InvitationCodeService.cs` | 修改 | `JoinByCodeAsync` 守卫从「任意家庭」改为「该家庭」（`m.FamilyId == family.Id && m.UserId == userId && !m.IsDeleted`） |
| `api/Agenda.Test/Family/InvitationCodeServiceTests.cs` | 补充 | 新增「跨家庭加入成功」与「同家庭重复加入被拦截」用例 |
| `openspec/specs/family-invite/spec.md` | delta | 「邀请码加入」场景放宽为多家庭 |
| `openspec/specs/family-lifecycle/spec.md` | delta | 「创建家庭」去掉「无家庭时」前提 |

**API 端点变更**：仅 `POST api/v1/families/join-by-code` 的守卫放宽（允许跨家庭加入），无路由、无 DTO 变更，无破坏性变更。

**性能影响**：无。守卫从「按 UserId 查任意家庭」改为「按 FamilyId + UserId 查该家庭」，查询复用现有 `(FamilyId, UserId)` 唯一索引，代价相当。

**安全影响**：无收紧。加入仍保留完整的邀请码状态校验（待使用/已使用/已撤销/已过期）、家庭已解散拦截、家庭人数上限（10 人）校验；仅放开「跨家庭加入」这一条，成员隔离与权限模型不变。

**迁移保证**：无 DB 变更，无需 migration。`FamilyMember` 唯一索引 `(FamilyId, UserId)` 无需改动。
