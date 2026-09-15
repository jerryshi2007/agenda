## Context

动机见 proposal.md - Why。当前实现状态（已探查确认）：

- 后端「家庭上下文」有两份重复实现，且都**不读 `X-Family-Id`**：
  - `FamilyContextService.GetFamilyContextAsync`（[FamilyContextService.cs](api/Agenda.Api/Schedule/Services/FamilyContextService.cs)）用 `FirstOrDefault(fm => fm.UserId == userId && fm.User.Status == Active)` 取「第一条」成员记录。
  - `ControllerExtensions.GetFamilyContextAsync`（[ControllerExtensions.cs](api/Agenda.Api/Shared/Extensions/ControllerExtensions.cs)）用 `FirstOrDefault(fm => fm.UserId == userId)`，不过滤 Active。
- 四个家庭作用域 Controller 全部走 `IFamilyContextService`：`ScheduleController`、`CalendarController`、`TemplateController`、`ChildScheduleController`。全仓仅 `FamilyController` 读取 `X-Family-Id`（`EnsureFamilyContext` 校验路径参数与 header 一致）。
- 前端已完整实现「当前家庭」链路：`CURRENT_FAMILY_ID`（[storage-keys.js](app/miniapp/utils/storage-keys.js)）→ [api.js](app/miniapp/services/api.js) 注入 `X-Family-Id` → `family-switch` 切换后 `reLaunch`。

### 现状对账清单

| 符号 / 文件 | 处置 | 说明 |
|---|---|---|
| `FamilyContextService.GetFamilyContextAsync` | 扩展 | 签名改为接受目标 `familyId`，校验成员资格后返回 `(familyId, role)` |
| `IFamilyContextService` | 扩展 | 接口签名同步 |
| `ControllerExtensions.GetFamilyContextAsync` | 移除 | 与 `FamilyContextService` 重复；统一收敛，调用方改走 `IFamilyContextService` |
| `ScheduleController` | 扩展 | 读 header，传 `familyId` |
| `CalendarController` | 扩展 | 读 header，传 `familyId` |
| `TemplateController` | 扩展 | 读 header，传 `familyId` |
| `ChildScheduleController` | 扩展 | 读 header，传 `familyId`；保留 `AssignedMemberId == CurrentUserId` 过滤 |
| `FamilyController.GetFamilyIdFromHeader` | 复用 | 私有 header 解析上收为共享扩展，供四 Controller 复用 |
| `services/api.js` | 复用 | 已注入 `X-Family-Id`，不改 |
| `app.js refreshFamilyContext` | 扩展 | 启动时 `CURRENT_FAMILY_ID` 为空则补写合法家庭 |
| `family-members` / `family-restore` | 扩展 | 退出/解散后 `CURRENT_FAMILY_ID` 被移除时兜底跳转 |
| `openspec/contracts/family/errors.json` | 扩展 | 新增 `FAMILY_CONTEXT_REQUIRED`；复用 `FAMILY_NOT_FOUND` / `NOT_FAMILY_MEMBER` |

## Goals / Non-Goals

**Goals:**

- 家庭作用域端点按 `X-Family-Id` 解析当前家庭并校验成员资格，切换家庭后只返回当前家庭数据。
- 消除两份重复的家庭上下文解析实现。

**Non-Goals:**

- 不引入后端「当前家庭」持久化——「当前家庭」仍是单设备 UX 状态（多设备各自独立），由 `CURRENT_FAMILY_ID` + header 表达。
- 不做「跨家庭聚合视图」（家长一个视图看所有家庭）——违反数据按家庭隔离，属另一功能。
- 不改动 `family-lifecycle` 的创建/退出/解散等既有需求。

## Decisions

**D1：header 解析落在 Controller，`FamilyContextService` 保持纯函数**

- Controller 通过共享扩展 `GetFamilyIdFromHeader()` 解析 `X-Family-Id`，把 `Guid? familyId` 传入 `GetFamilyContextAsync(userId, familyId, ct)`。
- 理由：Service 不依赖 `HttpContext`，保持可单测、可替换；与现有 `FamilyController.GetFamilyIdFromHeader` 的语义一致。
- 备选（已否决）：Service 内用 `IHttpContextAccessor` 直接读 header——引入隐式依赖，测试需构造 HttpContext，违背现有「Controller 组装上下文」的分层。

**D2：`GetFamilyContextAsync(userId, familyId, ct)` 的解析语义**

| header | 用户成员记录 | 结果 |
|---|---|---|
| 有，且是成员 | 任意 | 返回 `(familyId, role)` |
| 有，非成员 | 任意 | 抛「家庭不存在」→ 404 `FAMILY_NOT_FOUND`（不泄露存在性） |
| 无 | 0 条 | 抛「非家庭成员」→ 403 `NOT_FAMILY_MEMBER` |
| 无 | 1 条 | 回退到该唯一家庭 |
| 无 | ≥2 条 | 抛「需指定家庭」→ 400 `FAMILY_CONTEXT_REQUIRED` |

- 理由：覆盖单家庭老用户（`CURRENT_FAMILY_ID` 从未写入）与多家庭退出后 header 为空的窗口期，且不静默回退到任意家庭。
- 校验复用现有 `User.Status == Active` 过滤（保留 `FamilyContextService` 版语义；`ControllerExtensions` 版缺此过滤，属本次要消除的偏差）。

**D3：header 指向非成员家庭 → 404 `FAMILY_NOT_FOUND`**

- 理由：与 `FamilyController.EnsureFamilyContext` 的 404 策略一致，避免泄露家庭存在性（403 会暗示「存在但你无权」）。
- 备选（已否决）：403 `NOT_FAMILY_MEMBER`——语义上「你不是该家庭成员」仍暴露了家庭存在。

**D4：孩子端同样按 header 解析家庭**

- `ChildScheduleController` 沿用 header 解析，同时保留 `AssignedMemberId == CurrentUserId` 的成员级过滤，两者叠加（家庭维度 + 成员维度）。
- 理由：孩子也属于多家庭；孩子切家庭后只看当前家庭自己的日程（spec 场景「孩子端切换家庭」）。

**D5：合并两份 `GetFamilyContextAsync`**

- 统一保留在 `IFamilyContextService`；删除 `ControllerExtensions.GetFamilyContextAsync`，其调用方改注入 `IFamilyContextService`。
- 理由：两份实现过滤条件不一致（是否过滤 Active），是多家庭场景下另一处隐患；单一实现消除漂移。

**D6：前端 bootstrapping 保证 header 恒有效**

- `app.js`：登录后 / `refreshFamilyContext` 内，若 `CURRENT_FAMILY_ID` 为空且 `getMyFamilies()` 返回 ≥1 家庭，写入首项作为兜底（覆盖单家庭与首次登录）。
- 退出/解散流程（`family-members` / `family-restore`）：移除 `CURRENT_FAMILY_ID` 后，若 `HasOtherFamilies` 为真，跳转 `family-switch` 引导用户显式选择，而非停留在无上下文状态。
- 理由：把「无 header」从后端错误路径前移到前端已消解，后端 400 `FAMILY_CONTEXT_REQUIRED` 仅作防御性兜底。

## Risks / Trade-offs

- [R] 多家庭用户退出当前家庭后，若未及时补写 header，请求被 400 拒绝 → [M] D6 在退出流程跳转 `family-switch`；后端 400 仅兜底。
- [R] `CURRENT_FAMILY_ID` 残留指向已退出/已解散家庭 → [M] D3 返回 404，前端捕获后清空并引导重选（沿用 `family-switch` 的「已不在该家庭中」处理）。
- [R] 改动四个 Controller + 一份共享 Service，回归面大 → [M] 后端先补 `FamilyContextService` 单测（多家庭/越权/缺失 header/单家庭回退），再逐 Controller 改造并跑全量 `dotnet test`。
- [R] 删除 `ControllerExtensions.GetFamilyContextAsync` 可能影响未发现调用方 → [M] 改造前 codegraph 查全量调用方，逐一迁移。

## Migration Plan

1. 后端先改 `FamilyContextService` + 契约 errors.json，补单测（不发布）。
2. 逐 Controller 读 header 并迁移调用方，删除 `ControllerExtensions` 重复实现。
3. 前端补 bootstrapping 与退出兜底。
4. 全量 `dotnet test` + `npx jest`，通过后单次提交（feat/fix 类型）。

回滚策略：改动集中在 `FamilyContextService` 签名与四 Controller，可单次 `git revert` 回滚；无数据库迁移、无破坏性 API 变更（header 为新增约定，旧客户端缺 header 时走 D2 的回退/拒绝路径，单家庭用户行为不变）。
