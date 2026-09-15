# proposal: 清理「邀请家庭成员」模块的命名缺陷与死代码

## Why

「邀请家庭成员」模块主干已完整落地（`add-family-module` 已归档，需求真相源见 [openspec/specs/family-invite/spec.md](../../specs/family-invite/spec.md)），但代码与契约层残留 5 处「能用但没擦干净」的问题：

1. 邀请码状态枚举用 `Redeemed`（英义「已兑换/已使用」）表达「已撤销」，与 `Used` 语义撞车，误导维护者；
2. `IInvitationCodeService.GetShareInfoAsync` 是死代码，且与 `ShareService` 的分享逻辑分叉；
3. 分享确认页引用了响应中不存在的字段，死 UI；
4. `expiresAt` 裸显 ISO 时间戳；
5. `get-share-info` 端点鉴权标注与实现不符。

这些问题不阻塞功能，但会随时间累积技术债——尤其 `Redeemed` 的语义冲突会让任何读代码的人把「已撤销」理解成「已使用」。趁模块刚归档、无存量依赖时一次性清干净。

## What Changes

- **重命名邀请码状态与错误码，消除语义冲突**
  - `InvitationCodeStatus.Redeemed` → `Revoked`（四态 `Pending / Used / Revoked / Expired`）。存储走 `HasConversion<int>()`，整数值 `3` 不变，**无 DB 迁移**。
  - 错误码 `INVITATION_CODE_REDEEMED` → `INVITATION_CODE_REVOKED`（**BREAKING**：对外契约错误码字符串变更；项目预发布、无存量客户端，安全）。
  - 前端邀请列表的内部分组键 `redeemed` 与 CSS 类 `status-redeemed` 一并改为 `revoked` / `status-revoked`，避免同一语义继续以错误英文出现。
- **删除死代码**：`IInvitationCodeService.GetShareInfoAsync` 声明与实现（控制器实际走 `ShareService.GetShareInfoAsync`，两者返回结构不同、已分叉）。
- **删除死 UI**：`family-welcome` 确认页引用 `targetChildName` / `targetDisplayMode` 的两行（`GetShareInfoResponse` 无此字段，`wx:if` 永不成立）。
- **格式化 `expiresAt`**：邀请码展示页将原始 ISO 时间戳格式化为友好本地时间。
- **修正鉴权标注**：`get-share-info` 端点后端标 `[AllowAnonymous]`，前端 `family.js` 注释「需鉴权」改为「无需鉴权」。

## How

纯机械性清理，无新功能、无架构变更、无数据迁移。

- 重命名在「后端 enum + 错误码常量 → contracts JSON（enums/errors）→ 前端契约镜像 → 测试断言」四层同步进行；前端 `contracts/family.test.js` 的 parity 测试持续锁定镜像与 contracts JSON 的一致性。
- 死代码 / 死 UI 直接删除，对外行为不变（字段本就永不渲染、方法本就无人调用）。
- 由 `dev-dotnet`（后端 + 契约）与 `dev-miniapp`（前端镜像 + 页面）各自承担，无跨模块新依赖。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——本变更不改变任何 spec 级需求行为。spec.md 中「已撤销」的中文表述本就正确，问题只在代码/契约层的英文命名 `Redeemed` 与之不符。故本变更 `skip_specs: true`，不产出 delta spec。）

## Impact

- **后端**：`Domain/Enums/InvitationCodeStatus.cs`、`Domain/Entities/InvitationCode.cs`（注释）、`Family/Services/InvitationCodeService.cs`（2 处引用 + 删死方法）、`Infrastructure/ErrorCodes.cs`（常量/中文提示/HTTP 状态）
- **契约**：`openspec/contracts/family/enums.json`、`errors.json`
- **前端**：`app/miniapp/contracts/family.js`（镜像）、`pages/family-invite-list/`（分组键 + WXML + WXSS）、`pages/family-welcome/index.wxml`（删死 UI）、`pages/family-invite/index.js`（expiresAt 格式化）、`services/family.js`（注释）
- **测试**：`InvitationCodeServiceTests.cs`、`family-invite-list.test.js`、前端契约 parity 测试断言更新
- **API 兼容**：错误码 `INVITATION_CODE_REDEEMED` → `INVITATION_CODE_REVOKED` 为 BREAKING，但项目预发布、无存量客户端。
