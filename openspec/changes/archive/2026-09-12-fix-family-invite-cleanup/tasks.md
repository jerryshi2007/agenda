# tasks: 清理「邀请家庭成员」模块的命名缺陷与死代码

> 无 spec 变更（`skip_specs: true`），无架构决策（纯机械清理），故本变更跳过 specs 与 design 两个 artifact。

## 1. 契约层：状态值 + 错误码重命名（dev-dotnet）

- [x] 1.1 将 `openspec/contracts/family/enums.json` 中 `InvitationCodeStatus.values` 的 `Redeemed` 改为 `Revoked`，`errors.json` 中 `INVITATION_CODE_REDEEMED` 改为 `INVITATION_CODE_REVOKED`。验证：`python -c "import json; json.load(open('openspec/contracts/family/enums.json')); json.load(open('openspec/contracts/family/errors.json'))"` 无报错。

## 2. 后端：枚举 + 错误码常量 + 服务层（dev-dotnet）

- [x] 2.1 将 `api/Agenda.Api/Domain/Enums/InvitationCodeStatus.cs` 的 `Redeemed = 3` 改为 `Revoked = 3`（含注释），`api/Agenda.Api/Domain/Entities/InvitationCode.cs` 注释中 `Redeemed` 改为 `Revoked`。验证：`dotnet build api/Agenda.Api/` 通过。
- [x] 2.2 将 `api/Agenda.Api/Infrastructure/ErrorCodes.cs` 中常量 `InvitationCodeRedeemed`/`"INVITATION_CODE_REDEEMED"` 改为 `InvitationCodeRevoked`/`"INVITATION_CODE_REVOKED"`（含中文提示与 HTTP 状态两处映射）。验证：`dotnet build api/Agenda.Api/` 通过。
- [x] 2.3 将 `api/Agenda.Api/Family/Services/InvitationCodeService.cs` 中两处 `InvitationCodeStatus.Redeemed` 改为 `Revoked`，并删除死代码 `IInvitationCodeService.GetShareInfoAsync` 接口声明（`IInvitationCodeService`）与实现（`InvitationCodeService`）。验证：`dotnet build api/Agenda.Api/` 通过且无未使用警告。
- [x] 2.4 更新 `api/Agenda.Test/Family/InvitationCodeServiceTests.cs` 中 `Redeemed`/`ErrorCodes.InvitationCodeRedeemed` 断言为 `Revoked`/`ErrorCodes.InvitationCodeRevoked`（共 4 处，含测试方法名 `JoinByCodeAsync_RevokedCode_ThrowsInvitationCodeRedeemed`）。验证：`dotnet test api/Agenda.Test/ --filter "FullyQualifiedName~InvitationCode"` 通过。

## 3. 前端：契约镜像 + 邀请列表分组（dev-miniapp）

- [x] 3.1 更新 `app/miniapp/contracts/family.js`：`InvitationCodeStatus.Redeemed` → `Revoked`，`ErrorCodes`/`ErrorMessages`/`HttpStatus` 中 `INVITATION_CODE_REDEEMED` → `INVITATION_CODE_REVOKED`。验证：`cd app/miniapp-test && npx jest __tests__/contracts/family.test.js` 通过（parity 锁定）。
- [x] 3.2 更新 `app/miniapp/pages/family-invite-list/index.js` 分组键 `redeemed` → `revoked`（两处），`index.wxml` 中 `groups.redeemed` → `groups.revoked`（两处），`index.wxss` 中 `.status-redeemed` → `.status-revoked`。验证：`cd app/miniapp-test && npx jest __tests__/pages/family-invite-list.test.js` 通过。
- [x] 3.3 更新 `app/miniapp-test/__tests__/pages/family-invite-list.test.js` 中 `'Redeemed'` 状态值与 `groups.redeemed` 断言为 `'Revoked'`/`groups.revoked`。验证：`cd app/miniapp-test && npx jest __tests__/pages/family-invite-list.test.js` 通过。

## 4. 前端：死 UI + expiresAt 格式化 + 注释（dev-miniapp）

- [x] 4.1 删除 `app/miniapp/pages/family-welcome/index.wxml` 中引用 `shareInfo.targetChildName` 与 `shareInfo.targetDisplayMode` 的两段 `<view wx:if>`（`GetShareInfoResponse` 无此字段）。验证：`cd app/miniapp-test && npx jest __tests__/pages/family-welcome.test.js` 通过。
- [x] 4.2 `app/miniapp/pages/family-invite/index.js` 将 `expiresAt` 从原始 ISO 字符串格式化为本地可读时间（新增纯函数格式化，保持 `data.expiresAt` 为展示值）。验证：`cd app/miniapp-test && npx jest __tests__/pages/family-invite.test.js` 通过。
- [x] 4.3 将 `app/miniapp/services/family.js` 中 `getShareInfo` 注释「需鉴权」改为「无需鉴权」（后端端点标 `[AllowAnonymous]`）。验证：`cd app/miniapp && npm run lint` 通过。

## 5. 收尾（主代理）

- [x] 5.1 全量验证：`dotnet test api/Agenda.Test/`、`cd app/miniapp-test && npx jest`、`cd app/miniapp && npm run build` 均通过，`openspec validate fix-family-invite-cleanup` 通过。
