# Test Plan: 认证与账户模块 (add-auth-module)

> Change: `add-auth-module` | Stage: Stage 4 (测试) | Date: 2026-08-16
>
> 下游：test-writer | 覆盖范围：E2E（**API 级**，Playwright `request` fixture 直连 .NET Web API，无浏览器项目）

---

## 1. 测试策略总览

### 1.1 E2E 定位（API 级）

本项目 E2E 为 **API 级测试**：Playwright 的 `request` fixture 直连后端 `.NET 10 Web API`，通过 `Authorization: Bearer <jwt>` 与 JSON/multipart 请求体驱动真实后端，无浏览器项目（见 `testing/e2e/playwright.config.js` 的 `projects: [{ name: 'api-tests' }]`）。认证模块的 9 个端点均在本计划覆盖范围内。

### 1.2 与 Jest 单元测试的分工

| 关注点 | 覆盖方式 | 说明 |
|--------|---------|------|
| 后端服务层逻辑（AuthService/JwtService/WeChatService/限流） | `.NET` 单元测试（`api/**/__tests__/*Tests.cs`，xUnit + Moq） | 已随 Stage 3 研发完成 |
| 后端 HTTP 契约、错误码、状态码、鉴权、频率限制、30 天惰性清理 | **本 E2E（Playwright API 级）** | 本计划产出 |
| 小程序前端 UI/组件（隐私弹窗、收集页、"我的"页、data-id 契约） | `dev-miniapp-tdd`（Jest + miniprogram-simulate） | 不属于 E2E |

**结论**：E2E 只验证「API 行为是否与契约/需求一致」，不验证小程序 UI。`data-id` 定位契约由小程序 Jest 测试消费，E2E 不涉及（详见 §4）。

### 1.3 方法（test-case-design skill）

- **等价类划分**：对输入/状态划分合法类 + 非法类，每类选代表用例（如昵称：合法 / 空 / 超长 / 敏感词）。
- **边界值**：字段长度（昵称 20 字符 max-1/max/max+1）、文件大小（2MB 边界）、注销 30 天缓冲（未到期 / 到期）。
- **错误路径**：code 无效/过期、微信超时/异常、鉴权失败、频率限制、家庭拦截（不可达，见 gap 标记）。
- **去冗余**：jpg/jpeg/png/gif 属同一「合法扩展名」等价类，保留 png 为代表；`NICKNAME_TOO_LONG` 用 21 字符（max+1）代表超长类，不再测 22/50 字符。
- **优先级**：Must（核心/阻塞）/ Should（边界/降级）/ Could（低频/边缘）。

### 1.4 优先级定义

| 级别 | 含义 | 对应需求优先级 |
|:--:|------|------|
| Must | 核心路径与安全底线——失败则模块不可用或鉴权失效 | requirement.md Must |
| Should | 边界/异常/降级路径 | requirement.md Should |
| Could | 低频/边缘（时钟偏差、密钥轮换、文件替换清理等） | requirement.md Could / 非功能补充 |

---

## 2. 测试矩阵

> 预期错误码统一标注为 `errors.json` 中的键名（如 `CODE_INVALID`），测试代码 MUST 通过 §3.4 方式引用，禁止硬编码字符串。
> 标记 `⚠️ GAP` 的用例当前 **E2E 不可达**，原因与替代方案见 §2.9 与 §6。

### 2.A 登录 (POST /api/v1/auth/login)

| ID | 场景 | Given（前置） | When（操作） | Then（预期状态码/错误码/字段） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-LOGIN-001 | 新用户首次登录 | 微信 mock 返回全新 openid（code=`brand-new`），DB 无该 openid 用户 | `POST /auth/login` body=`{code:"brand-new"}` | 200；`isNewUser=true`、`needsProfileCollection=true`；DB 新增 User（`Nickname="微信用户"`、`Status=Active`）；返回 7 天有效期 JWT | Must |
| TC-LOGIN-002 | 已有用户登录 | seed User（`Active`、`OpenId=mock-existing`、`Nickname="小明妈妈"`） | `POST /auth/login` body=`{code:"existing"}` | 200；`isNewUser=false`、`needsProfileCollection=false`、`userId`=seed 用户；`LastLoginAt` 更新 | Must |
| TC-LOGIN-003 | 已有用户但昵称为默认值 | seed User（`Active`、`Nickname="微信用户"`） | `POST /auth/login` body=`{code:"default-nick"}` | 200；`isNewUser=false`、`needsProfileCollection=true` | Should |
| TC-LOGIN-004 | code 为空 | 无 | `POST /auth/login` body=`{code:""}` | 400 `CODE_INVALID`（`LoginRequestValidator.NotEmpty`） | Must |
| TC-LOGIN-005 | code 无效（微信 errcode 40029） | 微信 mock 对 `invalid-*` code 抛 `WeChatApiException(40029)` | body=`{code:"invalid-code"}` | 400 `CODE_INVALID` | Must |
| TC-LOGIN-006 | code 已过期（微信 errcode 40163） | 微信 mock 对 `expired-*` code 抛 `WeChatApiException(40163)` | body=`{code:"expired-code"}` | 400 `CODE_EXPIRED` | Should |
| TC-LOGIN-007 | 微信服务异常（其他 errcode） | 微信 mock 对 `apierror-*` code 抛 `WeChatApiException(50000)` | body=`{code:"apierror-code"}` | 502 `WECHAT_API_ERROR` | Should |
| TC-LOGIN-008 | 微信 API 超时 | 微信 mock 对 `timeout-*` code 抛 `WeChatTimeoutException` | body=`{code:"timeout-code"}` | 503 `WECHAT_API_TIMEOUT` | Should |
| TC-LOGIN-009 | 注销 30 天到期惰性清理 | seed User（`Status=Deleted`、`DeletedAt=now-31d`、`OpenId=mock-expired`） | body=`{code:"expired"}` | 200；`isNewUser=true`；新 `userId` ≠ 旧 `userId`；旧 User 物理删除（DB 中 `OpenId=mock-expired` 记录 `DeletedAt` 已重建） | Must |
| TC-LOGIN-010 | 注销未到期返回 isDeleted | seed User（`Status=Deleted`、`DeletedAt=now-5d`、`OpenId=mock-soft-deleted`） | body=`{code:"soft-deleted"}` | 200；`isDeleted=true`、`remainingDays≈25`、`isNewUser=false`；返回临时 JWT（用于恢复流程） | Must |
| TC-LOGIN-011 | 微信账号切换（新 openid） | seed User（`Active`、`OpenId=mock-a`） | body=`{code:"brand-new-2"}`（mock openid 无对应记录） | 200；`isNewUser=true`，创建全新账户 | Should |
| TC-LOGIN-012 | 登录频率限制 | 同一来源 1 分钟内已调 login 10 次 | 第 11 次 `POST /auth/login` | 429 `RATE_LIMITED`（**需隔离执行，见 §6 R3**） | Should |

### 2.B 续期 (POST /api/v1/auth/refresh)

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-REFRESH-001 | 正常续期 | seed User（`Active`、`OpenId=mock-refresh`） | `POST /auth/refresh` body=`{code:"refresh"}` | 200；`{jwt, userId}`，新 JWT 有效（携带后访问受保护端点返回 200） | Must |
| TC-REFRESH-002 | code 无效 | 微信 mock 对 `invalid-*` 抛 40029 | body=`{code:"invalid-code"}` | 400 `CODE_INVALID` | Must |
| TC-REFRESH-003 | code 为空 | 无 | body=`{code:""}` | 400 `CODE_INVALID` | Should |
| TC-REFRESH-004 | 已注销用户续期 | seed User（`Status=Deleted`、`OpenId=mock-refresh-deleted`） | body=`{code:"refresh-deleted"}` | 401 `TOKEN_INVALID`（`RefreshAsync` 仅接受 Active） | Should |
| TC-REFRESH-005 | 微信超时 | mock 对 `timeout-*` 抛超时 | body=`{code:"timeout-code"}` | 503 `WECHAT_API_TIMEOUT` | Should |
| TC-REFRESH-006 | 续期频率限制 | 1 分钟内已调 refresh 10 次 | 第 11 次 `POST /auth/refresh` | 429 `RATE_LIMITED`（**需隔离执行，见 §6 R3**） | Should |

### 2.C 用户资料 (GET / PUT /api/v1/auth/profile)

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-PROFILE-001 | 获取资料（正常） | 有效 JWT + seed User | `GET /auth/profile` | 200；`{userId, nickname, avatarUrl?, createdAt}` 与 seed 一致 | Must |
| TC-PROFILE-002 | 获取资料无 Token | 无 Authorization | `GET /auth/profile` | 401 `TOKEN_INVALID` | Must |
| TC-PROFILE-003 | 获取资料过期 Token | `jwt-helper.generateExpiredToken()` | `GET /auth/profile` | 401 `TOKEN_INVALID` | Should |
| TC-PROFILE-004 | 获取资料篡改 Token | `jwt-helper.generateInvalidToken()` | `GET /auth/profile` | 401 `TOKEN_INVALID` | Should |
| TC-PROFILE-005 | 更新昵称（正常） | 有效 JWT | `PUT /auth/profile` body=`{nickname:"新昵称"}` | 200；返回 `nickname="新昵称"`；DB 已更新 | Must |
| TC-PROFILE-006 | 昵称为空 | 有效 JWT | body=`{nickname:""}` | 400 `NICKNAME_EMPTY` | Must |
| TC-PROFILE-007 | 昵称恰好 20 字符（max 边界） | 有效 JWT | body=`{nickname:"<20 字符>"}` | 200；昵称更新成功 | Should |
| TC-PROFILE-008 | 昵称 21 字符（max+1 边界） | 有效 JWT | body=`{nickname:"<21 字符>"}` | 400 `NICKNAME_TOO_LONG` | Must |
| TC-PROFILE-009 | 昵称含敏感词 | 有效 JWT | body=`{nickname:"涉及赌博内容"}` | 400 `NICKNAME_SENSITIVE`（关键词：赌博/色情/毒品/诈骗） | Must |
| TC-PROFILE-010 | 更新头像 URL（正常） | 有效 JWT | body=`{nickname:"小明", avatarUrl:"/uploads/avatars/x.png"}` | 200；返回 `avatarUrl` 已更新 | Should |
| TC-PROFILE-011 | 更新资料无 Token | 无 Authorization | `PUT /auth/profile` body=`{nickname:"x"}` | 401 `TOKEN_INVALID` | Should |

### 2.D 注销状态查询 (GET /api/v1/auth/deletion-status)

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-DELETION-001 | 无家庭可注销 | 有效 JWT + seed User（`Active`，无家庭） | `GET /auth/deletion-status` | 200；`{isDeleted:false, canDelete:true, blockReason:null}` | Must |
| TC-DELETION-002 | 无 Token | 无 Authorization | `GET /auth/deletion-status` | 401 `TOKEN_INVALID` | Must |
| TC-DELETION-003 | 已注销状态 | seed User（`Status=Deleted`、`DeletedAt=now-5d`）+ 临时 JWT | `GET /auth/deletion-status` | 200；`{isDeleted:true, remainingDays≈25, expiresAt}` | Must |
| TC-DELETION-004 | 有家庭被拦截 | seed 用户属于家庭 | `GET /auth/deletion-status` | 200 `{canDelete:false, blockReason:"FAMILY_STILL_ACTIVE"}` | ⚠️ GAP |

### 2.E 注销账户 (POST /api/v1/auth/deletion)

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-DELETE-001 | 正常注销 | 有效 JWT + seed User（`Active`，无家庭） | `POST /auth/deletion`（空 body） | 200；`{expiresAt≈now+30d, remainingDays=30}`；DB `Status=Deleted`、`DeletedAt` 非空 | Must |
| TC-DELETE-002 | 注销幂等（已注销再注销） | User 已 `Deleted`（`DeletedAt=T0`） | 再次 `POST /auth/deletion` | 200；返回基于 `T0` 的 `expiresAt/remainingDays`，`DeletedAt` 不变（无副作用） | Must |
| TC-DELETE-003 | 有家庭拦截 | seed 用户属于家庭 | `POST /auth/deletion` | 400 `FAMILY_STILL_ACTIVE` | ⚠️ GAP |
| TC-DELETE-004 | 无 Token | 无 Authorization | `POST /auth/deletion` | 401 `TOKEN_INVALID` | Must |

### 2.F 恢复注销 (POST /api/v1/auth/deletion/recover)

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-RECOVER-001 | 正常恢复 | seed User（`Status=Deleted`、`DeletedAt=now-5d`）+ 登录返回的临时 JWT | `POST /auth/deletion/recover`（空 body） | 200；`{jwt, userId}`；DB `Status=Active`、`DeletedAt=null`；新 JWT 可访问受保护端点 | Must |
| TC-RECOVER-002 | 未注销用户恢复 | seed User（`Active`）+ 有效 JWT | `POST /auth/deletion/recover` | 400 `NOT_DELETED` | Must |
| TC-RECOVER-003 | 已过期恢复 | seed User（`Status=Deleted`、`DeletedAt=now-31d`）+ JWT | `POST /auth/deletion/recover` | 400 `EXPIRED` | Must |
| TC-RECOVER-004 | 无 Token | 无 Authorization | `POST /auth/deletion/recover` | 401 `TOKEN_INVALID` | Must |
| TC-RECOVER-005 | 恢复后旧 Token 继续有效（另一设备） | 用户恢复后仍持有恢复前的 JWT | 用恢复前 JWT `GET /auth/profile` | 200（后端已恢复，旧 JWT 未过期仍有效） | Should |

### 2.G 头像上传 (POST /api/v1/upload/avatar)

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-AVATAR-001 | 正常上传 png | 有效 JWT + 一个 <2MB 的合法 png 文件 | `POST /upload/avatar`（multipart/form-data `file`） | 200；`{url}` = `{AvatarBaseUrl}/{userId}.png`；文件落盘到 `AvatarRootPath` | Must |
| TC-AVATAR-002 | 格式无效 | 有效 JWT + `.txt` 文件 | `POST /upload/avatar` | 400 `FILE_FORMAT_INVALID`（仅 jpg/jpeg/png/gif 合法） | Must |
| TC-AVATAR-003 | 空文件 | 有效 JWT + 0 字节文件 | `POST /upload/avatar` | 400 `FILE_FORMAT_INVALID` | Should |
| TC-AVATAR-004 | 大小超限 | 有效 JWT + >2MB 文件 | `POST /upload/avatar` | 413 `FILE_TOO_LARGE`（上限 2MB） | Must |
| TC-AVATAR-005 | 无 Token | 无 Authorization | `POST /upload/avatar` | 401 `TOKEN_INVALID` | Must |
| TC-AVATAR-006 | 上传替换旧头像（扩展名不同） | 已有 `{userId}.png`，再传 `.jpg` | `POST /upload/avatar`（.jpg） | 200；旧 `.png` 文件被清理，仅保留 `{userId}.jpg` | Could |

### 2.H 用户家庭列表 (GET /api/v1/users/me/families)

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-FAMILIES-001 | 空实现返回空数组 | 有效 JWT | `GET /users/me/families` | 200；`{families:[]}`（`EmptyFamilyQueryService`） | Must |
| TC-FAMILIES-002 | 无 Token | 无 Authorization | `GET /users/me/families` | 401 `TOKEN_INVALID` | Must |
| TC-FAMILIES-003 | 有家庭返回列表 | seed 用户属于家庭 | `GET /users/me/families` | 200；`families` 含 `{familyId,familyName,role,memberCount}` | ⚠️ GAP |

### 2.I 横切（统一错误信封 / JWT 边界）

| ID | 场景 | Given（前置） | When（操作） | Then（预期） | 优先级 |
|:--|------|------|------|------|:--:|
| TC-CROSS-001 | 统一错误信封 | 触发任意错误（如 `CODE_INVALID`） | 观察错误响应体 | 200/错误响应含 `{error, message}` 且非空；`traceId` 字段存在（可缺省/null）；`error` 与 `message` 与 `errors.json` 一致 | Must |
| TC-CROSS-002 | JWT 过期前 5 分钟策略 | 构造剩余有效期 <5min 且 >0 的 JWT | 携带该 JWT 访问受保护端点 | 401 `TOKEN_INVALID`（后端 `PreExpiryWindow=5min` 提前拒绝） | Could |
| TC-CROSS-003 | 时钟偏差 30 秒容忍 | 构造 `exp=now-10s`（仍在 30s ClockSkew 内）的 JWT | 携带访问受保护端点 | 200（`ClockSkew=30s` 容忍） | Could |

### 2.9 GAP 用例说明（E2E 不可达）

| GAP 用例 | 原因 | 替代覆盖 | 解除条件 |
|---------|------|---------|---------|
| TC-DELETION-004（`blockReason=FAMILY_STILL_ACTIVE`） | `IFamilyQueryService` 注册为 `EmptyFamilyQueryService`，始终返回空列表，`canDelete` 恒为 true | `api/Auth/__tests__/AuthServiceTests.cs`（`CreateFamilyMock(hasFamily:true)`）已单元覆盖 | Family 模块实现 `IFamilyQueryService` 后，E2E 补种家庭关系即可测 |
| TC-DELETE-003（`400 FAMILY_STILL_ACTIVE`） | 同上 | 同上 | 同上 |
| TC-FAMILIES-003（有家庭返回列表） | 同上 | `dto.json` 的 `FamilyInfo` 结构契约 + 家庭模块 E2E | 同上 |

> **GAP 处理原则**：test-writer 为上述 3 条生成 `test.skip` 占位用例并注释原因，避免未来家庭模块落地时遗漏；当前不计入通过/失败统计。

---

## 3. 测试数据策略

### 3.1 Seed 方式

沿用 `testing/e2e/helpers/seed-db.js` 的「直连 PostgreSQL（`pg`）」模式，在 `global-setup.js` 中新增认证模块 seed（或扩展 `seed-db.js`）。**关键**：认证 User 表 schema 已随 `AlignUserWithAuthContract` 迁移变更（见 §6 R4），seed SQL MUST 使用新列名，禁止沿用日程模块旧 seed 的 `IsDeleted`/`UpdatedAt`：

| 列 | 类型 | 说明 |
|------|------|------|
| `Id` | uuid PK | 固定 GUID，供 JWT 构造与断言 |
| `OpenId` | varchar(64) UNIQUE | 必须与微信 mock 的 openid 推导规则一致 |
| `Nickname` | varchar(20) 默认「微信用户」 | |
| `AvatarUrl` | varchar(500) NULL | |
| `Status` | int | `0=Active` / `1=Deleted`（对应 `enums.json` `UserStatus`） |
| `Role` | int | `1=Parent` / `2=Child`（本模块 E2E 不依赖） |
| `DeletedAt` | timestamptz NULL | 注销时间 |
| `CreatedAt` / `LastLoginAt` | timestamptz | |

建议 seed 用户清单（OpenId 与 mock 规则 `"mock-"+code` 对齐）：

| 用户 | OpenId | 状态 | 用途 |
|------|--------|------|------|
| USER_ACTIVE | `mock-existing` | Active / 昵称「小明妈妈」 | TC-LOGIN-002 |
| USER_DEFAULT_NICK | `mock-default-nick` | Active / 昵称「微信用户」 | TC-LOGIN-003 |
| USER_SOFT_DELETED | `mock-soft-deleted` | Deleted / DeletedAt=now-5d | TC-LOGIN-010 / TC-RECOVER-001 |
| USER_EXPIRED_DELETED | `mock-expired` | Deleted / DeletedAt=now-31d | TC-LOGIN-009 |
| USER_REFRESH | `mock-refresh` | Active | TC-REFRESH-001 |
| USER_REFRESH_DELETED | `mock-refresh-deleted` | Deleted | TC-REFRESH-004 |
| USER_PROFILE | （任意固定 GUID） | Active | profile 系列 |

> 每个用例独立 seed、测试后清理（仿 `fixtures/seed-data.js` 的 `seedSchedule/cleanupSchedule` 模式），保证用例间互不依赖。

### 3.2 JWT 生成方式（绕过微信登录）

受保护端点（profile/deletion/recover/avatar/families）**不走真实微信登录**，直接用 `helpers/jwt-helper.js` 生成 JWT（复用日程模块 A2 假设）。生成规则：

- 载荷含 `sub`/`userId`（= seed 用户 GUID）；`iss="agenda-api"`；`HS256` 签名。
- 后端 `GetUserId()` 依次读 `ClaimTypes.NameIdentifier`→`sub`→`userId`，`JwtBearer` 校验 `issuer=agenda-api`、`ClockSkew=30s`、`ValidateAudience=false` —— 与 `jwt-helper.js` 现有载荷兼容。
- **密钥对齐（MUST）**：`jwt-helper.js` 的 `JWT_SECRET`（默认 `AgendaDevKey-2026-...`）与后端运行时的 `JWT_SECRET_KEY`/`Jwt:SecretKey`（`appsettings.Development.json` 为 `dev-only-insecure-secret-key-for-local-development-change-me`）**不一致**。Gate 0 必须统一（见 §5）。推荐：后端以 `JWT_SECRET_KEY` 环境变量启动，测试侧以同名 `JWT_SECRET` 传入，二者取同一值。

### 3.3 微信 code 的 mock 方式（关键决策）

登录/续期依赖微信 `jscode2session`，而 `api/Infrastructure/Auth/WeChatService.cs` 硬编码 `https://api.weixin.qq.com/sns/jscode2session`，**当前无 mock 模式**。E2E 无法直连真实微信，也难在网络层拦截后端的出站 HTTP。因此推荐 **在 `WeChatService` 增加测试专用 mock 模式（test-only 配置开关）** 作为前置基础设施变更：

```jsonc
// appsettings.Development.json（或环境变量 WeChat__MockMode=true）
"WeChat": {
  "MockMode": true,
  "MockOpenIdPrefix": "mock-"
}
```

`WeChatService.GetSessionAsync(code)` 在 `MockMode=true` 时的行为契约：

| code 前缀 | 行为 | 映射错误码 |
|-----------|------|-----------|
| `invalid-*` | `throw WeChatApiException(40029)` | `CODE_INVALID` (400) |
| `expired-*` | `throw WeChatApiException(40163)` | `CODE_EXPIRED` (400) |
| `apierror-*` | `throw WeChatApiException(50000)` | `WECHAT_API_ERROR` (502) |
| `timeout-*` | `throw WeChatTimeoutException` | `WECHAT_API_TIMEOUT` (503) |
| 其他 | `return WeChatSession(OpenId = "mock-"+code, SessionKey="mock", UnionId=null)` | 正常 |

**优势**：openid 由 `code` 确定性推导，测试可精确控制「新用户 / 已有用户 / 已注销未到期 / 已注销到期」四种登录分支，也无需额外 mock 服务器进程。

**回退方案（若不改后端）**：仅能测「受保护端点」的 401 与资料/注销/头像行为（直接 JWT + 直接 DB seed），**登录/续期/30 天惰性清理系列全部推迟**。此方案会导致 §2.A/§2.B 大部分用例不可执行，不作为首选。

> 该 mock 是测试基础设施（非产品逻辑），由 test-writer 或主代理与 dev-dotnet 协作落地，不在 test-planner 职责内；本计划将其列为 Gate 0 前置项。

### 3.4 错误码断言的消费方式（MUST）

测试代码禁止硬编码错误码/状态码字符串，MUST 引用契约文件：

```js
// testing/e2e/specs/auth-login.spec.js
const errors = require('../../../openspec/contracts/auth/errors.json');
const enums  = require('../../../openspec/contracts/auth/enums.json');

// 断言错误码（禁止写裸字符串 'CODE_INVALID'）
expect(res.status()).toBe(errors.CODE_INVALID.httpStatus); // 400
expect(body.error).toBe('CODE_INVALID');
// 更严格：从契约取键名，避免键名漂移
expect(body.error).toBe(Object.keys(errors).find(k => k === 'CODE_INVALID'));
expect(body.message).toBe(errors.CODE_INVALID.message); // "微信登录凭证无效，请重试"
```

- 状态码断言：`errors.<CODE>.httpStatus`（与后端 `ErrorCodes.HttpStatus()` 同源）。
- 中文 message 断言：`errors.<CODE>.message`（前端展示权威值）。
- 枚举断言：`enums.UserStatus.values`（`Active`/`Deleted`）对应 DB `Status` 的 `0/1`。
- DTO 字段名/类型：`dto.json`（如 `ErrorResponse` 的 `error/message/traceId`、`LoginResponse` 的 `isNewUser/needsProfileCollection`）。

---

## 4. data-id 清单与缺失标记（E2E 不适用）

本 E2E 为 API 级测试，**不使用 `data-id` 定位元素**（无浏览器 DOM）。认证模块的可交互元素 `data-id`（`privacy-dialog-*`、`profile-edit-*`、`mine-*`、`settings-*`、`deleted-recovery-*` 等，完整清单见 `design.md` §3.5「前端 data-id 速查表」）由小程序 Jest 测试（`dev-miniapp-tdd`）消费，不在本计划覆盖范围。

**缺失 data-id 标记**：不适用。若后续为认证模块新增 UI 级 E2E（浏览器/小程序自动化），再按 `dev-miniapp-standards` 的可测试性契约补全标记。

---

## 5. 环境依赖与 Gate 0 就绪检查清单

> test-runner 在 Gate 0 逐项检查，任一未通过则 STOP（不执行测试）。

| # | 检查项 | 就绪标准 | 失败处置 |
|:--|------|------|------|
| G0-1 | .NET API 运行 | `GET {baseURL}/health` 返回 200 | STOP：启动 `dotnet run --project api/Agenda.Api.csproj` |
| G0-2 | PostgreSQL 就绪 + 迁移完成 | `seed-db.js` 直连成功，`Users` 表存在且含 `Status/DeletedAt/LastLoginAt` 列 | STOP：`dotnet ef database update` 后重试 |
| G0-3 | **JWT 密钥对齐** | `jwt-helper.js` 的 `JWT_SECRET` == 后端 `JWT_SECRET_KEY`（或 `Jwt:SecretKey`） | STOP：统一环境变量后重启 API |
| G0-4 | **微信 mock 就绪** | 后端以 `WeChat:MockMode=true` 启动（§3.3 前置变更已落地）；`POST /auth/login` code=`brand-new` 返回 200 | STOP：回退到 §3.3 回退方案并调整用例范围 |
| G0-5 | 契约文件可读 | `require('.../openspec/contracts/auth/errors.json')` 成功，含 15 个错误码 | STOP：检查 contracts 路径 |
| G0-6 | 头像存储目录可写 | `Storage:AvatarRootPath`（默认 `uploads/avatars`）目录存在或可创建 | 告警：TC-AVATAR 系列会失败 |
| G0-7 | seed 幂等 | 重复执行 seed 不报错（`ON CONFLICT`/`TRUNCATE`） | STOP：修正 seed 脚本 |

---

## 6. 风险点与假设

### 6.1 关键风险

| # | 风险 | 影响 | 缓解 |
|:--|------|------|------|
| R1 | 微信 `jscode2session` 无 mock，登录/续期 E2E 无法执行 | §2.A/§2.B 大部分用例阻塞 | §3.3 mock 模式作为 Gate 0 前置项（G0-4） |
| R2 | JWT 密钥不一致（`jwt-helper.js` vs 后端） | 所有受保护端点误报 401 | G0-3 强制对齐；建议单一路径 `JWT_SECRET_KEY` |
| R3 | **login/refresh 频率限制按 IP（匿名）共享**，所有 E2E 同源 localhost，1 分钟内 >10 次即 429 污染 | TC-LOGIN/REFRESH 系列互相污染，429 误报 | (a) 429 用例（TC-LOGIN-012/TC-REFRESH-006）单独 spec 最后执行；(b) 若频率限制可配置，测试环境调高/关闭 `PermitLimit`；(c) 其余 login/refresh 用例合并串行、控制总数 ≤10 |
| R4 | Users 表 schema 已迁移（`IsDeleted`/`UpdatedAt` 已改为 `Status`/`DeletedAt`/`LastLoginAt`），日程模块旧 seed 与之一致性脱钩 | 直接复用旧 seed 会失败 | §3.1 新 seed 使用新列名；认证 seed 与日程 seed 分文件 |
| R5 | `IFamilyQueryService` 空实现导致 `FAMILY_STILL_ACTIVE` 不可达 | 家庭拦截类用例 GAP | 已标记 GAP + `test.skip` 占位；家庭模块落地后解除 |
| R6 | 30 天惰性清理依赖 `DeletedAt` 精确时间（now±31d），构造误差导致 `remainingDays` 断言不稳 | TC-LOGIN-009/010、TC-RECOVER-003 | `remainingDays` 用范围断言（如 `24≤n≤26`）；到期用 `now-31d` 明确超过 30 天 |

### 6.2 假设

| # | 假设 | 影响范围 |
|:--|------|------|
| A1 | 测试环境 PostgreSQL 可随意增删改 | 全部后端用例 |
| A2 | 受保护端点 JWT 可直接构造，无需走完整微信登录 | profile/deletion/recover/avatar/families |
| A3 | 系统时钟为服务器时间，注销/过期判定以服务器为准 | deletion/recover/login 30 天系列 |
| A4 | `EmptyFamilyQueryService` 在首期 E2E 始终生效（无家庭） | deletion-status/deletion 的 canDelete=true |
| A5 | 微信 mock 的 openid 推导规则固定为 `"mock-"+code` | 登录系列 seed 的 OpenId 必须与之对齐 |
| A6 | 头像上传后 URL 前缀为 `Storage:AvatarBaseUrl`，文件落盘 `Storage:AvatarRootPath` | avatar 系列断言 |

### 6.3 已知实现观察（供 test-writer 参考，不新增用例）

- `GetProfileAsync`/`UpdateProfileAsync` 按 `Id` 查找用户，**未过滤 `Status`**：注销用户的 JWT（如恢复前的临时 JWT）仍可访问 profile。这是当前实现行为，若测试中遇到「注销后 profile 仍 200」属预期，不是 bug；是否应拒绝由后续评审决定。

---

## 7. 失败分类策略（供 test-runner 复用）

test-runner 对每个失败用例归类，分类决定处置动作：

| 分类 | 判定特征 | 处置 |
|------|---------|------|
| `ENV-NOT-READY` | `health` 失败、DB 连接失败、seed 报错 | 回 Gate 0 修复环境后重跑 |
| `MOCK-MISSING` | 登录/续期返回 502/503/非预期（mock 未启用） | 检查 G0-4，启用 `WeChat:MockMode` |
| `AUTH-MISALIGN` | 所有受保护端点集中 401，但 JWT 本应有效 | 检查 G0-3 密钥对齐 |
| `RATE-LIMIT-POLLUTION` | 非限流用例偶发 429 | 按 §6 R3 隔离/调限流 |
| `ASSERTION-FAIL` | 状态码/错误码/字段与契约不符 | **产品/实现缺陷** → 升级 dev-dotnet 修复，重跑 |
| `CONTRACT-DRIFT` | 后端错误码/字段名与 `errors.json`/`dto.json` 不一致 | 判定以 contracts 为真相源 → 修正后端或契约（走 OpenSpec 变更） |
| `FLAKY` | 偶发、与数据/时序相关（如 remainingDays 边界） | 复跑 3 次定位，按 R6 放宽断言 |

---

## 8. 用例统计

| 分组 | Must | Should | Could | GAP（不可达） | 小计 |
|------|:--:|:--:|:--:|:--:|:--:|
| 2.A 登录 | 6 | 6 | 0 | 0 | **12** |
| 2.B 续期 | 2 | 4 | 0 | 0 | **6** |
| 2.C 资料 | 6 | 5 | 0 | 0 | **11** |
| 2.D 注销状态查询 | 3 | 0 | 0 | 1 | **4** |
| 2.E 注销账户 | 3 | 0 | 0 | 1 | **4** |
| 2.F 恢复注销 | 4 | 1 | 0 | 0 | **5** |
| 2.G 头像上传 | 4 | 1 | 1 | 0 | **6** |
| 2.H 家庭列表 | 2 | 0 | 0 | 1 | **3** |
| 2.I 横切 | 1 | 0 | 2 | 0 | **3** |
| **合计** | **31** | **17** | **3** | **3** | **54** |

- 可执行用例：**51** 条（Must 31 + Should 17 + Could 3）
- GAP（E2E 不可达，`test.skip` 占位）：**3** 条

---

## 9. 交付物与下游指引

### 9.1 给 test-writer 的编写顺序建议

1. **Gate 0 前置**：落地微信 mock（§3.3）、对齐 JWT 密钥（G0-3）、扩展 seed（§3.1）。
2. **Must 用例（31 条）**：先确保登录/续期/资料/注销/恢复/头像核心路径与鉴权通过。
3. **Should 用例（17 条）**：扩展边界与异常覆盖。
4. **Could 用例（3 条）**：最后处理或不处理。
5. **GAP 用例（3 条）**：`test.skip` 占位并注释解除条件。

### 9.2 测试文件组织建议

```
testing/e2e/
├── specs/
│   ├── auth-login.spec.js          # TC-LOGIN-xxx
│   ├── auth-refresh.spec.js        # TC-REFRESH-xxx
│   ├── auth-profile.spec.js        # TC-PROFILE-xxx
│   ├── auth-deletion.spec.js       # TC-DELETION-xxx + TC-DELETE-xxx
│   ├── auth-recover.spec.js        # TC-RECOVER-xxx
│   ├── auth-avatar.spec.js         # TC-AVATAR-xxx
│   ├── auth-families.spec.js       # TC-FAMILIES-xxx
│   └── auth-cross.spec.js          # TC-CROSS-xxx
├── helpers/
│   ├── api-client.js               # 扩展 login/refresh/profile/... 封装（buildOptions 复用）
│   ├── jwt-helper.js               # 复用；密钥对齐 G0-3
│   ├── seed-db.js                  # 扩展认证 seed（§3.1，新列名）
│   ├── wechat-mock.js              # （可选）若 mock 走独立服务器而非后端配置
│   └── data-factory.js             # 复用 today/dateOffset；新增昵称/头像 fixture 工厂
└── fixtures/
    ├── avatars/                    # 合法 png/jpg + >2MB + 无效 .txt 文件
    └── seed-data.js                # 认证 seed 用户与 openid 映射
```

### 9.3 断言与定位约束

- 错误码/状态码/中文 message 断言 MUST 引用 `openspec/contracts/auth/errors.json`（§3.4），禁止硬编码。
- 请求头鉴权统一走 `api-client.js` 的 `buildOptions(authToken)`。
- 每个用例独立 seed + 清理，避免用例间依赖与数据残留。
