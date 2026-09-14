## 1. 单元测试（dev-dotnet）

- [x] 1.1 在 `api/Agenda.Test/Family/InvitationCodeServiceTests.cs` 补「用户在家庭 A、用家庭 B 的有效邀请码加入成功、成为家庭 B 成员」用例，依赖：无；验证：`dotnet test api/Agenda.Test/ --filter "FullyQualifiedName~InvitationCodeServiceTests"` 当前失败（RED）
- [x] 1.2 在 `api/Agenda.Test/Family/InvitationCodeServiceTests.cs` 补「用户已在该家庭、重复加入报 `USER_ALREADY_IN_FAMILY` 且邀请码保持待使用」用例，依赖：1.1；验证：同上，用例覆盖重复加入拦截路径

## 2. 后端守卫修复（dev-dotnet）

- [x] 2.1 修改 `api/Agenda.Api/Family/Services/InvitationCodeService.cs` 的 `JoinByCodeAsync`：守卫从 `AnyAsync(m => m.UserId == userId && m.IsDeleted == false)` 改为 `AnyAsync(m => m.FamilyId == family.Id && m.UserId == userId && m.IsDeleted == false)`，依赖：1.1、1.2；验证：`dotnet build api/Agenda.Api/` 编译通过

## 3. 全量验证（dev-dotnet）

- [x] 3.1 运行后端全量测试确保无回归，依赖：2.1；验证：`dotnet test api/Agenda.Test/` 全部通过，且新增的两个多家庭加入用例通过
