# Tasks: 认证与账户模块

> 日期：2026-08-08
> 总 task 数：36
> 来源：openspec/changes/add-auth-module/design.md（9 ADR + 9 API + 10 时序图 + 组件树 + data-id 表）
> API 契约（枚举/错误码/DTO）已提取至 `openspec/contracts/auth/`，三端实现 MUST 从 contracts 引用，禁止硬编码字符串字面量

## Story 依赖链

```
AUTH-001 (隐私+登录) -> AUTH-002 (登录态) -> AUTH-003 (资料) -> AUTH-004 (我的页面)
                                      |                      |
                                      |                      +-> AUTH-005 (注销)
                                      +-> (AUTH-003 / AUTH-004 / AUTH-005 在 AUTH-002 后并行)
```

## Task 依赖关系图

```
第 0 梯队：基础设施
  T1 (.NET 项目骨架) -- T2 (User 实体+枚举) -- T3 (DbContext+迁移)
  T4 (小程序项目初始化) -- T5a (Storage键名+隐私工具)
                           T5b (设计令牌+公共样式)

第 1 梯队：AUTH-001 隐私政策与静默登录
  后端: T6 (WeChatService) --+
          T7 (JwtService) ---+
          T8a (Login DTOs) --+-- T9 (AuthService.login) -- T10 (AuthController)
          T8b (Refresh DTOs) +
  前端: T11 (api.js) -- T12 (auth.js)
          T13 (privacy-dialog组件)
          T14 (privacy-prompt页面)
          T15a (app.js登录串流)
          T15b (日历首页占位)

第 2 梯队：AUTH-002 JWT登录态管理
  后端: T16 (JWT中间件) -- T17 (频率限制) -- T18 (续期端点完善)
  前端: T19 (api.js 401拦截器+续期锁)

第 3 梯队：并行 (AUTH-003 / AUTH-004 / AUTH-005)
  AUTH-003: T20a (Profile DTOs) -- T20b (Profile Service+Controller)
            T21 (头像上传+存储)
            T22a (profile-collection组件) -- T22b (profile-edit页面)

  AUTH-004: T23 (IFamilyQueryService + GET families)
            T24a (mine页面)
            T24b (settings页面骨架)

  AUTH-005: T25a (Deletion DTOs) -- T25b (Deletion Service+Controller) --+
                                                                          |
             T26 (定时清理+匿名化) ←--------------------------------------+
                                                                          |
             T27a (settings注销弹窗) ←-- T24b (依赖settings骨架)           |
             T27b (deleted-recovery页面)                                 |

第 4 梯队：全局横切
  T28a (ExceptionHandlingMiddleware) ← 所有后端完成后
  T28b (页面状态+安全区域收尾) ← 所有前端完成后
```

## Task 列表

### 第 0 梯队：项目基础设施

---

### Task 1: .NET 10 Web API 项目骨架

- **所属 Story**: AUTH-001（前置）
- **负责 agent**: `dev-dotnet`
- **依赖**: 无
- **输入**: design.md ADR-001（.NET 10 + 单项目）、ADR-002（模块按文件夹组织）
- **产出文件**:
  - `api/Agenda.Api.csproj`
  - `api/Program.cs`
  - `api/appsettings.json`
- **完成标准**:
  1. `dotnet build` 成功，无编译错误
  2. NuGet 包引用齐全（Microsoft.AspNetCore.Authentication.JwtBearer、Npgsql.EntityFrameworkCore.PostgreSQL、Swashbuckle、FluentValidation.AspNetCore）
  3. `appsettings.json` 含 ConnectionStrings.Default / Jwt.SecretKey / Jwt.LegacySecretKeys / Jwt.Issuer / Jwt.Audience / WeChat.AppId / WeChat.AppSecret / Storage.AvatarRootPath / Storage.AvatarBaseUrl / Cors.Origins 配置段
  4. Program.cs 服务注册顺序：EF Core -> Auth -> Swagger -> 限流 -> CORS -> Controllers -> 中间件管道
  5. Swagger UI 可通过浏览器访问（本地 `dotnet run`）
- **验证命令**: `dotnet build && dotnet run --environment Development`，访问 `/swagger`

---

### Task 2: User 领域实体与 UserStatus 枚举

- **所属 Story**: AUTH-001（前置）
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 1
- **输入**: design.md 3.3 节 User 实体定义（7 字段 + UserStatus 枚举 + Deletion lifecycle）
- **产出文件**:
  - `api/Domain/Entities/User.cs`
  - `api/Domain/Enums/UserStatus.cs`
- **完成标准**:
  1. User 实体含 Id (Guid PK)、OpenId (string max 64 unique indexed)、Nickname (string max 20 default "微信用户")、AvatarUrl (string? max 500)、Status (UserStatus default Active)、DeletedAt (DateTimeOffset?)、CreatedAt (DateTimeOffset)、LastLoginAt (DateTimeOffset)
  2. UserStatus 枚举含 Active = 0, Deleted = 1
  3. 命名空间 `Agenda.Api.Domain.Entities` / `Agenda.Api.Domain.Enums`
  4. `dotnet build` 成功
- **验证命令**: `dotnet build`

---

### Task 3: EF Core DbContext + UserConfiguration + 初始迁移

- **所属 Story**: AUTH-001（前置）
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 1, Task 2
- **输入**: design.md 3.3 节 ER 图、ADR-004（PostgreSQL）
- **产出文件**:
  - `api/Infrastructure/Data/AppDbContext.cs`
  - `api/Infrastructure/Data/Configurations/UserConfiguration.cs`
  - `api/Migrations/{timestamp}_InitialCreate.cs`（EF Core 自动生成）
- **完成标准**:
  1. `dotnet ef migrations add InitialCreate` 成功生成迁移文件
  2. UserConfiguration 定义 OpenId 唯一索引、Nickname 默认值、AvatarUrl 长度限制、Status 存储为 int
  3. 迁移 Up 方法包含完整 Users 表创建 DDL
  4. `dotnet ef database update` 在本地 PostgreSQL 成功建表
  5. Program.cs 中 `AddDbContext<AppDbContext>` 使用 Npgsql 连接
- **验证命令**: `dotnet ef migrations list && dotnet ef database update --connection "<local_pg_connection>"`

---

### Task 4: 微信小程序项目初始化

- **所属 Story**: AUTH-001（前置）
- **负责 agent**: `dev-miniapp`
- **依赖**: 无
- **输入**: design.md 3.5 节路由与 TabBar（app.json）、ADR-005（原生框架）
- **产出文件**:
  - `app/app.js`
  - `app/app.json`
  - `app/app.wxss`
- **完成标准**:
  1. 微信开发者工具打开项目无报错
  2. app.json pages 注册 6 个页面：pages/index/index、pages/mine/index、pages/profile-edit/index、pages/settings/index、pages/deleted-recovery/index、pages/privacy-prompt/index
  3. TabBar 显示"日历"/"我的"两个 Tab
  4. app.js 定义 globalData = { userId: null, userProfile: null, families: [] }
- **验证命令**: 微信开发者工具中打开 `app/` 目录，编译通过、TabBar 正常渲染

---

### Task 5a: Storage 键名常量 + 隐私政策工具

- **所属 Story**: AUTH-001
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 4
- **输入**: design.md 3.3 节客户端状态、ADR-006（隐私政策版本号客户端管理）
- **产出文件**:
  - `app/utils/storage-keys.js`
  - `app/utils/privacy.js`
- **完成标准**:
  1. storage-keys.js 导出 `AUTH_TOKEN`、`PRIVACY_CONSENT`、`USER_PROFILE_CACHE`、`FAMILIES_CACHE` 常量
  2. privacy.js 导出 `PRIVACY_POLICY_VERSION = '1.0'`、`checkConsent()`、`recordConsent()`
  3. `checkConsent()` 返回 `{ consented: boolean, needsReshow: boolean }`
  4. 版本号不匹配时 `needsReshow: true`
  5. `recordConsent()` 写入 `{ version, time }` 到 Storage
- **验证命令**: 微信开发者工具控制台执行 `require('./utils/privacy').checkConsent()` 验证返回值和版本比对逻辑

---

### Task 5b: 设计令牌 + 公共样式

- **所属 Story**: AUTH-001（全局）
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 4
- **输入**: `ui-miniapp-standards` rule 设计令牌节、design.md 3.5 节安全区域适配
- **产出文件**:
  - `app/styles/tokens.wxss`
  - `app/styles/common.wxss`
- **完成标准**:
  1. tokens.wxss 含 15+ CSS 变量（color-primary / color-text-primary / color-bg-page / font-size-base / spacing-* / border-radius-base 等），变量值映射到 WeUI 变量
  2. common.wxss 含全局 Reset、page 基础样式、`.safe-bottom` 工具类（使用 `env(safe-area-inset-bottom)`）
  3. Reset 不破坏微信原生组件默认样式
- **验证命令**: 微信开发者工具中创建测试页面验证变量可用、Reset 生效

---

### 第 1 梯队：AUTH-001 -- 隐私政策与静默登录

---

### Task 6: IWeChatService + WeChatService

- **所属 Story**: AUTH-001
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 1
- **输入**: design.md ADR-003、3.4 节登录 API 契约、时序 3（超时/重试）
- **产出文件**:
  - `api/Infrastructure/Auth/IWeChatService.cs`
  - `api/Infrastructure/Auth/WeChatService.cs`
- **完成标准**:
  1. `GetSessionAsync(string code, CancellationToken ct)` 返回 `WeChatSession { OpenId, SessionKey, UnionId? }`
  2. HttpClient 调用 `https://api.weixin.qq.com/sns/jscode2session`，超时 5s
  3. 微信返回 errcode != 0 时抛 `WeChatApiException`（含 errcode + errmsg）
  4. 超时自动重试 1 次，仍超时抛 `TimeoutException`
  5. 日志不记录 openid 明文
  6. WeChat.AppId / WeChat.AppSecret 从 `IConfiguration` 读取
  7. Program.cs 中注册 `IWeChatService` + `HttpClient`（`AddHttpClient`）
- **验证命令**: `dotnet test --filter "FullyQualifiedName~WeChatService"` 覆盖正常 / errcode / 超时重试场景

---

### Task 7: IJwtService + JwtService

- **所属 Story**: AUTH-001 / AUTH-002
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 1
- **输入**: design.md ADR-003（自签发 JWT 7 天）、3.4 节安全约束（密钥轮换、时钟偏差容忍）
- **产出文件**:
  - `api/Infrastructure/Auth/IJwtService.cs`
  - `api/Infrastructure/Auth/JwtService.cs`
- **完成标准**:
  1. `GenerateToken(Guid userId)` 签发 JWT（HMAC-SHA256），载荷含 userId / iat / exp（7 天）/ nbf
  2. `ValidateToken(string token)` 返回 `ClaimsPrincipal?`，过期/篡改返回 null
  3. `GetUserIdFromExpiredToken(string token)` 从过期 Token 解析 userId
  4. 30 秒时钟偏差容忍（`ClockSkew = TimeSpan.FromSeconds(30)`）
  5. JWT 过期前 5 分钟内 ValidateToken 返回 null（触发客户端续期）
  6. 支持旧密钥列表验证（`Jwt:LegacySecretKeys` 数组）
  7. 密钥从 `IConfiguration["Jwt:SecretKey"]` 读取，不进源码
- **验证命令**: `dotnet test --filter "FullyQualifiedName~JwtService"` 覆盖签发 / 验签通过 / 过期拒绝 / 篡改拒绝 / 时钟偏差 / 旧密钥

---

### Task 8a: Login DTO + Validator

- **所属 Story**: AUTH-001
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 2
- **输入**: design.md 3.4 节 Login API 契约（请求/响应形状、错误码）
- **产出文件**:
  - `api/Auth/Dtos/LoginRequest.cs`
  - `api/Auth/Dtos/LoginResponse.cs`
  - `api/Auth/Validators/LoginRequestValidator.cs`
- **完成标准**:
  1. `LoginRequest(Code)` -- Code 字段 `[Required]`、非空
  2. `LoginResponse(Jwt, UserId, IsNewUser, NeedsProfileCollection, IsDeleted?, RemainingDays?)` -- 对应 design.md 3.4 节完整形状
  3. LoginRequestValidator 校验 Code 非空且长度 >= 1
- **验证命令**: `dotnet build`

---

### Task 8b: Refresh DTO

- **所属 Story**: AUTH-002
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 2
- **输入**: design.md 3.4 节 Refresh API 契约
- **产出文件**:
  - `api/Auth/Dtos/RefreshRequest.cs`
  - `api/Auth/Dtos/RefreshResponse.cs`
- **完成标准**:
  1. `RefreshRequest(Code)` -- Code 字段 `[Required]`、非空
  2. `RefreshResponse(Jwt, UserId)` -- 含 JWT 和 userId
- **验证命令**: `dotnet build`

---

### Task 9: AuthService（login + refresh 核心逻辑 + 30 天到期惰性检查）

- **所属 Story**: AUTH-001 / AUTH-002 / AUTH-005（惰性检查）
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 2, Task 3, Task 6, Task 7, Task 8a, Task 8b
- **输入**: design.md 时序 1/3/9、ADR-008（惰性检查路径）、delta spec `auth-login` / `auth-deletion`
- **产出文件**:
  - `api/Auth/IAuthService.cs`
  - `api/Auth/AuthService.cs`
- **完成标准**:
  1. `LoginAsync`：调用 WeChatService -> 按 openid 查 User -> 无则创建新 User（默认昵称"微信用户"、Status=Active）-> 有则检查 Status：Active 正常签发 JWT / Deleted 且未到期返回 isDeleted=true / Deleted 且已到期则物理删除 + 创建新 User（isNewUser=true）-> 更新 LastLoginAt -> 返回 LoginResponse
  2. `RefreshAsync`：调用 WeChatService -> 查 User 须存在且 Status=Active -> 签发新 JWT -> 返回 RefreshResponse
  3. 新用户首次登录：isNewUser=true、needsProfileCollection=true
  4. 已有用户登录：isNewUser=false、needsProfileCollection=false（昵称非默认值时）
  5. code 无效时抛 WeChatApiException（Controller 层映射为 400 CODE_INVALID）
  6. openid 不出现在日志中
- **验证命令**: `dotnet test --filter "FullyQualifiedName~AuthServiceLogin"` 覆盖新用户创建 / 已有用户 / code无效 / 30天到期惰性清理 / 30天未到期isDeleted / 刷新成功

---

### Task 10: AuthController（POST /api/v1/auth/login + refresh）

- **所属 Story**: AUTH-001 / AUTH-002
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 9
- **输入**: design.md 3.4 节 API 契约、错误码枚举、安全约束
- **产出文件**:
  - `api/Auth/AuthController.cs`
- **完成标准**:
  1. `[ApiController]` + `[Route("api/v1/auth")]`
  2. `POST /api/v1/auth/login` (`[AllowAnonymous]`) 接收 LoginRequest -> 返回 `Ok(LoginResponse)`
  3. `POST /api/v1/auth/refresh` (`[AllowAnonymous]`) 接收 RefreshRequest -> 返回 `Ok(RefreshResponse)`
  4. code 无效返回 HTTP 400 + `{ error: "CODE_INVALID", message: "微信登录凭证无效，请重试" }`
  5. 微信 API 超时返回 HTTP 503 + `{ error: "WECHAT_API_TIMEOUT", message: "服务繁忙，请稍后重试" }`
  6. WeChatApiException 返回 HTTP 502 + `{ error: "WECHAT_API_ERROR", message: "微信服务异常，请稍后重试" }`
  7. Controller 不包含业务逻辑
  8. Swagger UI 中可见端点及请求/响应 schema
- **验证命令**: `dotnet test --filter "FullyQualifiedName~AuthController"` + Swagger UI 手动调用 login 端点

---

### Task 11: 前端 services/api.js（统一请求封装 -- 基础骨架）

- **所属 Story**: AUTH-001
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 5a
- **输入**: design.md 3.5 节数据流图、ADR-007（续期并发锁）、`dev-miniapp-standards` API 封装规范
- **产出文件**:
  - `app/services/api.js`
- **完成标准**:
  1. 导出 `request(options)` 函数封装 `wx.request`
  2. `BASE_URL` + `DEFAULT_TIMEOUT = 10000`
  3. 请求拦截器：从 Storage 读取 `AUTH_TOKEN` -> `Authorization: Bearer <jwt>`（Token 不存在时跳过）
  4. 响应拦截器：200 返回 `res.data`；非 200 返回 `{ error, message }`；声明 `isRefreshing` / `refreshPromise` / `pendingRequests` 变量（续期逻辑由 Task 19 补充）
  5. 401 响应当前直接 reject（续期逻辑待 Task 19 实现）
- **验证命令**: 微信开发者工具中调用 `request()` 验证请求发起、Header 携带、响应解析

---

### Task 12: 前端 services/auth.js（认证 API 调用层）

- **所属 Story**: AUTH-001
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 11
- **输入**: design.md 3.4 节全部 9 个 API 契约
- **产出文件**:
  - `app/services/auth.js`
- **完成标准**:
  1. 导出 9 个函数：`login`、`refresh`、`getProfile`、`updateProfile`、`getDeletionStatus`、`deleteAccount`、`recoverAccount`、`uploadAvatar`、`getMyFamilies`
  2. 每个函数调用 `request()` 并返回解析后的数据
  3. JSDoc 注释标注参数类型、返回值、可能错误码
- **验证命令**: 微信开发者工具控制台调用 `auth.login('test_code')` 验证网络请求发起

---

### Task 13: privacy-dialog 组件

- **所属 Story**: AUTH-001
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 5a, Task 5b
- **输入**: design.md 3.5 节组件树 + data-id 表（6 个 data-id）、requirement.md 3.2 节弹窗线框图
- **产出文件**:
  - `app/components/privacy-dialog/index.js`
  - `app/components/privacy-dialog/index.wxml`
  - `app/components/privacy-dialog/index.wxss`
  - `app/components/privacy-dialog/index.json`
- **完成标准**:
  1. properties: `show` (Boolean)；data: `checked` (Boolean default false)、`loading` (Boolean)
  2. 未勾选时同意按钮置灰（disabled），勾选后可用
  3. bind:agree / bind:decline 事件正确触发
  4. 政策链接点击：网络可用时打开链接，不可用时 Toast 提示不阻断流程
  5. 5 个 data-id 齐全：`privacy-dialog-checkbox`、`privacy-dialog-agree-btn`、`privacy-dialog-decline-btn`、`privacy-dialog-policy-link`、`privacy-dialog-loading`
  6. 底部按钮区适配安全区域（`.safe-bottom` 类）
- **验证命令**: 微信开发者工具中测试页面引入组件，验证勾选/取消、按钮置灰/启用、agree/decline 事件

---

### Task 14: privacy-prompt 页面

- **所属 Story**: AUTH-001
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 4
- **输入**: design.md 3.5 节组件树 + data-id 表（1 个 data-id）、requirement.md 3.4 节线框图
- **产出文件**:
  - `app/pages/privacy-prompt/index.js`
  - `app/pages/privacy-prompt/index.wxml`
  - `app/pages/privacy-prompt/index.wxss`
  - `app/pages/privacy-prompt/index.json`
- **完成标准**:
  1. 展示警告图标 + "需要同意隐私政策才能使用" + 说明 + "重新查看隐私政策"按钮
  2. 点击按钮执行 `wx.reLaunch({ url: '/pages/index/index' })`
  3. 页面不调用任何 API（无 wx.login / wx.request）
  4. `privacy-prompt-review-btn` data-id 正确
- **验证命令**: 微信开发者工具中跳转 `pages/privacy-prompt/index` 验证渲染和按钮交互

---

### Task 15a: app.js onLaunch 隐私检查与登录流程串联

- **所属 Story**: AUTH-001
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 5a, Task 11, Task 12, Task 13, Task 14
- **输入**: design.md 时序 1/2、data flow 图、delta spec `auth-login` 全部 Scenario
- **产出文件**:
  - `app/app.js`（修改，在 Task 4 骨架上完善 onLaunch）
- **完成标准**:
  1. `onLaunch` 调用 `privacy.checkConsent()`：
     - 未同意/版本变更 -> 展示 privacy-dialog；agree -> `recordConsent()` -> `doLogin()`；decline -> `wx.reLaunch` 到 privacy-prompt
     - 已同意 -> 直接 `doLogin()`
  2. `doLogin()`：`wx.login()` -> `auth.login(code)` -> 存 JWT 到 Storage -> 设 `globalData.userId` -> 判断 `needsProfileCollection`（true 标记待跳转 profile-collection 页面 -- 跳转逻辑待 T22a 完成后再串联）
  3. wx.login 失败 -> Toast + 重试按钮
  4. code 已使用 -> 重新 wx.login 最多 1 次
  5. 提供全局方法 `setLoginData(jwt, userId)`（供 T19 续期流程调用）
- **验证命令**: 微信开发者工具清除 Storage -> 重新编译 -> 验证隐私弹窗 -> 同意 -> wx.login -> JWT 存储全流程

---

### Task 15b: 日历首页占位

- **所属 Story**: AUTH-001
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 4
- **输入**: design.md 3.5 节 TabBar 配置（日历 Tab）
- **产出文件**:
  - `app/pages/index/index.js`
  - `app/pages/index/index.wxml`
  - `app/pages/index/index.wxss`
  - `app/pages/index/index.json`
- **完成标准**:
  1. onLoad 中获取 `app.globalData.userId`，无则显示"正在登录..."，有则显示"欢迎使用家庭日程助手"
  2. 页面为 TabBar 页，通过底部 Tab 可切换
  3. 占位文本居中显示
- **验证命令**: 微信开发者工具切到"日历"Tab 验证占位页渲染

---

### 第 2 梯队：AUTH-002 -- JWT 登录态管理

---

### Task 16: JWT 认证中间件集成

- **所属 Story**: AUTH-002
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 7
- **输入**: design.md 3.4 节安全约束、delta spec `auth-token` Requirement "JWT 签发与验签"
- **产出文件**:
  - `api/Program.cs`（修改 Task 1 骨架，添加 JWT Bearer 认证）
- **完成标准**:
  1. `AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(...)` 配置完成
  2. TokenValidationParameters 与 JwtService 一致（IssuerSigningKey、ClockSkew = 30s）
  3. `app.UseAuthentication()` 在 `UseAuthorization()` 前
  4. `[Authorize]` Attribute 在无 Token 时返回 401
  5. 有效 JWT 通过认证，`User.FindFirst("userId")` 可获取 userId
- **验证命令**: curl 验证无 Token 返回 401 / 有效 Token 返回 200 / 过期 Token 返回 401

---

### Task 17: 频率限制中间件

- **所属 Story**: AUTH-002
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 1, Task 16
- **输入**: design.md 3.4 节安全约束（每用户每分钟 <= 10 次）、风险 R1
- **产出文件**:
  - `api/Infrastructure/Middleware/RateLimitingMiddleware.cs`
  - `api/Program.cs`（修改，注册限流服务）
- **完成标准**:
  1. 对 `POST /api/v1/auth/login` 和 `POST /api/v1/auth/refresh` 限流
  2. 按客户端 IP（未登录）/ userId（已登录）维度计数，每分钟 <= 10 次
  3. 超限返回 HTTP 429 + `{ error: "RATE_LIMITED", message: "操作过于频繁，请稍后再试" }`
  4. 计数器在 1 分钟后重置
  5. 非登录/续期接口不受影响
- **验证命令**: 脚本连续调用 login 端点 11 次，验证第 11 次返回 HTTP 429

---

### Task 18: AuthController 续期端点最终完善

- **所属 Story**: AUTH-002
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 9, Task 10
- **输入**: design.md 3.4 节 refresh API 契约、时序 4
- **产出文件**:
  - `api/Auth/AuthController.cs`（修改 Task 10，确保 refresh 端点正确）
- **完成标准**:
  1. `POST /api/v1/auth/refresh` 返回 `{ jwt, userId }`
  2. code 无效返回 HTTP 400 + CODE_INVALID
  3. 频率超限返回 HTTP 429 + RATE_LIMITED
  4. 微信 API 异常返回 HTTP 502 + WECHAT_API_ERROR
- **验证命令**: `curl -X POST http://localhost:5000/api/v1/auth/refresh -H "Content-Type: application/json" -d '{"code":"test"}'` 验证错误响应

---

### Task 19: api.js 响应拦截器（401 静默续期 + 并发锁 + 重放）

- **所属 Story**: AUTH-002
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 11, Task 12
- **输入**: design.md ADR-007、时序 4/5/6、data flow 图
- **产出文件**:
  - `app/services/api.js`（修改 Task 11，补充响应拦截器）
- **完成标准**:
  1. 401 响应触发续期检查：`isRefreshing` 为 false 时设置锁 -> `wx.login()` -> `auth.refresh(code)` -> 存新 JWT -> 更新 globalData -> 释放锁 -> 重放队列中所有请求
  2. 多个 401 并发时仅执行 1 次 wx.login，后续请求等待 Promise -> 锁释放后重放
  3. 续期网络异常：清除 Token -> 释放锁 -> Toast 提示 -> 队列 reject
  4. 续期 wx.login 失败：提示"登录已过期，请重新打开小程序"
  5. 429 响应：等待 60s 后自动重试 1 次，不触发续期
- **验证命令**: 微信开发者工具中使用过期 Token 发请求，模拟 401 续期流程；同时发 3 个请求，通过 Network 面板确认只有 1 次 wx.login 和 1 次 refresh API

---

### 第 3 梯队：AUTH-003 / AUTH-004 / AUTH-005 -- 并行开发

---

#### AUTH-003: 昵称头像与资料管理

---

### Task 20a: Profile DTO + Validator

- **所属 Story**: AUTH-003
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 2
- **输入**: design.md 3.4 节 Profile API 契约
- **产出文件**:
  - `api/Auth/Dtos/ProfileResponse.cs`
  - `api/Auth/Dtos/UpdateProfileRequest.cs`
  - `api/Auth/Validators/UpdateProfileRequestValidator.cs`
- **完成标准**:
  1. `ProfileResponse(UserId, Nickname, AvatarUrl?, CreatedAt)`
  2. `UpdateProfileRequest(Nickname, AvatarUrl?)`
  3. UpdateProfileRequestValidator：Nickname 非空（NICKNAME_EMPTY）、长度 1-20（NICKNAME_TOO_LONG）、含敏感词时拒绝（NICKNAME_SENSITIVE，注入 `ISensitiveWordFilter` 接口，首期用关键词列表实现）
- **验证命令**: `dotnet build`

---

### Task 20b: Profile Service + Controller 实现

- **所属 Story**: AUTH-003
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 9, Task 10, Task 20a
- **输入**: design.md 3.4 节 GET/PUT profile API 契约、delta spec `auth-profile` 全部 Scenario
- **产出文件**:
  - `api/Auth/IAuthService.cs`（修改，增加 GetProfileAsync / UpdateProfileAsync 签名）
  - `api/Auth/AuthService.cs`（修改，实现 GetProfileAsync / UpdateProfileAsync）
  - `api/Auth/AuthController.cs`（修改，增加 GET/PUT /api/v1/auth/profile）
- **完成标准**:
  1. `GET /api/v1/auth/profile` (`[Authorize]`) 返回 ProfileResponse
  2. `PUT /api/v1/auth/profile` (`[Authorize]`) 更新昵称+头像，返回更新后 ProfileResponse
  3. 昵称为空返回 HTTP 400 + NICKNAME_EMPTY
  4. 昵称 >20 字符返回 HTTP 400 + NICKNAME_TOO_LONG
  5. 昵称含敏感词返回 HTTP 400 + NICKNAME_SENSITIVE
  6. 无 Token 返回 HTTP 401
- **验证命令**: `dotnet test --filter "FullyQualifiedName~Profile"` 覆盖正常获取/更新/空昵称/过长/敏感词/401

---

### Task 21: POST /api/v1/upload/avatar + IAvatarStorageService

- **所属 Story**: AUTH-003
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 2, Task 10
- **输入**: design.md ADR-009（本地文件系统存储）、3.4 节头像上传 API 契约
- **产出文件**:
  - `api/Infrastructure/Storage/IAvatarStorageService.cs`
  - `api/Infrastructure/Storage/AvatarStorageService.cs`
  - `api/Infrastructure/Storage/UploadController.cs`
  - `api/Auth/Dtos/UploadAvatarResponse.cs`
- **完成标准**:
  1. `UploadAsync(Guid userId, IFormFile file)` 校验格式（jpg/jpeg/png/gif）和大小（<= 2MB）-> 保存到 `AvatarRootPath/{userId}.{ext}` -> 返回 `AvatarBaseUrl` 拼接的 URL
  2. `DeleteAsync` 删除旧文件
  3. `UploadController` (`[Route("api/v1/upload")]` + `[Authorize]`)：`POST /api/v1/upload/avatar` 返回 `{ url }`
  4. 格式无效返回 HTTP 400、大小超限返回 HTTP 413、无 Token 返回 HTTP 401
  5. Program.cs 中注册 `IAvatarStorageService` + UploadController 路由
- **验证命令**: `dotnet test --filter "FullyQualifiedName~AvatarStorage"` + `curl -F "file=@test.png" -H "Authorization: Bearer <jwt>" http://localhost:5000/api/v1/upload/avatar`

---

### Task 22a: profile-collection 组件

- **所属 Story**: AUTH-003
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 5b, Task 12
- **输入**: design.md 3.5 节组件树 + data-id 表（4 个 data-id）、组件契约表、requirement.md 3.3 节线框图
- **产出文件**:
  - `app/components/profile-collection/index.js`
  - `app/components/profile-collection/index.wxml`
  - `app/components/profile-collection/index.wxss`
  - `app/components/profile-collection/index.json`
- **完成标准**:
  1. properties: `prefillNickname` (String)；methods: `onChooseAvatar`（chooseAvatar 事件 -> 预览）、`onNicknameInput`（更新本地 nickname）、`onSubmit`（triggerEvent('submit', { nickname, avatarUrl })）、`onSkip`（triggerEvent('skip')）
  2. WXML 含 `<button open-type="chooseAvatar" data-id="profile-collection-avatar">` + `<input type="nickname" data-id="profile-collection-nickname-input">` + `<button data-id="profile-collection-start-btn">` 开始使用 + `<view data-id="profile-collection-loading">`
  3. 可一键跳过（直接点击"开始使用"），使用默认值
  4. 头像选择后实时预览，昵称确认后回填
  5. 提交时网络异常提示并保留输入
- **验证命令**: 微信开发者工具中引入组件，验证头像选择/昵称输入/跳过/提交四种交互

---

### Task 22b: profile-edit 页面

- **所属 Story**: AUTH-003
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 12, Task 22a
- **输入**: design.md 3.5 节 data-id 表（6 个 data-id）、requirement.md 5.2 节线框图、delta spec `auth-profile` 编辑资料 Scenario
- **产出文件**:
  - `app/pages/profile-edit/index.js`
  - `app/pages/profile-edit/index.wxml`
  - `app/pages/profile-edit/index.wxss`
  - `app/pages/profile-edit/index.json`
- **完成标准**:
  1. onLoad 调用 `auth.getProfile()` 加载当前资料
  2. 点击头像触发 chooseAvatar -> 上传（`auth.uploadAvatar`）-> 更新预览
  3. 点击昵称弹出 nickname input（type="nickname"，maxlength=20）
  4. 保存：先上传头像（如变更）-> 再 `auth.updateProfile` -> 成功 wx.navigateBack
  5. 头像上传失败时不保存昵称修改（事务一致性）
  6. 昵称为空前端拦截显示错误提示（`profile-edit-error`）
  7. 网络异常 Toast 提示保留输入
  8. 6 个 data-id 齐全：`profile-edit-avatar`、`profile-edit-nickname-input`、`profile-edit-save-btn`、`profile-edit-cancel-btn`、`profile-edit-error`
- **验证命令**: 微信开发者工具中进入编辑页，验证加载/编辑/保存/返回/错误提示

---

#### AUTH-004: "我的"页面与家庭操作入口

---

### Task 23: IFamilyQueryService 接口 + GET /api/v1/users/me/families

- **所属 Story**: AUTH-004
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 10
- **输入**: design.md 3.4 节家庭列表 API 契约、3.2 节跨上下文规则、handoff 节 IFamilyQueryService 承诺
- **产出文件**:
  - `api/Auth/IFamilyQueryService.cs`
  - `api/Auth/AuthController.cs`（修改，增加 GET /api/v1/users/me/families）
  - `api/Auth/Dtos/FamilyInfo.cs`
  - `api/Auth/Dtos/UserFamiliesResponse.cs`
- **完成标准**:
  1. `IFamilyQueryService.GetUserFamiliesAsync(Guid userId)` 返回 `List<FamilyInfo>`，`FamilyInfo { FamilyId, FamilyName, Role, MemberCount }`
  2. `GET /api/v1/users/me/families` (`[Authorize]`) 返回 `{ families: [...] }`
  3. Family 模块未实现时返回 `{ families: [] }`（空实现注册在 Program.cs 中）
  4. 无 Token 返回 HTTP 401
- **验证命令**: `curl -X GET http://localhost:5000/api/v1/users/me/families -H "Authorization: Bearer <jwt>"` 验证返回 `{ families: [] }`

---

### Task 24a: mine 页面

- **所属 Story**: AUTH-004
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 5b, Task 12
- **输入**: design.md 3.5 节组件树 + data-id 表（8 个 data-id）、requirement.md 6.2 节两种布局线框图、delta spec `auth-my-page` 全部 Scenario、安全区域适配规范
- **产出文件**:
  - `app/pages/mine/index.js`
  - `app/pages/mine/index.wxml`
  - `app/pages/mine/index.wxss`
  - `app/pages/mine/index.json`
- **完成标准**:
  1. onShow 并发请求 `auth.getProfile()` + `auth.getMyFamilies()`
  2. 有家庭（families.length > 0）：头像区 + 当前家庭信息（名称+角色+成员数）+ 切换家庭（>=2时显示）+ 创建家庭 + 加入家庭 + 设置
  3. 无家庭（families.length == 0）：头像区 + 空态提示 + 创建家庭 + 加入家庭 + 设置
  4. 头像区点击 -> `wx.navigateTo` profile-edit
  5. 家庭信息行点击 -> `wx.navigateTo` 家庭模块成员列表（传 familyId）
  6. 创建/加入/切换/设置入口点击 -> 跳转对应页面（家庭模块未实现时 Toast 提示）
  7. 页面加载网络异常时部分降级展示（头像用缓存、家庭区显示错误占位、操作入口仍可点击）
  8. 底部安全区域适配（`.safe-bottom`）
  9. 8 个 data-id 齐全：`mine-avatar-area` / `mine-family-info-{{familyId}}` / `mine-switch-family` / `mine-create-family` / `mine-join-family` / `mine-settings` / `mine-loading` / `mine-error` / `mine-empty-family`
  10. 认证模块不做角色判断，入口始终可见
- **验证命令**: 微信开发者工具中验证 mine 页面两种布局切换、各入口跳转、加载态/错误态/空态

---

### Task 24b: settings 页面骨架

- **所属 Story**: AUTH-004 / AUTH-005
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 4, Task 5b
- **输入**: design.md 3.5 节组件树（settings 页面）+ data-id 表（1 个 data-id）
- **产出文件**:
  - `app/pages/settings/index.js`
  - `app/pages/settings/index.wxml`
  - `app/pages/settings/index.wxss`
  - `app/pages/settings/index.json`
- **完成标准**:
  1. 含"注销账户"入口（`data-id="settings-delete-account"`，点击方法声明为 `onDeleteAccount`，具体流程由 Task 27a 实现）
  2. 预留扩展区（注释标注：关于、意见反馈、撤销隐私授权 -- 后续版本）
  3. 底部安全区域适配
- **验证命令**: 微信开发者工具中通过 mine 页面跳转到 settings 验证页面骨架渲染

---

#### AUTH-005: 账户注销与 30 天缓冲恢复

---

### Task 25a: Deletion DTO

- **所属 Story**: AUTH-005
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 2
- **输入**: design.md 3.4 节注销相关 API 契约（3 个端点）
- **产出文件**:
  - `api/Auth/Dtos/DeletionStatusResponse.cs`
  - `api/Auth/Dtos/DeletionResponse.cs`
  - `api/Auth/Dtos/RecoverResponse.cs`
- **完成标准**:
  1. `DeletionStatusResponse(IsDeleted, CanDelete, BlockReason?, ExpiresAt?, RemainingDays?)`
  2. `DeletionResponse(ExpiresAt, RemainingDays)`
  3. `RecoverResponse(Jwt, UserId)`
- **验证命令**: `dotnet build`

---

### Task 25b: Deletion Service + Controller 实现

- **所属 Story**: AUTH-005
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 9, Task 10, Task 23, Task 25a
- **输入**: design.md 3.4 节注销 API 契约、时序 7/8/9、delta spec `auth-deletion` 全部 Scenario、ADR-008
- **产出文件**:
  - `api/Auth/IAuthService.cs`（修改，增加 GetDeletionStatusAsync / DeleteAccountAsync / RecoverAccountAsync 签名）
  - `api/Auth/AuthService.cs`（修改，实现三个注销方法 + 30 天到期惰性检查已由 Task 9 在 LoginAsync 中实现，此处仅实现 Recover 逻辑）
  - `api/Auth/AuthController.cs`（修改，增加 GET /deletion-status、POST /deletion、POST /deletion/recover）
- **完成标准**:
  1. `GET /api/v1/auth/deletion-status`：Active 且无家庭 -> canDelete=true；有家庭 -> canDelete=false + FAMILY_STILL_ACTIVE；Deleted -> isDeleted=true + remainingDays
  2. `POST /api/v1/auth/deletion`：无家庭 -> Status=Deleted + DeletedAt=now + 返回 expiresAt/remainingDays；有家庭 -> 400 FAMILY_STILL_ACTIVE；已删除 -> 200 幂等
  3. `POST /api/v1/auth/deletion/recover`：Deleted 且未到期 -> Status=Active + DeletedAt=null + 签发新 JWT；Active -> 400 NOT_DELETED；已到期 -> 400 EXPIRED
  4. 所有端点 `[Authorize]`
- **验证命令**: `dotnet test --filter "FullyQualifiedName~Deletion"` 覆盖 7 个场景：正常注销/家庭拦截/幂等/正常恢复/NOT_DELETED/EXPIRED/401

---

### Task 26: 30 天到期定时清理任务 + 打卡记录匿名化

- **所属 Story**: AUTH-005
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 3, Task 25b
- **输入**: design.md ADR-008（双路径策略 -- 定时扫描兜底）、3.3 节级联规则、风险 R8
- **产出文件**:
  - `api/Infrastructure/Services/DeletionCleanupService.cs`
  - `api/Infrastructure/Services/AnonymizationService.cs`
  - `api/Program.cs`（修改，注册 HostedService）
- **完成标准**:
  1. `DeletionCleanupService` 实现 `IHostedService`，每天凌晨 3:00 扫描 `Status == Deleted && DeletedAt + 30天 < now` 的 User
  2. 物理删除前调用 `AnonymizationService.AnonymizeCheckinRecordsAsync`，将 userId 替换为 `deleted_user_{序号}`
  3. 日志记录每次清理的用户数量
  4. 定时任务异常不中断应用，日志记录错误
  5. 打卡记录匿名化：更新 UserId 字段为匿名标识符，保留时间戳和日程 ID（注：打卡记录表由日程模块创建，当前 SQL 直接引用表名，待日程模块建立后生效）
  6. Program.cs 中 `services.AddHostedService<DeletionCleanupService>()`
- **验证命令**: `dotnet test --filter "FullyQualifiedName~DeletionCleanup"` 验证过期用户清理 + 匿名化逻辑

---

### Task 27a: settings 页面注销弹窗流程

- **所属 Story**: AUTH-005
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 12, Task 24b
- **输入**: design.md 时序 7（注销正常路径）、data-id 表（2 个 data-id）、requirement.md 7.2 节流程图
- **产出文件**:
  - `app/pages/settings/index.js`（修改 Task 24b，完善 onDeleteAccount）
  - `app/pages/settings/index.wxml`（修改，注入注销弹窗内容）
- **完成标准**:
  1. 点击"注销账户" -> 调用 `auth.getDeletionStatus()` 检查条件
  2. canDelete=false -> 弹窗显示 FAMILY_STILL_ACTIVE 提示 + "前往家庭管理"按钮 -> 跳转家庭模块
  3. canDelete=true -> 显示注销说明弹窗（30 天缓冲说明 + 取消/确认按钮）-> 确认后显示二次确认弹窗（`data-id="settings-delete-confirm-btn"` / `data-id="settings-delete-cancel-btn"`）
  4. 二次确认 -> 调用 `auth.deleteAccount()` -> 成功清除 Storage JWT -> `wx.exitMiniProgram()`
  5. 网络异常 Toast "操作失败，请重试"，不改变本地状态
- **验证命令**: 微信开发者工具中模拟注销全流程：条件检查 -> 说明 -> 确认 -> 二次确认 -> API 调用 -> 清除 Token

---

### Task 27b: deleted-recovery 页面

- **所属 Story**: AUTH-005
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 12, Task 15a
- **输入**: design.md 时序 8（注销恢复）、data-id 表（4 个 data-id）、requirement.md 7.4 节恢复页面线框图
- **产出文件**:
  - `app/pages/deleted-recovery/index.js`
  - `app/pages/deleted-recovery/index.wxml`
  - `app/pages/deleted-recovery/index.wxss`
  - `app/pages/deleted-recovery/index.json`
- **完成标准**:
  1. onLoad 从登录接口返回或 globalData 获取 expiresAt、remainingDays
  2. 倒计时展示区（`data-id="deleted-recovery-countdown"`）显示"数据保留至 YYYY-MM-DD（剩余 N 天）"
  3. "恢复账户"按钮（`data-id="deleted-recovery-restore-btn"`）-> `auth.recoverAccount()` -> 存新 JWT -> `wx.switchTab` 到首页 -> Toast"账户已恢复"
  4. "知道了"按钮（`data-id="deleted-recovery-dismiss-btn"`）-> `wx.exitMiniProgram()`
  5. 加载态（`data-id="deleted-recovery-loading"`）
  6. 底部安全区域适配
  7. app.js onLaunch 中（Task 15a）已处理 isDeleted=true 跳转到本页面
- **验证命令**: 微信开发者工具中模拟注销后登录，验证恢复页面展示 + 恢复/退出两种操作

---

### 第 4 梯队：全局横切

---

### Task 28a: ExceptionHandlingMiddleware

- **所属 Story**: 全局横切
- **负责 agent**: `dev-dotnet`
- **依赖**: Task 10（所有 Controller 已就绪）
- **输入**: design.md 3.4 节错误码枚举、`dev-dotnet-standards` 异常处理节
- **产出文件**:
  - `api/Infrastructure/Middleware/ExceptionHandlingMiddleware.cs`
  - `api/Infrastructure/ErrorResponse.cs`
  - `api/Program.cs`（修改，注册中间件到管道最前面）
- **完成标准**:
  1. 统一捕获所有未处理异常
  2. 标准错误响应格式 `{ error: "ERROR_CODE", message: "中文描述", traceId: "guid" }`
  3. 异常映射：WeChatApiException -> 502 WECHAT_API_ERROR；TimeoutException(WeChat) -> 503 WECHAT_API_TIMEOUT；ValidationException -> 400；UnauthorizedAccessException -> 401；FamilyStillActiveException -> 400 FAMILY_STILL_ACTIVE；其他 -> 500（不暴露调用栈）
  4. 敏感数据（openid、密码）不出现在日志
  5. HTTP 500 响应不含内部异常细节
- **验证命令**: 故意触发各异常类型，验证响应格式统一、traceId 存在、敏感数据未泄露

---

### Task 28b: 页面状态完善 + 全局安全区域适配收尾

- **所属 Story**: 全局横切
- **负责 agent**: `dev-miniapp`
- **依赖**: Task 13, Task 14, Task 22a, Task 22b, Task 24a, Task 24b, Task 27a, Task 27b
- **输入**: design.md 3.5 节安全区域适配 + 数据流图（加载/错误态）、`ui-miniapp-standards` 安全区域规范
- **产出文件**:
  - `app/styles/common.wxss`（修改 Task 5b，补充状态通用样式）
- **完成标准**:
  1. common.wxss 补充 `.skeleton` / `.skeleton-line` / `.skeleton-avatar` 骨架屏样式
  2. common.wxss 补充 `.empty-state` 通用空态、`.error-state` 通用错误态样式
  3. 遍历所有页面确认 `.safe-bottom` 类已应用到底部固定元素：mine 页面底部操作区、settings 注销入口、deleted-recovery 按钮、profile-edit 保存按钮、privacy-dialog 底部按钮区、profile-collection 开始使用按钮
  4. iPhone X 模拟器中验证所有页面底部按钮不被 Home Indicator 遮挡
- **验证命令**: 微信开发者工具切换 iPhone X 机型，逐一检查 6 个页面底部安全区域；模拟网络断开检查各页面错误态

---

## Task 汇总表

| Task | 标题 | agent | Story | 依赖 | 文件数 |
|------|------|-------|-------|------|:--:|
| 1 | .NET 10 Web API 项目骨架 | dev-dotnet | 前置 | - | 3 |
| 2 | User 领域实体与枚举 | dev-dotnet | 前置 | T1 | 2 |
| 3 | EF Core DbContext + 初始迁移 | dev-dotnet | 前置 | T1,T2 | 3 |
| 4 | 微信小程序项目初始化 | dev-miniapp | 前置 | - | 3 |
| 5a | Storage 键名 + 隐私工具 | dev-miniapp | A1 | T4 | 2 |
| 5b | 设计令牌 + 公共样式 | dev-miniapp | A1 | T4 | 2 |
| 6 | IWeChatService + WeChatService | dev-dotnet | A1 | T1 | 2 |
| 7 | IJwtService + JwtService | dev-dotnet | A1/A2 | T1 | 2 |
| 8a | Login DTO + Validator | dev-dotnet | A1 | T2 | 3 |
| 8b | Refresh DTO | dev-dotnet | A2 | T2 | 2 |
| 9 | AuthService（login+refresh+惰性检查） | dev-dotnet | A1/A2/A5 | T2,T3,T6,T7,T8a,T8b | 2 |
| 10 | AuthController（login+refresh） | dev-dotnet | A1/A2 | T9 | 1 |
| 11 | services/api.js 请求封装 | dev-miniapp | A1 | T5a | 1 |
| 12 | services/auth.js API 层 | dev-miniapp | A1 | T11 | 1 |
| 13 | privacy-dialog 组件 | dev-miniapp | A1 | T5a,T5b | 4 |
| 14 | privacy-prompt 页面 | dev-miniapp | A1 | T4 | 4 |
| 15a | app.js onLaunch 登录串流 | dev-miniapp | A1 | T5a,T11,T12,T13,T14 | 1 |
| 15b | 日历首页占位 | dev-miniapp | A1 | T4 | 4 |
| 16 | JWT 认证中间件集成 | dev-dotnet | A2 | T7 | 1 |
| 17 | 频率限制中间件 | dev-dotnet | A2 | T1,T16 | 2 |
| 18 | AuthController 续期端点完善 | dev-dotnet | A2 | T9,T10 | 1 |
| 19 | api.js 401 拦截器 + 续期锁 | dev-miniapp | A2 | T11,T12 | 1 |
| 20a | Profile DTO + Validator | dev-dotnet | A3 | T2 | 3 |
| 20b | Profile Service + Controller | dev-dotnet | A3 | T9,T10,T20a | 3 |
| 21 | 头像上传 + IAvatarStorageService | dev-dotnet | A3 | T2,T10 | 3 |
| 22a | profile-collection 组件 | dev-miniapp | A3 | T5b,T12 | 4 |
| 22b | profile-edit 页面 | dev-miniapp | A3 | T12,T22a | 4 |
| 23 | IFamilyQueryService + GET families | dev-dotnet | A4 | T10 | 2 |
| 24a | mine 页面 | dev-miniapp | A4 | T5b,T12 | 4 |
| 24b | settings 页面骨架 | dev-miniapp | A4/A5 | T4,T5b | 4 |
| 25a | Deletion DTO | dev-dotnet | A5 | T2 | 3 |
| 25b | Deletion Service + Controller | dev-dotnet | A5 | T9,T10,T23,T25a | 3 |
| 26 | 定时清理 + 打卡匿名化 | dev-dotnet | A5 | T3,T25b | 3 |
| 27a | settings 注销弹窗流程 | dev-miniapp | A5 | T12,T24b | 2 |
| 27b | deleted-recovery 页面 | dev-miniapp | A5 | T12,T15a | 4 |
| 28a | ExceptionHandlingMiddleware | dev-dotnet | 全局 | T10 | 2 |
| 28b | 页面状态 + 安全区域收尾 | dev-miniapp | 全局 | T13-T27b | 1 |

## 自审清单

- [x] 每个 task <= 3 个文件变更（miniapp 页面/组件 4 文件为平台必需的交付单元，按 1 单元计）
- [x] 每个 task 有验证命令
- [x] 无 TBD/TODO
- [x] 依赖关系无循环（AUTH-001 -> AUTH-002 -> AUTH-003/AUTH-004/AUTH-005 -> 全局）
- [x] 文件路径与 design.md 3.1 节项目结构一致
- [x] 后端 task 标注 `dev-dotnet`，前端 task 标注 `dev-miniapp`
- [x] data-id 已在 design.md 3.5 节定义，各前端 task 完成标准引用对应 data-id
- [x] Story 依赖链体现在 task 排序中：T1-T15b (A1) -> T16-T19 (A2) -> T20a-T22b (A3) / T23-T24b (A4) / T25a-T27b (A5) 并行 -> T28a/T28b
