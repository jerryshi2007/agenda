# 家庭管理模块 · Stage 4 测试矩阵

**模块：** 家庭管理（add-family-module）
**编写日期：** 2026-08-18
**适用范围：** Stage 4 测试策划（后端 xUnit 单元/集成 + 前端 Jest 页面/服务/契约）
**非适用范围：** Playwright E2E（本项目约定仅覆盖 Web 应用；小程序由 Jest 覆盖，详见 CLAUDE.md）

---

## 0. 总览

### 0.1 用例规模

| 维度 | 数值 |
|------|------|
| 总用例数（设计） | 71 |
| 按类型 — 正常路径 | 26 |
| 按类型 — 边界值 | 14 |
| 按类型 — 异常路径 | 28 |
| 按类型 — 并发/状态 | 3 |
| 按层级 — 后端 xUnit | 33 |
| 按层级 — 前端 Jest | 38 |
| 按优先级 — Must | 62 |
| 按优先级 — Should | 7 |
| 按优先级 — Could | 2 |

### 0.2 覆盖对账总览

| 维度 | 数值 |
|------|------|
| 已覆盖（用例有对应测试名） | 56 |
| 缺口（需新补） | 15 |
| 缺口占比 | 21% |

### 0.3 缺口清单摘要（按优先级）

**P0（Must 阻塞）— 7 项**
- TC-FL-09：已注销成员超过 30 天自动从列表移除（后端）
- TC-FM-06：已注销创建者超过 30 天自动转让给最早家长（后端，spec R6）
- TC-FI-09：邀请码 5 次碰撞全部失败返回 503（后端边界）
- TC-FSW-04：单家庭时"切换"入口隐藏/置灰（前端 mine 页）
- TC-FSW-05：被移除后 family-switch 点击该家庭提示并从列表移除（前端）
- TC-FW-04：点击分享卡片进入 family-welcome 自动调用 getShareInfo 预填并展示确认页（前端端到端）
- TC-FM-11：孩子角色在 family-members 列表点击自己时菜单应只显示"升级为家长"，不应出现"移除成员/转让创建者"（前端权限 UI）

**P1（Should 体验）— 5 项**
- TC-FM-09：children 项使用 `childName` 而非 `nickname`（family-members 渲染断言）
- TC-FSW-06：多家庭状态记忆 helper（`family-{familyId}-state` 写入/读取/隔离）
- TC-FMS-04：family-restore 在家庭非 Dissolved 状态时（普通家庭访问）给出错误占位（前端）
- TC-FS-05：被邀请孩子未登录/无 openid 时 family-join 错误处理（前端）
- TC-FM-12：family-members onDisbandFamily 名称不匹配时展示 FAMILY_NAME_MISMATCH 错误信息（前端错误分支）

**P2（Could 留待第二期）— 3 项**
- TC-FDM-04：family-display-mode 孩子端预览（Should，第一期不做）
- TC-FC-04：家庭解散订阅消息通知（Could，第一期不做）
- TC-FC-05：成员搜索（Could，第一期不做）

### 0.4 建议补测批次

| 批次 | 内容 | 工作量估算 |
|------|------|------------|
| 批次 A（P0 后端） | TC-FL-09 + TC-FM-06 + TC-FI-09 | 0.5 d（含边界） |
| 批次 B（P0 前端） | TC-FSW-04 + TC-FSW-05 + TC-FW-04 + TC-FM-11 | 1.0 d |
| 批次 C（P1 体验） | TC-FM-09 + TC-FSW-06 + TC-FMS-04 + TC-FS-05 + TC-FM-12 | 0.5 d |
| 批次 D（P2 留待） | 归档到 `production/staging/<future>/`，不在 Stage 4 落 | — |

---

## 1. 用例矩阵

### 1.1 family-lifecycle（家庭生命周期）

#### Requirement: R1 家庭创建

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FC-01 | F1-S02 | 正常 | 后端 | Must | 首次无家庭创建家长 | 用户已登录，无任何家庭 | POST /api/v1/families `{name:"我们家",role:"Parent"}` | 返回 familyId；Family.Status=Normal；Family.CreatorId=user.Id；FamilyMember.UserId=user.Id,Role=Parent | ✅ `FamilyLifecycleServiceTests.CreateAsync_AsParent_CreatesFamilyAndFirstMember` |
| TC-FC-02 | F1-S02 | 边界 | 后端 | Must | 名称长度=20（最大） | 同上 | `{name:"a".repeat(20),role:"Parent"}` | 校验通过，创建成功 | ✅ `FamilyValidatorsTests.CreateFamilyRequest_NameExactly20_Passes` |
| TC-FC-03 | F1-S02 | 异常 | 后端 | Must | 名称长度=1（小于 2） | 同上 | `{name:"我",role:"Parent"}` | 拒绝，错误码 `FAMILY_NAME_INVALID_LENGTH` | ✅ `FamilyValidatorsTests.CreateFamilyRequest_NameTooShort_FailsWithFamilyNameInvalidLength` |
| TC-FC-04 | F1-S02 | 异常 | 后端 | Must | 名称长度=21（大于 20） | 同上 | `{name:"a".repeat(21),role:"Parent"}` | 拒绝，错误码 `FAMILY_NAME_INVALID_LENGTH` | ✅ `FamilyValidatorsTests.CreateFamilyRequest_NameTooLong_FailsWithFamilyNameInvalidLength` |
| TC-FC-05 | F1-S02 | 正常 | 前端 | Must | 引导页无家庭时显示入口 | 当前用户无家庭 | 打开 family-welcome | 显示"创建家庭"和"加入家庭"两个入口 | ✅ `family-welcome.test.js › onLoad 并发拉取家庭列表（无家庭时显示引导）` |
| TC-FC-06 | F1-S02 | 正常 | 前端 | Must | 引导页有家庭时自动跳走 | 用户已有家庭 | 打开 family-welcome | 自动 `wx.switchTab` 到首页 | ✅ `family-welcome.test.js › 有家庭时 onLoad 后跳转日历` |
| TC-FC-07 | F1-S02 | 异常 | 前端 | Must | 引导页拉取失败显示重试 | getMyFamilies reject | 打开 family-welcome | `data.error=true`；点击 onRetry 重新拉取 | ✅ `family-welcome.test.js › 拉取失败时显示错误态` + `点击重试重新拉取家庭列表` |
| TC-FC-08 | F1-S02 | 正常 | 前端 | Must | 创建页填写名称+角色提交成功 | 无家庭 | 选 Parent，输"我的家"，提交 | 调 `createFamily`；写入 `STORAGE_KEYS.CURRENT_FAMILY_ID`；`wx.switchTab` 到日历 | ✅ `family-create.test.js › onSubmit 校验通过调 createFamily…` |
| TC-FC-09 | F1-S02 | 边界 | 前端 | Must | 创建页名称长度=1 不可提交 | 无家庭 | 输"我" | `data.valid=false`；不调 API | ✅ `family-create.test.js › valid = false 当 name 长度 < 2` + `onSubmit 校验未通过不调 API` |
| TC-FC-10 | F1-S02 | 异常 | 前端 | Must | 创建页后端返 FAMILY_NAME_INVALID_LENGTH | 无家庭 | 输合法长度但服务端拒 | 展示 `ErrorMessages.FAMILY_NAME_INVALID_LENGTH` | ✅ `family-create.test.js › FAMILY_NAME_INVALID_LENGTH 错误展示 contracts 错误信息` |

#### Requirement: R2 修改家庭名称

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FUN-01 | F1-S02 | 正常 | 后端 | Must | 家长修改名称成功 | 用户是家长 | PUT /api/v1/families/{id}/name `{name:"新名"}` | Family.Name 更新为"新名" | ✅ `FamilyLifecycleServiceTests.UpdateNameAsync_AsParent_UpdatesName` |
| TC-FUN-02 | F1-S02 | 异常 | 后端 | Must | 孩子尝试修改名称 | 用户是孩子 | 同上 | 拒绝，错误码 `PERMISSION_DENIED` | ✅ `FamilyLifecycleServiceTests.UpdateNameAsync_AsChild_ThrowsPermissionDenied` |
| TC-FUN-03 | F1-S02 | 异常 | 后端 | Must | 修改不存在的家庭 | familyId 错误 | PUT 不存在的 familyId | 拒绝，错误码 `FAMILY_NOT_FOUND` | ✅ `FamilyLifecycleServiceTests.UpdateNameAsync_FamilyNotFound_ThrowsFamilyNotFound` |
| TC-FUN-04 | F1-S02 | 边界 | 后端 | Must | 名称长度=0/21 | 用户是家长 | 名称空串或 21 字符 | 拒绝，错误码 `FAMILY_NAME_INVALID_LENGTH` | ✅ `FamilyValidatorsTests.UpdateFamilyNameRequest_NameTooShort_Fails…` |
| TC-FUN-05 | F1-S02 | 正常 | 前端 | Must | family-members 入口修改名称 | 当前用户是家长 | 点击家庭名称区域 | 进入编辑页；保存后 familyName 更新 | ❌ **缺口**（family-members 无专门的"编辑名称"按钮测试）|

#### Requirement: R3 多家庭切换

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FSW-01 | F1-S09 | 正常 | 后端 | Must | 返回用户所有家庭 | 用户属于多家庭 | GET /api/v1/families/me | 返回 families 列表，每项含 familyId/familyName/role/memberCount/lastActiveAt | ✅ `FamilyLifecycleServiceTests.GetMyFamiliesAsync_ReturnsAllUserFamilies` |
| TC-FSW-02 | F1-S09 | 边界 | 后端 | Must | 已解散家庭不返回 | 用户有一个已解散家庭 | 同上 | 列表只含未解散的家庭 | ✅ `FamilyLifecycleServiceTests.GetMyFamiliesAsync_ExcludesDissolvedFamilies` |
| TC-FSW-03 | F1-S09 | 性能 | 后端 | Must | 5 个家庭 N+1 防护 | 用户加入 5 个家庭 | 同上 | MemberCount 用 GroupBy 一次查询得出，无 N+1 | ✅ `FamilyLifecycleServiceTests.GetMyFamiliesAsync_MemberCountUsesGroupedQuery_NotNPlus1` |
| TC-FSW-04 | F1-S09 | 正常 | 前端 | Must | mine 页单家庭隐藏"切换"入口 | 用户只有 1 个家庭 | 打开 mine 页 | "切换家庭"菜单项隐藏或置灰 | ❌ **缺口**（mine.test.js 未明确测此项） |
| TC-FSW-05 | F1-S09 | 异常 | 前端 | Must | 切换列表中点击已退出家庭 | 用户被移除出家庭 A，仍有家庭 B | 打开 family-switch 点 A | 提示"你已不在该家庭中"；A 从列表移除 | ❌ **缺口**（family-switch 未测此场景） |
| TC-FSW-06 | F1-S09 | 正常 | 前端 | Should | 多家庭状态记忆 helper | 多家庭 | 切换到家庭 A 选周视图周一 → 切到 B 选月视图 → 切回 A | 切回 A 时恢复周视图周一（按 `family-{familyId}-state` 键隔离） | ❌ **缺口**（无 storage helper 测试） |
| TC-FSW-07 | F1-S09 | 正常 | 前端 | Must | 切换页标记当前家庭 | 用户有 2 个家庭 | 打开 family-switch | 列表中当前家庭标记 `isCurrent=true` | ✅ `family-switch.test.js › 标记当前家庭…` |
| TC-FSW-08 | F1-S09 | 边界 | 前端 | Must | 切换页选择当前家庭不重复操作 | 同上 | 点击当前家庭 | 不写 storage，不 reLaunch | ✅ `family-switch.test.js › 选择当前家庭时不重复切换` |
| TC-FSW-09 | F1-S09 | 正常 | 前端 | Must | 切换页选新家庭后 reLaunch | 同上 | 点击家庭 B | 写 `CURRENT_FAMILY_ID=B`；`wx.reLaunch` | ✅ `family-switch.test.js › onSelectFamily 写入 CURRENT_FAMILY_ID` + `调用 wx.reLaunch 重新加载首页` |
| TC-FSW-10 | F1-S09 | 异常 | 前端 | Must | 切换页拉取失败显示错误 | getMyFamilies reject | 打开 family-switch | `data.error=true`；onRetry 重新拉取 | ✅ `family-switch.test.js › 拉取失败时显示错误态` + `onRetry 重新拉取` |
| TC-FSW-11 | F1-S09 | 边界 | 前端 | Must | 单家庭空态提示 | 用户只有 1 个家庭 | 打开 family-switch | `data.singleFamily=true` 显示"仅有 1 个家庭"提示 | ✅ `family-switch.test.js › 只有 1 个家庭时 empty 提示"仅有 1 个家庭"` |

#### Requirement: R4 退出家庭

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FX-01 | F1-S10 | 正常 | 后端 | Must | 非创建者家长退出成功 | 用户 A 非创建者家长 | POST /api/v1/families/{id}/exit | 移除 FamilyMember 记录；返回 `{exited:true,hasOtherFamilies:bool}` | ✅ `FamilyLifecycleServiceTests.ExitAsync_AsNonCreatorParent_RemovesMember` |
| TC-FX-02 | F1-S10 | 异常 | 后端 | Must | 创建者尝试退出 | 用户 A 是创建者 | 同上 | 拒绝，错误码 `FAMILY_CREATOR_CANNOT_EXIT` | ✅ `FamilyLifecycleServiceTests.ExitAsync_AsCreator_ThrowsCreatorCannotExit` |
| TC-FX-03 | F1-S10 | 异常 | 后端 | Must | 最后一个家长且有孩子时退出 | 家庭仅 1 家长 2 孩子 | 同上 | 拒绝，错误码 `FAMILY_CREATOR_CANNOT_EXIT`（也覆盖 LAST_PARENT_CANNOT_EXIT 场景） | ✅ `FamilyLifecycleServiceTests.ExitAsync_AsLastParentWithChildren_ThrowsLastParentCannotExit` |
| TC-FX-04 | F1-S10 | 异常 | 后端 | Must | 非成员退出 | 用户 A 不在家庭中 | 同上 | 拒绝，错误码 `NOT_FAMILY_MEMBER` | ✅ `FamilyLifecycleServiceTests.ExitAsync_AsNonMember_ThrowsNotFamilyMember` |
| TC-FX-05 | F1-S10 | 正常 | 前端 | Must | family-members 退出家庭确认 | 用户非创建者 | 底部"退出家庭"按钮 + 二次确认 | 调 `exitFamily`；成功后清理本地 | ✅ `family-members.test.js › onLeaveFamily 退出家庭` |
| TC-FX-06 | F1-S10 | 异常 | 前端 | Must | family-members 退出时 FAMILY_CREATOR_CANNOT_EXIT | 用户是创建者 | 同上 | 展示 `ErrorMessages.FAMILY_CREATOR_CANNOT_EXIT` | ❌ **缺口**（family-members 未明确测此错误分支） |

#### Requirement: R5 解散家庭

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FD-01 | F1-S10 | 正常 | 后端 | Must | 创建者解散家庭，名称匹配 | A 是创建者 | POST /dissolve `{familyName:"我们家"}` | Family.Status=Dissolved；DissolvedAt=now | ✅ `FamilyLifecycleServiceTests.DissolveAsync_AsCreatorWithNameMatch_MarksFamilyDissolved` |
| TC-FD-02 | F1-S10 | 异常 | 后端 | Must | 解散时名称不匹配 | A 是创建者 | POST /dissolve `{familyName:"错名"}` | 拒绝，错误码 `FAMILY_NAME_MISMATCH` | ✅ `FamilyLifecycleServiceTests.DissolveAsync_WithWrongName_ThrowsFamilyNameMismatch` |
| TC-FD-03 | F1-S10 | 异常 | 后端 | Must | 非创建者尝试解散 | A 是家长非创建者 | 同上 | 拒绝，错误码 `PERMISSION_DENIED` | ✅ `FamilyLifecycleServiceTests.DissolveAsync_AsNonCreator_ThrowsPermissionDenied` |
| TC-FD-04 | F1-S10 | 异常 | 后端 | Must | 重复解散已解散家庭 | 家庭已解散 | 同上 | 拒绝，错误码 `FAMILY_ALREADY_DISSOLVED` | ✅ `FamilyLifecycleServiceTests.DissolveAsync_AlreadyDissolved_ThrowsFamilyAlreadyDissolved` |
| TC-FD-05 | F1-S10 | 边界 | 后端 | Must | 解散家庭名称空 | A 是创建者 | `{familyName:""}` | 拒绝，错误码 `FAMILY_NAME_MISMATCH` | ✅ `FamilyValidatorsTests.DissolveFamilyRequest_EmptyName_FailsWithFamilyNameMismatch` |
| TC-FD-06 | F1-S10 | 正常 | 前端 | Must | family-members 解散按钮 | A 是创建者 | 底部"解散家庭"按钮 + 输入正确名称 | 调 `dissolveFamily(id, name)` | ✅ `family-members.test.js › onDisbandFamily 解散家庭` |
| TC-FD-07 | F1-S10 | 异常 | 前端 | Must | 解散时名称不匹配提示 | A 是创建者 | 输入错误名称 | 展示 `ErrorMessages.FAMILY_NAME_MISMATCH` | ❌ **缺口**（family-members.onDisbandFamily 缺错误分支断言） |

#### Requirement: R6 恢复解散家庭

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FR-01 | F1-S10 | 正常 | 后端 | Must | 30 天内恢复 | 家庭 5 天前解散 | POST /api/v1/families/{id}/restore | Family.Status=Normal；DissolvedAt=null | ✅ `FamilyLifecycleServiceTests.RestoreAsync_Within30Days_RestoresFamily` |
| TC-FR-02 | F1-S10 | 异常 | 后端 | Must | 超过 30 天试图恢复 | 家庭 31 天前解散 | 同上 | 拒绝，错误码 `DISSOLVED_EXPIRED` | ✅ `FamilyLifecycleServiceTests.RestoreAsync_After30Days_ThrowsDissolvedExpired` |
| TC-FR-03 | F1-S10 | 异常 | 后端 | Must | 家庭未解散却调用恢复 | 家庭状态=Normal | 同上 | 拒绝，错误码 `FAMILY_NOT_DISSOLVED` | ✅ `FamilyLifecycleServiceTests.RestoreAsync_NotDissolved_ThrowsFamilyNotDissolved` |
| TC-FR-04 | F1-S10 | 正常 | 前端 | Must | family-restore 30 天内恢复成功 | 解散 5 天 | onRestore | 调 `restoreFamily`；`data.success=true` | ✅ `family-restore.test.js › onRestore 调 familyService.restoreFamily` + `成功后设置 success=true` |
| TC-FR-05 | F1-S10 | 异常 | 前端 | Must | family-restore 超过 30 天失败 | 解散 31 天 | onRestore | 展示 `ErrorMessages.DISSOLVED_EXPIRED` | ✅ `family-restore.test.js › onRestore 失败时设置 errorMessage` |
| TC-FR-06 | F1-S10 | 正常 | 前端 | Must | family-restore 跳过恢复 | 解散提示 | onSkip | 不调 API；`wx.reLaunch` 到 welcome | ✅ `family-restore.test.js › onSkip 不调用 restoreFamily` + `onSkip 调用 wx.reLaunch` |
| TC-FR-07 | F1-S10 | 并发 | 前端 | Should | family-restore 恢复期间防重复 | restoring=true | 两次 onRestore | 只调一次 API | ✅ `family-restore.test.js › restoring 期间防止重复点击` |
| TC-FR-08 | F1-S10 | 边界 | 前端 | Should | family-restore 访问未解散家庭 | query.familyId 指向 Normal 家庭 | onLoad 后 onRestore | 错误占位 | ❌ **缺口**（未测访问未解散家庭场景） |

---

### 1.2 family-member（成员与角色管理）

#### Requirement: R1 成员列表分组展示

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FML-01 | F1-S07 | 正常 | 后端 | Must | 按家长/孩子分组 | 2 家长 2 孩子 | GET /api/v1/families/{id}/members | parents=2,children=2,activeMemberCount=4,maxMemberCount=10 | ✅ `FamilyLifecycleServiceTests.GetMembersAsync_GroupsParentsAndChildren_IncludesCreator` |
| TC-FML-02 | F1-S07 | 边界 | 后端 | Must | 已注销成员 30 天内不占名额 | 1 孩子已注销未满 30 天 | 同上 | activeMemberCount=1（不含已注销） | ✅ `FamilyLifecycleServiceTests.GetMembersAsync_ExcludesDeletedMembersFromCount` |
| TC-FML-03 | F1-S07 | 边界 | 后端 | Must | 容量达 10 人统计正确 | 1 家长 + 9 孩子 | 同上 | activeMemberCount=10 | ✅ `FamilyLifecycleServiceTests.CreateAsync_ReachesFamilyMemberLimit_BlocksFurtherJoins` |
| TC-FML-04 | F1-S07 | 正常 | 前端 | Must | family-members 按角色分组渲染 | 同上 | 打开 family-members | parents/children 数组长度正确；显示 activeMemberCount | ✅ `family-members.test.js › onLoad 拉取成员列表并按家长/孩子分组` |
| TC-FML-05 | F1-S07 | 边界 | 前端 | Must | 已注销成员 isDeactivated=true | API 返回 isDeleted=true 成员 | 打开 family-members | 渲染时该成员 `isDeactivated=true` | ✅ `family-members.test.js › 已注销成员标记 isDeactivated=true` |

#### Requirement: R1.b 已注销成员 30 天后从列表移除

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FL-09 | F1-S07 | 边界 | 后端 | Must | 已注销超 30 天后清理任务移除 | A 30 天前注销 | IHostedService 清理任务执行 | FamilyMember.IsDeleted=true 的记录物理删除；名额释放 | ❌ **缺口**（无清理任务测试，无 IsDeleted 物理删除断言） |

#### Requirement: R2 移除成员

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FRM-01 | F1-S07 | 正常 | 后端 | Must | 家长移除孩子 | A 家长移除 B 孩子 | DELETE /members/{id} | FamilyMember 记录删除 | ✅ `FamilyLifecycleServiceTests.RemoveMemberAsync_AsParent_RemovesChild` |
| TC-FRM-02 | F1-S07 | 异常 | 后端 | Must | 家长移除自己 | A 家长移除自己 | DELETE /members/{ownMemberId} | 拒绝，错误码 `CANNOT_REMOVE_SELF` | ✅ `FamilyLifecycleServiceTests.RemoveMemberAsync_SelfTarget_ThrowsCannotRemoveSelf` |
| TC-FRM-03 | F1-S07 | 异常 | 后端 | Must | 孩子尝试移除其他成员 | 孩子 A 移除孩子 B | 同上 | 拒绝，错误码 `PERMISSION_DENIED` | ✅ `FamilyLifecycleServiceTests.RemoveMemberAsync_AsChild_ThrowsPermissionDenied` |
| TC-FRM-04 | F1-S07 | 异常 | 前端 | Must | CANNOT_REMOVE_SELF 错误透传 | API 返错 | 移除自己 | 展示 `ErrorMessages.CANNOT_REMOVE_SELF` | ✅ `services/family.test.js › CANNOT_REMOVE_SELF 错误透传` |
| TC-FRM-05 | F1-S07 | 正常 | 前端 | Must | family-members 点击孩子弹出"设置/移除"菜单 | 点击孩子 | onMemberAction | ActionSheet 含"设置展示模式"和"移除成员" | ✅ `family-members.test.js › onMemberAction 点击孩子时菜单为「设置展示模式 / 移除成员」` |
| TC-FRM-06 | F1-S07 | 正常 | 前端 | Must | family-members 点击家长弹出"移除/转让"菜单 | 点击家长 | onMemberAction | ActionSheet 含"移除成员"和"转让创建者" | ✅ `family-members.test.js › onMemberAction 点击家长时菜单为「移除成员 / 转让创建者」` |
| TC-FRM-07 | F1-S07 | 异常 | 前端 | Must | family-members 自己在菜单中不应出现"移除/转让" | 当前用户 | onMemberAction（self） | 菜单不出现"移除成员/转让创建者" | ❌ **缺口**（未测自己菜单） |

#### Requirement: R3 转让创建者

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FTC-01 | F1-S07 | 正常 | 后端 | Must | 转让给其他家长 | A 是创建者，转给家长 B | POST /transfer-creator/{memberId} | Family.CreatorId=B.Id | ✅ `FamilyLifecycleServiceTests.TransferCreatorAsync_ToOtherParent_TransfersCreator` |
| TC-FTC-02 | F1-S07 | 异常 | 后端 | Must | 转让给孩子 | A 转给孩子 B | 同上 | 拒绝，错误码 `INVALID_TRANSFER_TARGET` | ✅ `FamilyLifecycleServiceTests.TransferCreatorAsync_ToChild_ThrowsInvalidTransferTarget` |
| TC-FTC-03 | F1-S07 | 边界 | 后端 | Must | 唯一家长时菜单隐藏 | 只有 1 个家长 | 打开 family-members | 不显示"转让创建者"入口 | ❌ **缺口**（无唯一家长隐藏测试） |
| TC-FTC-04 | F1-S07 | 正常 | 前端 | Must | 转让时调对应 API | 家长 A 选 B 转让 | onTransferCreator | 调 `transferCreator(familyId, B.memberId)` | ✅ `services/family.test.js › transferCreator 仅传路径参数`（服务层断言；页面层 family-members 集成通过 onMemberAction 触发） |

#### Requirement: R4 孩子姓名家庭内覆盖微信昵称

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FCN-01 | F1-S07 | 正常 | 后端 | Must | 邀请孩子时姓名/展示模式写入 | 邀请孩子，指定姓名"小明"+Primary | POST /invite-code | InvitationCode.TargetChildName="小明"；TargetDisplayMode=Primary | ✅ `InvitationCodeServiceTests.GenerateAsync_ForChild_StoresChildNameAndDisplayMode` |
| TC-FCN-02 | F1-S07 | 正常 | 后端 | Must | 通过邀请码加入后写入 childName | B 用邀请码加入 | POST /join-by-code | FamilyMember.ChildName="小明"；DisplayMode=Primary | ✅ `InvitationCodeServiceTests.JoinByCodeAsync_ChildCode_CreatesChildWithName` |
| TC-FCN-09 | F1-S07 | 正常 | 前端 | Should | 成员列表 children 项显示 childName 而非 nickname | API 返回 childName="小明",nickname="阳光少年" | 打开 family-members | 渲染字段取 `childName` | ❌ **缺口**（family-members 未断言显示 childName） |

#### Requirement: R5 孩子展示模式设置

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FDM-01 | F1-S08 | 正常 | 后端 | Must | 家长设置孩子展示模式 | 家长设孩子 UpperGrades | PUT /members/{id}/display-mode `{displayMode:"UpperGrades"}` | FamilyMember.DisplayMode=UpperGrades | ✅ `FamilyLifecycleServiceTests.SetMemberDisplayModeAsync_AsParent_UpdatesDisplayMode` |
| TC-FDM-02 | F1-S08 | 异常 | 后端 | Must | 对家长调用设置展示模式 | 家长对家长设置 | 同上 | 拒绝，错误码 `PERMISSION_DENIED` | ✅ `FamilyLifecycleServiceTests.SetMemberDisplayModeAsync_OnParent_ThrowsPermissionDenied` |
| TC-FDM-03 | F1-S08 | 正常 | 前端 | Must | family-display-mode 三模式选择+保存 | 打开页面，选 UpperGrades，保存 | onSave | 调 `setDisplayMode(memberId, mode)`；`data.success=true` | ✅ `family-display-mode.test.js › onSave 调 setDisplayMode…` |
| TC-FDM-04 | F1-S08 | 正常 | 前端 | Should | 孩子端预览（差异化 UI） | 打开页面 | — | 第一期统一小学模式，第二期实现差异化 | ❌ **缺口**（第二期实现） |
| TC-FDM-05 | F1-S08 | 边界 | 前端 | Must | 未传 memberId 时不调 API | query 缺 memberId | onSave | 不调 `setDisplayMode` | ✅ `family-display-mode.test.js › onSave 未传 memberId 时不调 API` |
| TC-FDM-06 | F1-S08 | 并发 | 前端 | Must | saving 期间防重复保存 | 第一次未返回 | 两次 onSave | 只调一次 API | ✅ `family-display-mode.test.js › saving 期间防止重复保存` |
| TC-FDM-07 | F1-S08 | 边界 | 前端 | Must | 当前模式与所选相同时 disabled | mode=Preschool,选 Preschool | onLoad | `data.disabled=true` | ✅ `family-display-mode.test.js › disabled = (selectedMode === currentMode)…` |

#### Requirement: R6 已注销创建者自动转让

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FM-06 | F1-S07 | 边界 | 后端 | Must | 创建者注销超 30 天自动转让给最早家长 | 创建者 A 注销 30 天，剩家长 B/C | 清理任务执行 + 转让 | Family.CreatorId=B（最早加入） | ❌ **缺口**（spec R6 强制 Must，无任何测试） |

#### Requirement: R7 家庭人数上限

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FML-10 | F1-S04 | 异常 | 后端 | Must | 家庭满 10 人时生成邀请码被拒 | 家庭已 10 人 | POST /invite-code | 拒绝，错误码 `FAMILY_MEMBER_LIMIT_EXCEEDED` | ✅ `InvitationCodeServiceTests.GenerateAsync_FamilyFull_ThrowsMemberLimitExceeded` |
| TC-FML-11 | F1-S04 | 异常 | 后端 | Must | 家庭满 10 人时通过邀请码加入被拒 | 家庭已 10 人，邀请码有效 | POST /join-by-code | 拒绝，错误码 `FAMILY_MEMBER_LIMIT_EXCEEDED` | ✅ `InvitationCodeServiceTests.JoinByCodeAsync_FamilyFull_ThrowsMemberLimitExceeded` |
| TC-FML-12 | F1-S04 | 异常 | 前端 | Must | family-invite 满员错误展示 | API 返错 | 提交邀请 | 展示 `ErrorMessages.FAMILY_MEMBER_LIMIT_EXCEEDED` | ✅ `family-invite.test.js › FAMILY_MEMBER_LIMIT_EXCEEDED 错误展示 contracts 错误信息` |
| TC-FML-13 | F1-S04 | 异常 | 前端 | Must | family-join 满员错误展示 | API 返错 | 提交加入 | 展示 `ErrorMessages.FAMILY_MEMBER_LIMIT_EXCEEDED` | ✅ `family-join.test.js › FAMILY_MEMBER_LIMIT_EXCEEDED 错误展示 contracts 错误信息` |

---

### 1.3 family-invite（双轨邀请机制）

#### Requirement: R1 生成邀请码

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FIG-01 | F1-S03 | 正常 | 后端 | Must | 生成 6 位 2-9 邀请码 | 家长 | POST /invite-code | code 长度=6，每位 2-9；status=Pending；expiresAt=now+24h | ✅ `InvitationCodeServiceTests.GenerateAsync_ForParent_CreatesValidCode` + `GenerateAsync_CreatesValidInvitationCodeStatusPending` |
| TC-FIG-02 | F1-S03 | 边界 | 后端 | Must | 邀请孩子带 childName+displayMode | 家长 | POST /invite-code `{targetRole:"Child",targetChildName:"小明",targetDisplayMode:"Primary"}` | 存储 TargetChildName="小明"；TargetDisplayMode=Primary | ✅ `InvitationCodeServiceTests.GenerateAsync_ForChild_StoresChildNameAndDisplayMode` |
| TC-FIG-03 | F1-S03 | 异常 | 后端 | Must | 邀请家长不需 childName | 家长 | `{targetRole:"Parent"}` | 校验通过 | ✅ `FamilyValidatorsTests.GenerateInviteCodeRequest_ParentTarget_PassesWithoutChildName` |
| TC-FIG-04 | F1-S03 | 异常 | 后端 | Must | 邀请孩子缺 childName | 家长 | `{targetRole:"Child",targetDisplayMode:"Primary"}` 缺 childName | 拒绝，TargetChildName 必填错误 | ✅ `FamilyValidatorsTests.GenerateInviteCodeRequest_ChildTarget_RequiresChildName` |
| TC-FIG-05 | F1-S03 | 异常 | 后端 | Must | 邀请孩子 childName 超长 | 家长 | childName 21 字符 | 拒绝，TargetChildName 长度错误 | ✅ `FamilyValidatorsTests.GenerateInviteCodeRequest_ChildTarget_ChildNameTooLong_Fails` |
| TC-FIG-06 | F1-S03 | 异常 | 后端 | Must | 非成员尝试生成邀请码 | 用户不在家庭 | POST /invite-code | 拒绝，错误码 `NOT_FAMILY_MEMBER` | ✅ `InvitationCodeServiceTests.GenerateAsync_NonMember_ThrowsNotFamilyMember` |
| TC-FIG-07 | F1-S03 | 异常 | 后端 | Must | 已解散家庭生成邀请码 | 家庭已解散 | POST /invite-code | 拒绝，错误码 `FAMILY_ALREADY_DISSOLVED` | ✅ `InvitationCodeServiceTests.GenerateAsync_DissolvedFamily_ThrowsFamilyAlreadyDissolved` |
| TC-FIG-08 | F1-S03 | 异常 | 后端 | Must | 邀请码碰撞 5 次全部失败 | 极端碰撞 | 5 次重试全部失败 | 返回 503，错误码 `INVITATION_CODE_GENERATION_FAILED` | ❌ **缺口**（仅测 1 次碰撞重试成功，无全失败路径） |
| TC-FIG-09 | F1-S03 | 正常 | 前端 | Must | family-invite Parent 模式生成 | 默认 | onSubmit | 调 `generateInviteCode(familyId, {targetRole:"Parent"})`；展示 code/expiresAt | ✅ `family-invite.test.js › onSubmit Parent 模式调 generateInviteCode…` |
| TC-FIG-10 | F1-S03 | 正常 | 前端 | Must | family-invite Child 模式生成 | 选 Child+输姓名+选模式 | onSubmit | 调 `generateInviteCode` 带 childName+displayMode | ✅ `family-invite.test.js › onSubmit Child 模式调 generateInviteCode…` |
| TC-FIG-11 | F1-S03 | 边界 | 前端 | Must | 重新生成重置 codeVisible | 已生成 | onRegenerate | `codeVisible=false`；可再次 onSubmit | ✅ `family-invite.test.js › 生成后点重新生成重置 codeVisible…` |
| TC-FIG-12 | F1-S03 | 正常 | 前端 | Must | 复制邀请码到剪贴板 | 已生成 | onCopyCode | `wx.setClipboardData({data:code})` | ✅ `family-invite.test.js › onCopyCode 复制邀请码到剪贴板` |

#### Requirement: R2 邀请码加入

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FIJ-01 | F1-S05 | 正常 | 后端 | Must | 用户无家庭用正确邀请码加入 | 邀请码 Pending+Parent | POST /join-by-code `{code:"382951"}` | 加入家庭 role=Parent；code 变 Used | ✅ `InvitationCodeServiceTests.JoinByCodeAsync_ValidPendingCode_CreatesMembership` |
| TC-FIJ-02 | F1-S05 | 正常 | 后端 | Must | 邀请码是 Child 时写入 childName | 邀请码 Child+小明+Primary | 同上 | 加入 role=Child；childName="小明"；displayMode=Primary | ✅ `InvitationCodeServiceTests.JoinByCodeAsync_ChildCode_CreatesChildWithName` |
| TC-FIJ-03 | F1-S05 | 异常 | 后端 | Must | 邀请码过期 | code.expiresAt < now | 同上 | 拒绝，错误码 `INVITATION_CODE_EXPIRED` | ✅ `InvitationCodeServiceTests.JoinByCodeAsync_ExpiredCode_ThrowsInvitationCodeExpired` |
| TC-FIJ-04 | F1-S05 | 异常 | 后端 | Must | 邀请码已使用 | code.status=Used | 同上 | 拒绝，错误码 `INVITATION_CODE_USED` | ✅ `InvitationCodeServiceTests.JoinByCodeAsync_UsedCode_ThrowsInvitationCodeUsed` |
| TC-FIJ-05 | F1-S05 | 异常 | 后端 | Must | 邀请码已撤销 | code.status=Redeemed | 同上 | 拒绝，错误码 `INVITATION_CODE_REDEEMED` | ✅ `InvitationCodeServiceTests.JoinByCodeAsync_RevokedCode_ThrowsInvitationCodeRedeemed` |
| TC-FIJ-06 | F1-S05 | 异常 | 后端 | Must | 邀请码不存在 | code 不在 DB | 同上 | 拒绝，错误码 `INVALID_INVITATION_CODE` | ✅ `InvitationCodeServiceTests.JoinByCodeAsync_NonExistentCode_ThrowsInvalidInvitationCode` |
| TC-FIJ-07 | F1-S05 | 异常 | 后端 | Must | 加入者已在某家庭中 | 用户已是另一家庭成员 | 同上 | 拒绝，错误码 `USER_ALREADY_IN_FAMILY` | ✅ `InvitationCodeServiceTests.JoinByCodeAsync_UserAlreadyInAnyFamily_ThrowsUserAlreadyInFamily` |
| TC-FIJ-08 | F1-S05 | 边界 | 前端 | Must | family-join 6 位数字仅 2-9 | 输"234ab8" | onCodeInput | code 过滤为"2348"；valid 按 6 位判定 | ✅ `family-join.test.js › onCodeInput 拼接数字并校验格式（仅 2-9）` + `排除 0/1` |
| TC-FIJ-09 | F1-S05 | 正常 | 前端 | Must | family-join 提交后写入 CURRENT_FAMILY_ID | 输正确码 | onSubmit | 调 `joinByCode`；写入 storage；switchTab | ✅ `family-join.test.js › onSubmit 校验通过调 joinByCode…` |
| TC-FIJ-10 | F1-S05 | 异常 | 前端 | Must | family-join INVALID_INVITATION_CODE 错误展示 | API 返错 | onSubmit | 展示 `ErrorMessages.INVALID_INVITATION_CODE` | ✅ `family-join.test.js › INVALID_INVITATION_CODE 错误展示 contracts 错误信息` |
| TC-FIJ-11 | F1-S05 | 异常 | 前端 | Must | family-join INVITATION_CODE_EXPIRED 错误展示 | API 返错 | 同上 | 展示 `ErrorMessages.INVITATION_CODE_EXPIRED` | ✅ `family-join.test.js › INVITATION_CODE_EXPIRED 错误展示 contracts 错误信息` |
| TC-FIJ-12 | F1-S05 | 异常 | 前端 | Must | family-join USER_ALREADY_IN_FAMILY 错误展示 | API 返错 | 同上 | 展示 `ErrorMessages.USER_ALREADY_IN_FAMILY` | ✅ `family-join.test.js › USER_ALREADY_IN_FAMILY 错误展示 contracts 错误信息` |
| TC-FIJ-13 | F1-S05 | 正常 | 前端 | Must | family-join 从 query 预填（来自分享卡片） | query.inviteCode="234567" | onLoad | code 预填；valid=true | ✅ `family-join.test.js › onLoad 从 query.inviteCode 预填（来自分享卡片）` |

#### Requirement: R3 撤销邀请码

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FIR-01 | F1-S03 | 正常 | 后端 | Must | 邀请人撤销待使用邀请码 | code.status=Pending,user=创建者 | DELETE /invites/{codeId} | code.status=Redeemed | ✅ `InvitationCodeServiceTests.RevokeAsync_AsCreator_RevokesPendingCode` |
| TC-FIR-02 | F1-S03 | 异常 | 后端 | Must | 非创建者撤销 | 其他用户 | 同上 | 拒绝，错误码 `PERMISSION_DENIED` | ✅ `InvitationCodeServiceTests.RevokeAsync_NotCreator_ThrowsPermissionDenied` |
| TC-FIR-03 | F1-S03 | 异常 | 后端 | Must | 撤销已使用的邀请码 | code.status=Used | 同上 | 拒绝，错误码 `INVITATION_CANNOT_REVOKE` | ✅ `InvitationCodeServiceTests.RevokeAsync_UsedCode_ThrowsInvitationCannotRevoke` |
| TC-FIR-04 | F1-S03 | 正常 | 前端 | Must | family-invite-list 撤销后刷新 | 列表有 Pending | onRevoke | 调 `revokeInvite`；重新拉取列表 | ✅ `family-invite-list.test.js › onRevoke 撤销邀请后刷新列表` |
| TC-FIR-05 | F1-S03 | 异常 | 前端 | Must | family-invite-list 撤销失败错误展示 | API 返错 | onRevoke | 展示 `ErrorMessages.INVITATION_CANNOT_REVOKE` | ✅ `family-invite-list.test.js › INVITATION_CANNOT_REVOKE 错误展示 contracts 错误信息` |

#### Requirement: R4 邀请记录列表

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FIL-01 | F1-S03 | 正常 | 后端 | Must | 返回家庭所有邀请记录 | 多个邀请码 | GET /invites | 返回 invites 列表 | ✅ `InvitationCodeServiceTests.ListAsync_ReturnsAllFamilyCodes` |
| TC-FIL-02 | F1-S03 | 边界 | 后端 | Must | CanRevoke 仅 Pending=true | 含 Used 记录 | 同上 | Used 记录 `canRevoke=false` | ✅ `InvitationCodeServiceTests.ListAsync_ShowsCanRevokeOnlyForPending` |
| TC-FIL-03 | F1-S03 | 正常 | 前端 | Must | family-invite-list 按状态分组 | API 返回 3 种状态 | onLoad | groups.pending/used/redeemed 各自含正确条目 | ✅ `family-invite-list.test.js › onLoad 拉取邀请列表并按状态分组` |
| TC-FIL-04 | F1-S03 | 边界 | 前端 | Must | expiresAt 过期的 Pending 移到 expired 分组 | API 返回 expiresAt<now | onLoad | groups.expired 含该条，groups.pending 不含 | ✅ `family-invite-list.test.js › 过期（expiresAt < now）的 Pending 移到 expired 分组` |
| TC-FIL-05 | F1-S03 | 边界 | 前端 | Must | 邀请列表为空 | API 返回空 | onLoad | 各分组均为空数组 | ✅ `family-invite-list.test.js › 空列表时各分组均为空数组` |

#### Requirement: R5 微信分享卡片邀请家长

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FIS-01 | F1-S06-1 | 正常 | 前端 | Must | family-invite onShareAppMessage 含 inviteCode | 已生成邀请码 | onShareAppMessage | 返回 `{path:"/pages/family-welcome/index?inviteCode=xxx"}` | ✅ `family-invite.test.js › onShareAppMessage 携带邀请码到分享路径` |
| TC-FIS-02 | F1-S06-1 | 边界 | 前端 | Must | family-invite onShareAppMessage 无码 | 未生成 | onShareAppMessage | 返回 `{path:"/pages/family-welcome/index"}` | ✅ `family-invite.test.js › onShareAppMessage 无邀请码时仅返回 welcome 路径` |
| TC-FIS-03 | F1-S06 | 正常 | 前端 | Must | 分享卡片被点击进入 family-welcome 自动调 getShareInfo | 携带 inviteCode 的 query | onLoad | 调 `getShareInfo(code)`；展示确认页 | ❌ **缺口**（getShareInfo 服务层有测试，页面端到端无） |
| TC-FIS-04 | F1-S06 | 异常 | 前端 | Must | 分享卡片携带失效邀请码 | query.inviteCode=无效码 | onLoad | 展示 `ErrorMessages.INVALID_INVITATION_CODE` 提示 | ❌ **缺口**（端到端无） |

#### Requirement: R6 邀请码数字限制

| 用例 ID | 所属 Story | 类型 | 层 | 优先级 | 场景 | 前置 | 步骤 | 预期结果 | 已覆盖 / 缺口 |
|---------|-----------|:----:|:--:|:--:|------|------|------|----------|---------------|
| TC-FNC-01 | F1-S03 | 边界 | 后端 | Must | 邀请码正则 `^[2-9]{6}$` 校验（合法） | 6 位 2-9 | JoinByCodeRequest.code 多种合法值 | 校验通过 | ✅ `FamilyValidatorsTests.JoinByCodeRequest_ValidCode_Passes`（含 234567/999999/222222） |
| TC-FNC-02 | F1-S03 | 异常 | 后端 | Must | 邀请码含 0 或 1 | "012345"/"123456" | 同上 | 拒绝，错误码 `INVALID_INVITATION_CODE` | ✅ `FamilyValidatorsTests.JoinByCodeRequest_InvalidCode_Fails…` |
| TC-FNC-03 | F1-S03 | 异常 | 后端 | Must | 邀请码长度不足 6 | "23456" | 同上 | 拒绝 | ✅ `FamilyValidatorsTests.JoinByCodeRequest_InvalidCode_Fails…` |
| TC-FNC-04 | F1-S03 | 异常 | 后端 | Must | 邀请码长度过长 7+ | "2345678" | 同上 | 拒绝 | ✅ `FamilyValidatorsTests.JoinByCodeRequest_InvalidCode_Fails…` |
| TC-FNC-05 | F1-S03 | 异常 | 后端 | Must | 邀请码含字母或空 | "abcdef"/"" | 同上 | 拒绝 | ✅ `FamilyValidatorsTests.JoinByCodeRequest_InvalidCode_Fails…` |
| TC-FNC-06 | F1-S03 | 正常 | 后端 | Must | 邀请码字段在 DB 层为固定长度 6 | EF model | 实体元数据 | Code.IsFixedLength=true；MaxLength=6 | ✅ `FamilyModelTests.Model_InvitationCode_CodeIsFixedLength6` + `Model_InvitationCode_HasUniqueIndexOnCode` |
| TC-FNC-07 | F1-S03 | 边界 | 前端 | Must | family-join 输入实时排除 0/1 | 输"012345" | onCodeInput | code="2345" | ✅ `family-join.test.js › onCodeInput 排除 0/1` |

---

## 2. 契约 & 服务层覆盖对账

| 维度 | 已覆盖 | 备注 |
|------|:--:|------|
| `services/family.js` 15 个端点 URL/method 映射 | ✅ 15/15 | `services/family.test.js` |
| `services/family.js` skipFamilyHeader 透传 | ✅ 7/7（创建/加入/恢复/getMyFamilies/getShareInfo 5 个无家庭上下文的端点） | 同上 |
| `services/family.js` 错误码透传（CANNOT_REMOVE_SELF / FAMILY_CREATOR_CANNOT_EXIT） | ✅ 2/2 | 同上 |
| `services/api.js` X-Family-Id 注入逻辑 | ✅ | `services/api.test.js`（H1 修复回归防护 5 个用例） |
| 契约 parity：DisplayMode / FamilyStatus / InvitationCodeStatus 枚举 | ✅ 3/3 | `contracts/family.test.js` |
| 契约 parity：ErrorCodes/ErrorMessages/HttpStatus | ✅ 3/3 | 同上 |
| 契约 parity：FamilyInfo / InvitationCodeInfo / GetMembersResponse DTO 字段 | ✅ 3/3 | 同上 |
| WXML data-id 契约（family-* 8 页） | ✅ 8/8 | `dataids.test.js`（family-welcome/invite/invite-list/members/switch/restore/create/display-mode/join） |

---

## 3. data-id 前缀清单（按页面）

| 页面 | data-id 前缀 | 已锁定（dataids.test.js） | 备注 |
|------|--------------|:--:|------|
| family-welcome | `family-welcome-*` | ✅ | retry-btn / create-btn / join-btn / error / loading |
| family-create | `family-create-*` | ✅ | name-input / role-{parent\|child} / submit-btn / error / char-count |
| family-join | `family-join-*` | ✅ | code-input / submit-btn / back-btn / error |
| family-invite | `family-invite-*` | ✅ | type-{parent\|child} / child-name-input / mode-{preschool\|primary\|upper} / submit-btn / code / copy / share |
| family-invite-list | `family-invite-list-*` | ✅ | list / revoke-btn-{id} / retry / error |
| family-members | `family-members-*` | ✅ | row-{memberId} / invite-btn / invite-list-btn / leave-btn / disband-btn / retry |
| family-switch | `family-switch-*` | ✅ | row-{familyId} / retry |
| family-restore | `family-restore-*` | ✅ | btn / skip-btn / error / success |
| family-display-mode | `family-display-mode-*` | ✅ | mode-{value} / save-btn / error / success |

> **缺失 data-id 标记**：无。dataids.test.js 已锁定 9 个 family 页面 + 1 个 invite 页的全部交互元素。

---

## 4. 风险点

| 风险 | 影响 | 缓解 | 触发场景 |
|------|------|------|----------|
| 已注销成员 30 天后清理任务未实现 | spec R6/R1.b 强制 Must，无测试可能漏实现 | 批次 A 补测 + 触发 IHostedService 测试 | 30 天后 FamilyMember 物理删除未验证 |
| 微信分享卡片端到端未覆盖 | 用户点击卡片→自动填码→确认加入流程未测 | 批次 B 补测 | getShareInfo API 客户端流程断裂 |
| 多家庭状态记忆未测 | 切换家庭不恢复视图/日期 | 批次 C 补 helper 测试 | 切换用户体验降级 |
| 邀请码 5 次碰撞全部失败 503 | spec 提到但未测失败路径 | 批次 A 补测 | 高并发生成时暴露 |
| 家庭成员移除 UI 对自己仍弹菜单 | 误操作风险 | 批次 B 补测 | UI 权限漏洞 |
| 解散家庭名称错误前端未提示 | 用户无法理解拒绝原因 | 批次 C 补测 | 用户体验断裂 |

---

## 5. 不在 Stage 4 落地的项

| 决策 | 原因 |
|------|------|
| 成员搜索（需求 10.1 #1） | 第一期不做（家庭 ≤ 10 人） |
| 解散推送订阅消息通知（需求 10.1 #4） | 第一期不做（成员打开自然看到提示） |
| 差异化展示模式 UI 渲染（需求 9.1） | 第二期实现 |
| E2E（Playwright） | 项目约定不覆盖小程序；日打卡/认证模块同样用 Jest |

---

## 6. 编写时引用的依据

- 需求：`production/staging/2026-08-18-家庭/requirement.md` §3.2（GWT 场景）+ §10.1（待讨论项）
- Epic/Story：`production/staging/2026-08-18-家庭/epic-story.md`（11 Story）
- Spec：`openspec/changes/add-family-module/specs/{family-lifecycle,family-member,family-invite}/spec.md`（ADDED GWT）
- 契约：`openspec/contracts/family/{enums,errors,dto}.json`
- 设计：`openspec/changes/add-family-module/design.md`（ADR-001~005 + API 端点表 + ER 图）
- 后端测试：4 个文件（`api/Family/__tests__/{FamilyLifecycleServiceTests,InvitationCodeServiceTests,FamilyModelTests,FamilyValidatorsTests}.cs`），共约 60 个 `[Fact]`
- 前端测试：13 个文件（`app/__tests__/{services/family,pages/family-*,contracts/family,dataids,services/api}.test.js`），共约 100+ 个 `test`
- 测试规则：`rules/test-standards.md`（测行为不测实现、稳定标识符定位、必有失败路径、覆盖率是结果非目标）

---

## 7. 验收方式

- Stage 4 准入：本测试矩阵通过 req-reviewer + test-reviewer 双审
- 缺口补齐后，最终测试矩阵的"已覆盖/缺口"列应 71/0（除 3 项 P2 留待）
- Stage 4 出准：test-runner 执行 `dotnet test api/ --filter "FullyQualifiedName~Family"` 和 `cd app && npx jest __tests__` 全绿
