## 1. 契约与错误码（dev-dotnet）

- [x] 1.1 在 `openspec/contracts/family/errors.json` 新增 `FAMILY_CONTEXT_REQUIRED`（`httpStatus: 400`，`message: "请选择家庭"`），并在 `api/Agenda.Api/Infrastructure/ErrorCodes.cs` 新增常量 `FamilyContextRequired = "FAMILY_CONTEXT_REQUIRED"`。验证：`dotnet build api/Agenda.Api/` 通过，`openspec validate scope-schedule-to-current-family` 无契约错误。

## 2. FamilyContextService 改造（dev-dotnet，TDD）

- [x] 2.1 新建 `api/Agenda.Test/Schedule/Services/FamilyContextServiceTests.cs`，覆盖五类解析语义：header 有且是成员→返回 `(familyId, role)`；header 指向非成员→抛 `FamilyNotFound`；无 header 且 0 条成员→抛 `NotFamilyMember`；无 header 且 1 条成员→回退该家庭；无 header 且 ≥2 条成员→抛 `FamilyContextRequired`。验证：`dotnet test api/Agenda.Test/ --filter "FullyQualifiedName~FamilyContextService"` 失败（RED）。

- [x] 2.2 改造 `api/Agenda.Api/Schedule/Services/FamilyContextService.cs`：接口与实现签名改为 `GetFamilyContextAsync(Guid userId, Guid? familyId, CancellationToken ct = default)`，实现 D2 解析语义（含 `User.Status == Active` 过滤与 `Include(fm => fm.Family)` 保留）。依赖 2.1。验证：2.1 用例转绿。

- [x] 2.3 在 `api/Agenda.Api/Shared/Extensions/ControllerExtensions.cs` 新增 `GetFamilyIdFromHeader(this HttpRequest request)` 扩展，解析 `X-Family-Id`（缺失/解析失败返回 null）。依赖 2.2。验证：`dotnet build api/Agenda.Api/` 通过。

## 3. 四 Controller 读 header（dev-dotnet）

- [x] 3.1 改 `api/Agenda.Api/Schedule/Controllers/ScheduleController.cs`：所有 `GetFamilyContextAsync(User.GetUserId(), ct)` 改为 `GetFamilyContextAsync(User.GetUserId(), Request.GetFamilyIdFromHeader(), ct)`（Create/GetById/Update/Delete/Cancel/Restore/CheckConflict 共 7 处）。依赖 2.3。验证：`dotnet test api/Agenda.Test/ --filter "FullyQualifiedName~ScheduleController"`。

- [x] 3.2 改 `api/Agenda.Api/Schedule/Controllers/CalendarController.cs`：`Query` 中家庭上下文解析同上。依赖 2.3。验证：`dotnet test api/Agenda.Test/ --filter "FullyQualifiedName~CalendarController"`。

- [x] 3.3 改 `api/Agenda.Api/Template/Controllers/TemplateController.cs`：List/GetById/Create/Update/Delete/Apply 共 6 处家庭上下文解析同上。依赖 2.3。验证：`dotnet test api/Agenda.Test/ --filter "FullyQualifiedName~TemplateController"`。

- [x] 3.4 改 `api/Agenda.Api/Schedule/Controllers/ChildScheduleController.cs`：GetToday/GetWeek/GetMonth/GetById/GetWeeklyCompletion/EnsureChildAsync 共 6 处家庭上下文解析同上，保留 `AssignedMemberId == CurrentUserId` 成员级过滤。依赖 2.3。验证：`dotnet test api/Agenda.Test/ --filter "FullyQualifiedName~ChildScheduleController"`。

## 4. 合并重复实现（dev-dotnet）

- [x] 4.1 用 codegraph 查 `ControllerExtensions.GetFamilyContextAsync` 全量调用方，逐个迁移到 `IFamilyContextService.GetFamilyContextAsync`，随后删除 `api/Agenda.Api/Shared/Extensions/ControllerExtensions.cs` 中该重复方法（保留 `GetUserId` 与新增的 `GetFamilyIdFromHeader`）。依赖 3.4。验证：`dotnet build api/Agenda.Api/` 与全量 `dotnet test api/Agenda.Test/` 通过。

## 5. 前端 bootstrapping 与退出兜底（dev-miniapp）

- [x] 5.1 改 `app/miniapp/app.js` 的 `refreshFamilyContext()`：当 `CURRENT_FAMILY_ID` 为空且 `userId` 存在时，调 `familyService.getMyFamilies()`，若返回 ≥1 条家庭则 `wx.setStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID, families[0].familyId)` 后再 `loadFamilyMembers`。验证：`cd app/miniapp-test && npx jest`。

- [x] 5.2 改 `app/miniapp/pages/family-members/index.js` 与 `app/miniapp/pages/family-restore/index.js`：移除 `CURRENT_FAMILY_ID` 后，若响应 `HasOtherFamilies` 为真，`wx.reLaunch` 到 `/pages/family-switch/index`。依赖 5.1。验证：`cd app/miniapp-test && npx jest`。

- [x] 5.3 补前端测试：`app.js` bootstrapping 补写用例（空 CURRENT_FAMILY_ID + ≥1 家庭 → 写入首项）、退出后跳转 `family-switch` 用例。依赖 5.2。验证：`cd app/miniapp-test && npx jest` 全绿。

## 6. 全量校验

- [x] 6.1 后端全量 `dotnet test api/Agenda.Test/`，前端 `cd app/miniapp-test && npx jest`，契约 `openspec validate scope-schedule-to-current-family`。依赖 4.1、5.3。验证：三条命令均退出码 0，无回归。
