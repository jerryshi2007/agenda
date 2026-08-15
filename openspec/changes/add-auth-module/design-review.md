# Design Review (对齐返工复审): 认证与账户模块

> Change: `add-auth-module` | Reviewed by: arch-architect-reviewer | Date: 2026-08-15
>
> 复审目标：复核「对齐新编排规范」返工产出的契约文件（`openspec/contracts/auth/` 3 个文件）+ design.md/tasks.md 变更，重点核验契约覆盖与 `ALREADY_DELETED` 移除后的全线语义一致性。

---

## 复审结论

**契约文件本身正确、完整、格式合规；9 个端点全量覆盖；`ALREADY_DELETED`/409 已全线清除。** 但 design.md prose 存在 2 处删除残留（"16 个错误码"、"401（已注销账户重复请求）"），且上轮遗留的 4 项待定夺项中 #2（DTO 目录清单）与 #5（错误信封）仍需 design.md 落笔修正。无阻塞项，建议有条件批准。

---

## 一、契约文件核验（维度 #8，本次新增检查项）

### 1.1 格式合规性（对照 `dev-contracts` rule 示例）

| 文件 | rule 示例格式 | 实测 | 结果 |
|------|--------------|------|:--:|
| `enums.json` | `{"X": {"values": [...], "description": "..."}}` | `UserStatus` 含 `values` + `description` | 通过 |
| `errors.json` | `{"X": {"httpStatus": N, "message": "中文"}}` | 15 个错误码均为该结构，message 为中文提示 | 通过 |
| `dto.json` | `{"X": {"fields": {"f": {"type": "..", "required": .., "maxLength": ..}}}}` | 13 个 DTO 均为该结构，字段含 type/required/约束/description | 通过 |

结论：三文件与 `dev-contracts` rule 的示例结构一致，无格式偏差。

### 1.2 端点覆盖（design.md §3.4 全部 9 端点 → dto.json）

| # | 端点 | request DTO | response DTO | 覆盖 |
|---|------|-------------|--------------|:--:|
| 1 | POST /auth/login | LoginRequest | LoginResponse | 通过 |
| 2 | POST /auth/refresh | RefreshRequest | RefreshResponse | 通过 |
| 3 | GET /auth/profile | — | ProfileResponse | 通过 |
| 4 | PUT /auth/profile | UpdateProfileRequest | ProfileResponse | 通过 |
| 5 | GET /auth/deletion-status | — | DeletionStatusResponse | 通过 |
| 6 | POST /auth/deletion | — | DeletionResponse | 通过 |
| 7 | POST /auth/deletion/recover | — | RecoverResponse | 通过 |
| 8 | POST /upload/avatar | —（multipart） | UploadAvatarResponse | 通过 |
| 9 | GET /users/me/families | — | UserFamiliesResponse（含 FamilyInfo[]） | 通过 |

13 个 DTO = 9 端点 DTO + 2 个共享类型（`FamilyInfo` 嵌套、`ErrorResponse` 错误信封），无遗漏、无多余。

### 1.3 prose 与契约 JSON 一致性

逐字段比对 design.md §3.4 请求/响应形状与 dto.json，字段名/类型/必填标记一致：

- `LoginResponse`：`jwt/userId/isNewUser/needsProfileCollection`（必填）+ `isDeleted/remainingDays`（可选，注销缓冲期分支）——与 prose 一致，且 `isDeleted` 分支正确处理了"已注销未到期返回 isDeleted"的语义。
- `DeletionStatusResponse`：`isDeleted/canDelete`（必填）+ `blockReason/expiresAt/remainingDays`（可选）——覆盖 prose 的三种形状。
- `ErrorResponse`：`error`（必填）+ `message`（必填）+ `traceId`（可选）——见下方 #5 的保留项。
- 其余 DTO 字段名/类型/约束均与 prose 对齐，无出入。

结论：契约 JSON 与 prose 描述**无字段级出入**，13 DTO / 15 错误码 / 1 枚举全量一致。

### 1.4 错误码场景覆盖

15 个错误码覆盖 §3.4 各端点 Errors 行出现的全部场景：

| 端点 Errors 场景 | 对应错误码 | 状态 |
|------|------|:--:|
| login 400/429/502/503 | CODE_INVALID / CODE_EXPIRED / RATE_LIMITED / WECHAT_API_ERROR / WECHAT_API_TIMEOUT | 覆盖 |
| refresh 400/429 | CODE_INVALID / RATE_LIMITED | 覆盖 |
| profile PUT 400/401/413 | NICKNAME_EMPTY / NICKNAME_TOO_LONG / NICKNAME_SENSITIVE / TOKEN_INVALID / FILE_TOO_LARGE | 覆盖 |
| upload 400/401/413 | FILE_FORMAT_INVALID / TOKEN_INVALID / FILE_TOO_LARGE | 覆盖 |
| deletion 400/401 | FAMILY_STILL_ACTIVE / TOKEN_INVALID | 覆盖 |
| recover 400/401 | NOT_DELETED / EXPIRED / TOKEN_INVALID | 覆盖 |
| 全局兜底 500 | INTERNAL_ERROR | 覆盖 |

结论：**无错误码遗漏**（413/429/500/502/503 均在列），无端点场景缺失对应错误码。

---

## 二、语义一致性核验（`ALREADY_DELETED` 移除）

对 4 处真相源（errors.json / design.md 错误码表 / delta spec / tasks.md）做残留扫描：

| 真相源 | ALREADY_DELETED | 409 | 幂等语义 | 结论 |
|--------|:--:|:--:|------|:--:|
| errors.json | 无 | 无 | — | 一致 |
| design.md §3.4 错误码表（15 行） | 无 | 无 | — | 一致 |
| design.md §3.4 注销端点 prose | — | — | **line 436 残留**（见 S1） | 不一致 |
| design.md §3.4 契约文件表 | — | — | "16 个错误码"（见 S2） | 不一致 |
| delta spec auth-deletion | 无 | 无 | "注销接口幂等 → 返回成功" | 一致 |
| tasks.md Task 25b | 无 | 无 | "已删除 -> 200 幂等" | 一致 |

结论：**错误码表、errors.json、spec、tasks.md 已全线一致**（拍板语义"重复注销幂等返回 200"正确落地）。仅 design.md prose 存在 2 处删除残留（S1、S2），需文字修正，但不影响契约真相源。

---

## 三、上轮遗留 4 项待定夺项判决

### #2 DTO 目录归属（design.md §3.1 Dtos/ 清单漏列）— 判决：需修正，归属如下

§3.1 line 74-81 的 `Dtos/` 清单仅列 7 个 DTO，漏列 6 个。归属判决：

| 漏列 DTO | 正确归属 | 依据 |
|----------|---------|------|
| `RefreshResponse` | `api/Auth/Dtos/` | Task 8b 产出，refresh 端点响应 |
| `DeletionResponse` | `api/Auth/Dtos/` | Task 25a 产出，deletion 端点响应 |
| `UploadAvatarResponse` | `api/Auth/Dtos/` | Task 21 产出，upload 端点响应 |
| `UserFamiliesResponse` | `api/Auth/Dtos/` | Task 23 产出，families 端点响应 |
| `FamilyInfo` | `api/Auth/Dtos/`（暂定，见下） | Task 23 产出，IFamilyQueryService 返回类型 |
| `ErrorResponse` | **`api/Infrastructure/`（非 Auth/Dtos/）** | Task 28a 产出，ExceptionHandlingMiddleware 横切信封 |

- `FamilyInfo` 属跨上下文 DTO：语义真相归 family 域，但当前是 Auth→Family 跨上下文契约（`IFamilyQueryService` 定义在 `api/Auth/`）的返回类型。**首期放 `api/Auth/Dtos/` 可接受**（consumer-driven contract 模式），契约 JSON 已在 `role` 字段标注"契约域归 family"。Family 模块落地后可迁移至共享区。
- `ErrorResponse` 是横切错误信封（所有模块共用，非 auth 专属），MUST 与 `ExceptionHandlingMiddleware.cs` 同置于 `api/Infrastructure/`，不进 `api/Auth/Dtos/`。

**可执行修正**：
1. design.md §3.1 Dtos/ 清单补 `RefreshResponse.cs` / `DeletionResponse.cs` / `UploadAvatarResponse.cs` / `UserFamiliesResponse.cs` / `FamilyInfo.cs`。
2. design.md §3.1 `Infrastructure/` 下（`Middleware/` 旁）补 `ErrorResponse.cs`。
3. tasks.md 对应产出文件补全缺口：Task 21 补 `UploadAvatarResponse.cs`；Task 23 补 `FamilyInfo.cs` + `UserFamiliesResponse.cs`；Task 28a 补 `ErrorResponse.cs`（当前三处仅描述返回形状，未列产出文件，与"每 task 产出文件明确"标准有落差）。

### #3 `FamilyInfo.role` 保留 string、契约域归 family — 判决：合理，维持现状

- 角色取值（家长/孩子，即 parent/child）是 family 域真相，且 family 模块尚未进入设计阶段。
- auth-my-page spec 明确「认证模块 MUST NOT 判断家长/孩子角色」——auth 端对 role **仅透传展示**，不分支、不校验，string 足够。
- 若在 auth 契约里先定义 `FamilyRole` 枚举，会制造与未来 family 枚举的第二真相源，违反 YAGNI + 单一真相。
- **前瞻约定**：family 模块落地时，应在 `openspec/contracts/family/enums.json` 定义 `FamilyRole`，届时 auth `dto.json` 的 `FamilyInfo.role` 改为引用该枚举。当前 string + description 标注（"取值由家庭模块定义，契约域归 family"）是正确的最小建模。

### #4 无 `DeletionStatus` 枚举、用 `UserStatus.Deleted + DeletedAt` — 判决：合理，维持现状

- 注销态本质是二值（Active/Deleted）；"已过期"是 `DeletedAt + 30天` 的**推导值**，从不以持久态存储（到期即物理删除或重建为新用户）。
- 若引入 `DeletionStatus { Active, Deleted, Expired }`，会制造一个与 `DeletedAt` 可能漂移的冗余第三态，违反 YAGNI + 单一真相。
- 与 spec `auth-deletion`「注销接口幂等」「30 天到期永久删除」及 enums.json description 完全一致。
- **非阻塞边界提示**：定时清理未及时执行时存在短暂"Deleted 但 `DeletedAt+30 < now`"窗口。login 惰性检查（时序 9）已兜底（物理删除+重建）；但 recover / deletion-status 端点对该窗口用户的行为建议在 Task 25b 的 7 个测试场景外补 1 个"已过期未清理"用例，确保返回 EXPIRED 而非误判。

### #5 错误信封不统一 — 判决：需在 design.md 明确统一方案

现状三形状并存：

| 来源 | 形状 | 位置 |
|------|------|------|
| 控制器显式错误 | `{ error }` | Task 10 #4/#5/#6、Task 17 #3、Task 18、design.md 时序 3 |
| 异常中间件 | `{ error, message, traceId }` | Task 28a #2、design.md line 790 |
| `[ApiController]` + FluentValidation | ProblemDetails（第三方形状） | 隐含，未显式说明 |

`dto.json` 的 `ErrorResponse` 定义 `message` 为 **required**、`traceId` 为 optional——但控制器显式错误 `{ error }` 无 `message`，导致契约与实现相悖：前端/测试按 `ErrorResponse` 消费时，控制器错误的 `message` 会缺省。

**建议（选一，推荐方案 A）**：
- **方案 A（推荐）**：统一信封为 `{ error, message, traceId }`，`error`/`message` 必填（message 从 errors.json 取中文提示，为前端展示权威值），`traceId` 仅中间件生成时可选。控制器级显式错误（400/401/413/429/502/503）MUST 也返回 `{ error, message }`，使 `ErrorResponse.message` required 成立。
- **方案 B（退而求其次）**：将 `ErrorResponse.message` 降为 optional，明确控制器错误 message 可为空。

需在 design.md §3.4 增加一句「统一错误信封」说明，并确保 `ErrorResponse` DTO 描述与之对齐。此决策若留到 Task 28a 才定，会导致 dev-miniapp（Task 11/19 响应拦截器）与 test-writer 返工。

---

## 四、10 维度总览

| # | 维度 | 结论 | 说明 |
|---|------|:--:|------|
| 1 | 需求覆盖 | ✅ | 5 个 delta spec 的 Requirement 均有对应实体/API/时序（登录/续期/资料/我的页/注销全覆盖） |
| 2 | ER 关系可反推 | ✅ | User—PrivacyConsent / User—Deletion / User—FamilyMember 基数均从 spec scenario 反推 |
| 3 | 时序完整 | ✅ | 10 个时序覆盖正常+异常+并发+边界（含 30 天到期惰性清理） |
| 4 | ADR 充分 | ✅ | 9 个 ADR（认证/分层/UI框架/状态管理/清理策略/头像存储）均含四段式 |
| 5 | 规则合规 | ✅ | 6 条 rule 扫描无违规；契约文件格式合规 |
| 6 | 质量底线 | ✅ | 无 TBD/TODO；Risks R1-R8 识别关键风险 |
| 7 | 限界上下文合理 | ✅ | Auth/Family/Event 聚合边界清晰；IFamilyQueryService 跨上下文契约模式合理 |
| 8 | API 契约完整 | ⚠️ | 契约文件本身完整覆盖 9 端点；但 ErrorResponse 信封三形状并存（#5）+ Dtos/ 目录清单漏列（#2） |
| 9 | 前端架构对齐 | ✅ | 路由表/TabBar/组件树/data-id 表/安全区域完备 |
| 10 | 构建序列可行 | ✅ | T1→T28b 依赖无循环；集成时机合理；AUTH-004 降级策略明确 |

本次返工未引入新的需求覆盖/ER/时序/ADR/规则/质量类问题。

---

## 五、问题清单

### 阻塞项

（无。）

### 建议项（审批前建议修复，均为轻量文档修正，不改契约值）

| # | 位置 | 问题 | 建议修正 |
|---|------|------|---------|
| S1 | design.md §3.4 line 436 | 注销端点 Errors 行残留 `401（已注销账户重复请求 → 幂等返回 200）`——幂等重复请求是 **200 成功**（非 401），此措辞与拍板语义相悖，系 `ALREADY_DELETED` 移除时误改 | 改为：`Errors: 400 (FAMILY_STILL_ACTIVE), 401 (TOKEN_INVALID)；已注销账户重复请求 → 幂等返回 200（非错误）` |
| S2 | design.md §3.4 line 510 | 契约文件表 `errors.json` 仍写「16 个错误码」，实际已 15 个（`ALREADY_DELETED` 已移除） | 改为「15 个错误码」 |
| S3 | design.md §3.1 line 74-81 + tasks.md | Dtos/ 目录清单漏列 6 个 DTO；tasks.md 3 处产出文件缺 DTO 类 | 见上文 #2 判决的 3 步修正 |
| S4 | design.md §3.4 + dto.json ErrorResponse | 错误信封三形状并存（控制器 `{error}` / 中间件 `{error,message,traceId}` / FluentValidation ProblemDetails） | 见上文 #5 判决，选方案 A/B 之一并在 §3.4 落笔 |

### 次要建议（不影响审批，可在 implementation 顺手处理）

| # | 位置 | 问题 |
|---|------|------|
| S5 | design.md §3.4 上传头像 Errors 行 | prose 写「400 (invalid format/size)」——size 应映射 413（FILE_TOO_LARGE），format 才映射 400（FILE_FORMAT_INVALID），与错误码表/Task 21 不一致 |
| S6 | design.md 时序 1 line 729 | 响应字段写 `needsProfile:true`，与 prose/dto 的 `needsProfileCollection` 不一致 |
| S7 | design.md §3.4 line 513 | 「类比 event 模块归 schedule 域的惯例」——`openspec/contracts/` 下目前并无 schedule 域（event 模块归档时未提取契约），该「惯例」是展望而非既成事实，建议改为「未来 event 模块同样归 schedule 域」或删除类比，避免误导 |

### 疑问项

（无——#3、#4 已在上文给出明确「合理」判决，不需审批人再确认。）

---

## 六、三判决

| 判决维度 | 结论 | 说明 |
|---------|:--:|------|
| 设计质量 | ✅ 合格 | 契约文件质量高、9 端点全量覆盖、字段无出入；#3/#4 建模决策合理；残留为 prose 文档小瑕，不影响契约真相源 |
| 规则合规 | ✅ 合规 | 契约文件格式符合 `dev-contracts` rule 示例；无规则违规；无 TBD/TODO |
| 审批建议 | ⚠️ 建议有条件批准 | 条件 = 修复 S1-S4 四项（2 处删除残留 + DTO 目录清单 + 错误信封统一方案），均为轻量文档修正，不需改契约值 |

---

## 七、待澄清问题及结果

| 项 | 问题 | 结果 |
|----|------|------|
| #2 | 漏列 DTO 的归属目录 | 判决：5 个归 `api/Auth/Dtos/`，`ErrorResponse` 归 `api/Infrastructure/`（见 §三 #2） |
| #3 | `FamilyInfo.role` 保留 string、契约域归 family | 判决：合理，维持（见 §三 #3） |
| #4 | 无 `DeletionStatus` 枚举、用 `UserStatus.Deleted + DeletedAt` | 判决：合理，维持（见 §三 #4） |
| #5 | 错误信封不统一 | 判决：需在 design.md 明确统一方案，推荐方案 A（见 §三 #5） |

---

## 八、审核备注

- 本次复审范围：`openspec/contracts/auth/` 3 个契约文件 + design.md §3.4 契约小节/错误码表 + tasks.md 头部说明，未改动 design.md/tasks.md/contracts。
- 契约文件（enums/errors/dto）本身**无需任何修改**，可直接作为三端消费真相源。
- design.md 的 2 处删除残留（S1/S2）是本次对齐返工的唯一硬伤，务必随 S3/S4 一并修正后移交 dev-dotnet + dev-miniapp。
- 上轮 7 阻塞项修复结论维持有效（见 2026-08-08 复审报告），本次未回归。
