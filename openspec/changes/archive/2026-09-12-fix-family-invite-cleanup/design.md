# design: 清理「邀请家庭成员」模块

## Context

动机见 [proposal.md](./proposal.md)。本变更为纯机械清理：状态/错误码重命名 + 删死代码/死 UI + 一处 UX 格式化。无新功能、无新依赖、无数据迁移。

## 现状对账清单

| 文件 | 处理 | 说明 |
|------|:--:|------|
| `api/Agenda.Api/Domain/Enums/InvitationCodeStatus.cs` | 修改 | `Redeemed` → `Revoked`（整数值 3 不变） |
| `api/Agenda.Api/Domain/Entities/InvitationCode.cs` | 修改 | 注释同步 |
| `api/Agenda.Api/Infrastructure/ErrorCodes.cs` | 修改 | 常量/中文提示/HTTP 状态三处同步 |
| `api/Agenda.Api/Family/Services/InvitationCodeService.cs` | 修改+删除 | 2 处引用改名；删 `GetShareInfoAsync` 死代码 |
| `openspec/contracts/family/enums.json` / `errors.json` | 修改 | 契约真相源 |
| `app/miniapp/contracts/family.js` | 修改 | 镜像同步（parity 测试锁定） |
| `app/miniapp/pages/family-invite-list/*` | 修改 | 分组键 `redeemed`→`revoked` + CSS 类 |
| `app/miniapp/pages/family-welcome/index.wxml` | 删除 | 2 段死 UI |
| `app/miniapp/pages/family-invite/index.js` | 修改 | expiresAt 本地化 |
| `app/miniapp/services/family.js` | 修改 | 注释修正 |
| 测试（`InvitationCodeServiceTests.cs`、`family-invite-list.test.js`） | 修改 | 断言同步 |

无「新建」文件，无「扩展」既有实体字段——纯重命名与删除，不改任何数据结构与行为。

## Goals / Non-Goals

- **Goals**：消除 `Redeemed`/「已撤销」的语义冲突；移除死代码与死 UI；`expiresAt` 可读化；鉴权标注对齐。
- **Non-Goals**：不改邀请码业务规则（6 位 2-9、24h 有效、一次性）；不改任何 spec 需求；不处理「分享卡片被未登录用户打开」的登录态边界（spec 场景本就写「用户已登录无家庭」，留待独立变更）。

## Decisions

### D1：重命名枚举值 `Redeemed` → `Revoked`，不动整数值

`InvitationCodeStatus` 经 `HasConversion<int>()` 存整型，`Revoked = 3` 与 `Redeemed = 3` 落库一致，**无需 EF 迁移**。重命名是编译期安全的重构，全量 `dotnet build` + parity 测试即可锁定无遗漏。

- 备选：保留 `Redeemed` 仅改注释 —— 否决，注释无法消除阅读时的语义误导。
- 备选：引入真正的 `Revoked` 并废弃 `Redeemed`（双值并存）—— 否决，YAGNI，纯增复杂度。

### D2：错误码 `INVITATION_CODE_REDEEMED` → `INVITATION_CODE_REVOKED`，接受 BREAKING

错误码是 `openspec/contracts/family/errors.json` 的对外契约值。改名属 BREAKING，但项目预发布、无存量客户端，且与 D1 语义修复一致。同步改前端镜像，靠 parity 测试兜底。

### D3：前端分组键 `redeemed` → `revoked`

`family-invite-list` 的 `groups.redeemed` 与 CSS `.status-redeemed` 是内部命名，但同样在传递「redeemed = 撤销」的错误语义，一并改掉，避免清理不彻底。

### D4：死代码/死 UI 直接删除，而非「修复」

`GetShareInfoAsync`（`IInvitationCodeService`）无人调用、与 `ShareService` 返回结构不同；`family-welcome` 的 `targetChildName`/`targetDisplayMode` 字段不存在于 `GetShareInfoResponse`。二者均为死物，删除优于修复。

### D5：`expiresAt` 格式化用页面内纯函数，不抽共享 util

当前仅一处使用，抽 `utils/` 共享函数违反 YAGNI。在 `family-invite/index.js` 内加纯函数将 ISO 字符串转本地可读时间即可。

## Risks / Trade-offs

- [错误码改名若遗漏某端引用，parity/编译会暴露] → 靠 `dotnet build` + 前端 parity 测试 + 全量 `npx jest` 三重验证兜底。
- [BREAKING 错误码变更若有隐藏存量依赖] → 项目预发布、无客户端，且 grep 已穷举 `INVITATION_CODE_REDEEMED` 全部引用点，无遗漏。

## Migration Plan

无数据库迁移（枚举整数值不变）。代码合入后按 `.claude/rules/git-commit.md` 一事一提交（`refactor: 重命名邀请码状态 Redeemed→Revoked` / `chore: 删除邀请码模块死代码与死 UI` 分开提交）。

## Open Questions

（无）
