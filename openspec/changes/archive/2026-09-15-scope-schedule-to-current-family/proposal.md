## Why

`generalize-family-multi-membership`（一人多家庭）开放后，前端已建立「当前家庭」真相源：`CURRENT_FAMILY_ID` → `X-Family-Id` 请求头 → `family-switch` 切换页，切换家庭后 `reLaunch` 重新拉取。但后端日程、模板、日历、孩子端四组端点仍通过 `FamilyContextService.GetFamilyContextAsync` 用 `FirstOrDefault(userId)` 取「第一条」成员记录，完全忽略 `X-Family-Id` header（全仓仅 `FamilyController` 读取该 header）。结果是切换家庭后，日历/日程/模板仍返回最早加入的那个家庭的数据，与「数据按家庭隔离」「只看当前家庭的日程」的产品语义相悖。

本变更为 multi-membership 遗留的 bug 修复，无独立 staging 需求目录；需求真相源为 [openspec/specs/family-lifecycle/spec.md](../../specs/family-lifecycle/spec.md)（多家庭切换）。

## What Changes

- 后端家庭作用域端点（日程/模板/日历/孩子端）改为按 `X-Family-Id` header 解析当前家庭，不再取「第一条」成员记录。
- `FamilyContextService.GetFamilyContextAsync` 改为接受目标 `familyId`：校验当前用户确为该家庭成员后返回 `(familyId, role)`，未校验通过 MUST NOT 返回数据。
- header 缺失时：用户仅一条成员记录则回退到该家庭；多条则拒绝请求（不静默回退到任意家庭）。
- header 指向用户非成员家庭：返回 404（复用 `FAMILY_NOT_FOUND`，不泄露家庭存在性）。
- 合并两份重复的 `GetFamilyContextAsync`（`FamilyContextService` 与 `ControllerExtensions`）。
- 前端启动 / 退出家庭后，若 `CURRENT_FAMILY_ID` 为空但用户仍有 ≥1 家庭，自动补写合法家庭，保证家庭作用域请求始终携带合法 header。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `family-lifecycle`: 新增「家庭上下文隔离」需求——家庭作用域端点（日程/模板/日历/孩子端）MUST 按当前家庭（`X-Family-Id`）隔离，切换家庭后只返回当前家庭的数据。

## Impact

- 后端：`FamilyContextService`、`ScheduleController`、`CalendarController`、`TemplateController`、`ChildScheduleController`、`ControllerExtensions`。
- 前端：`app.js`（启动补写）、`family-members` / `family-restore`（退出/解散后的兜底）。
- 契约：`openspec/contracts/family/errors.json`（复用 `FAMILY_NOT_FOUND` / `NOT_FAMILY_MEMBER`）。
- 测试：后端多家庭解析 / 越权 / 缺失 header 测试 + 前端 header 注入与 bootstrapping 测试。
