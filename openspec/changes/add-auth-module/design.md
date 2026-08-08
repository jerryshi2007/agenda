# Design: 认证与账户模块

> Change: `add-auth-module` | Schema: spec-driven | Date: 2026-08-08

---

## Context

### 背景

认证与账户模块是家庭日程协作工具的首个后端模块。当前 `api/` 和 `app/` 目录仅有 CLAUDE.md 骨架文件，代码尚未开始。本模块是家庭、日程、打卡等所有后续模块的前置依赖。

### 当前状态

- **后端**：`api/` 目录为空（仅含 CLAUDE.md），需从零搭建 .NET 10 Web API 项目
- **前端**：`app/` 目录为空（仅含 CLAUDE.md），需从零搭建微信小程序原生项目
- **数据库**：无数据库，需新建
- **需求**：staging 目录 `production/staging/2026-08-08-认证/` 状态为 `dev-ready`，含 7 个用户故事 + 5 个 Story（AUTH-001 ~ AUTH-005）

### 约束

| 约束 | 来源 |
|------|------|
| 平台：微信小程序（基础库 >= 2.10.0），iOS 12+ / Android 8.0+ | CLAUDE.md |
| 后端：.NET 10，EF Core，PostgreSQL | 用户确认 |
| 认证方式：微信静默登录 + 自签发 JWT（7 天有效期） | requirement.md |
| Token 管理：Storage 存储，401 自动静默续期，并发锁 | requirement.md |
| 账户模型：个人账户 + 家庭绑定，openid 唯一标识 | index.md |
| 性能底线：登录流程 <= 3s，续期 <= 2s，我的页面 <= 500ms | requirement.md |
| 安全底线：JWT 密钥环境变量注入，openid 前端不可见，频率限制 10次/分钟 | requirement.md |
| 模块目录：直接放在 api/ 下（如 api/Auth/），不使用 Features/ 层级 | 用户确认 |
| API 版本：URL 路径版本 `/api/v1/`，符合 dev-dotnet-standards | 审核要求 |

---

## Goals / Non-Goals

### Goals

1. 建立完整的微信静默登录链路（隐私政策 -> wx.login -> JWT签发）
2. 实现 JWT 登录态管理（签发/验签/存储/静默续期/并发锁/频率限制）
3. 实现昵称头像收集与用户资料管理（微信原生控件、可跳过、事务一致性）
4. 实现"我的"页面（含家庭操作入口、TabBar 结构）
5. 实现账户注销与 30 天缓冲恢复机制
6. 建立后端项目骨架（.NET 10 Web API）和前端项目骨架（微信小程序原生）
7. 定义 API 契约，为家庭模块、日程模块提供登录态基础

### Non-Goals

- 手机号收集（需企业认证后才支持）
- 退出登录功能（首期不设）
- 设置页扩展（关于、意见反馈、撤销隐私授权——后续版本）
- 多设备登录限制（不限制）
- 家庭模块页面实现（仅提供入口跳转）

---

## Decisions

### 3.1 项目结构与限界上下文划分

#### 整体划分

```
agenda/
├── api/                          # .NET 10 Web API（单项目）
│   ├── Agenda.Api.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   ├── Auth/                     # 认证模块（Controllers, Services, DTOs）
│   │   ├── AuthController.cs
│   │   ├── AuthService.cs
│   │   ├── IAuthService.cs
│   │   ├── Dtos/
│   │   │   ├── LoginRequest.cs
│   │   │   ├── LoginResponse.cs
│   │   │   ├── RefreshRequest.cs
│   │   │   ├── ProfileResponse.cs
│   │   │   ├── UpdateProfileRequest.cs
│   │   │   ├── DeletionStatusResponse.cs
│   │   │   └── RecoverResponse.cs
│   │   └── Validators/
│   │       ├── LoginRequestValidator.cs
│   │       └── UpdateProfileRequestValidator.cs
│   ├── Domain/                   # 共享领域实体
│   │   ├── Entities/
│   │   │   └── User.cs
│   │   └── Enums/
│   │       └── UserStatus.cs
│   ├── Infrastructure/           # 共享基础设施
│   │   ├── Data/
│   │   │   ├── AppDbContext.cs
│   │   │   └── Configurations/
│   │   │       └── UserConfiguration.cs
│   │   ├── Auth/
│   │   │   ├── JwtService.cs
│   │   │   ├── IJwtService.cs
│   │   │   ├── WeChatService.cs
│   │   │   └── IWeChatService.cs
│   │   ├── Storage/
│   │   │   ├── AvatarStorageService.cs
│   │   │   └── IAvatarStorageService.cs
│   │   └── Middleware/
│   │       └── ExceptionHandlingMiddleware.cs
│   └── Migrations/               # EF Core 迁移（自动生成）
├── app/                          # 微信小程序原生
│   ├── app.js / app.json / app.wxss
│   ├── pages/
│   │   ├── index/                # 日历首页（占位，对接后续模块）
│   │   ├── mine/                 # "我的"页面
│   │   ├── profile-edit/         # 编辑资料页
│   │   ├── settings/             # 设置页
│   │   ├── deleted-recovery/     # 注销恢复页面
│   │   └── privacy-prompt/       # 隐私政策拒绝后静态提示页
│   ├── components/
│   │   ├── privacy-dialog/       # 隐私政策弹窗
│   │   └── profile-collection/   # 昵称头像收集页
│   ├── services/
│   │   ├── api.js                # 统一请求封装（拦截器、续期锁）
│   │   └── auth.js               # 认证 API 调用
│   ├── utils/
│   │   ├── storage-keys.js       # Storage 键名常量
│   │   └── privacy.js            # 隐私政策版本管理
│   └── styles/
│       ├── tokens.wxss           # 设计令牌（WeUI 变量映射）
│       └── common.wxss           # 公共样式
└── openspec/                     # OpenSpec 变更管理
```

#### 限界上下文

| 上下文 | 聚合根 | 对应目录 |
|--------|--------|---------|
| Auth（认证） | User | `api/Auth/` |
| Family（家庭） | Family | `api/Family/`（后续） |
| Event（日程） | Event | `api/Event/`（后续） |

**跨上下文交互规则**：
- Auth 上下文输出 `userId` + `JWT` 给其他上下文
- 其他上下文通过 `userId`（JWT 中解析）引用用户，不直接依赖 User 实体
- Family 上下文通过 `familyId` 与 Auth 上下文隔离，User 与 Family 的关联由 FamilyMember 实体管理（家庭模块负责）

#### 数据库策略

- **单数据库**，所有模块共享一个 PostgreSQL 数据库
- EF Core Code First，迁移脚本纳入版本控制
- 每个模块的实体映射在 `Infrastructure/Data/Configurations/` 下统一定义
- 种子数据通过独立 seed 命令执行，不与迁移混合

### 3.2 ADR 决策记录

#### ADR-001: 后端采用 .NET 10 Web API + 单项目结构

- **Context**: 后端需要提供 RESTful API，支持微信认证、CRUD 操作、数据隔离
- **Decision**: 采用 .NET 10 Web API，单项目（`api/Agenda.Api.csproj`），模块按文件夹组织
- **Consequences**:
  - Positive: 强类型、EF Core 成熟、JWT 中间件原生支持、单项目部署简单
  - Negative: 冷启动较 Node.js 慢（但云函数/容器场景影响可控）
- **Alternatives Considered**:
  - Node.js + Express: 冷启动快但弱类型、ORM 生态碎片化
  - Go: 性能好但团队偏好 .NET、ORM 不如 EF Core 成熟
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-002: 模块按文件夹组织（非 Features/ 层级）

- **Context**: 用户明确要求模块直接放在 `api/` 下（如 `api/Auth/`），不使用 `api/Features/Auth/` 层级
- **Decision**: 每个业务模块 = `api/` 下的一个文件夹（`Auth/`、`Family/`、`Event/`），共享 `Domain/` 和 `Infrastructure/`
- **Consequences**:
  - Positive: 目录层级扁平，模块间导航直观，与用户预期一致
  - Negative: 未来模块增多时 `api/` 根目录文件数增加（通过 Domain/ 和 Infrastructure/ 集中管理共享内容缓解）
- **Alternatives Considered**:
  - `api/Features/Auth/`: 多一层目录但模块隔离更好（已由用户否决）
  - 传统分层（所有 Controllers 放一起）: 跨模块改动需在多个目录间跳转
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-003: 微信静默登录 + 自签发 JWT

- **Context**: 微信小程序必须使用 `wx.login` 获取用户身份，首期不收集手机号
- **Decision**: 前端 `wx.login` 获取 code -> 后端 `jscode2session` 换取 openid -> 查找或创建 User -> 签发 JWT（载荷: userId、iat、exp，7 天有效期）
- **Consequences**:
  - Positive: 用户无感知（静默完成）、JWT 无状态可水平扩展、微信生态合规
  - Negative: `jscode2session` 有调用频率限制（需前端加锁防并发、后端限流）；code 一次性使用须处理重试
- **Alternatives Considered**:
  - Session + Cookie: 小程序不支持 Cookie，不可行
  - OAuth 2.0 完整流程: 过度设计，微信小程序场景不需要
  - 微信云开发自动鉴权: 绑定腾讯云，丧失自主可控性
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-004: PostgreSQL 数据库

- **Context**: 需要关系型数据库存储用户、家庭、日程等结构化数据
- **Decision**: PostgreSQL，通过 EF Core 访问
- **Consequences**:
  - Positive: 免费开源、ACID 事务、JSON 支持（适合灵活字段）、成熟 .NET Provider（Npgsql）
  - Negative: 需单独部署（相较于 SQLite），但对服务端应用是标准做法
- **Alternatives Considered**:
  - SQL Server: 商业授权成本高
  - MySQL: JSON 支持和高级查询不如 PG
  - SQLite: 不适合多实例云部署
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-005: 微信小程序原生框架（不使用 uni-app / Taro）

- **Context**: 前端运行在微信小程序平台，暂无跨端需求
- **Decision**: 微信小程序原生框架，`app/` 目录使用原生 WXML/WXSS/JS 结构
- **Consequences**:
  - Positive: 更小包体积（无框架开销）、直接使用微信 API、调试链路短、符合 `dev-miniapp-standards` rule 的全部约束
  - Negative: 无法直接复用 H5/App 代码（但当前无此需求），某些现代前端特性（如 TS 类型推断）需额外配置
- **Alternatives Considered**:
  - uni-app: 跨端能力强但增加包体积和构建复杂度
  - Taro: React 风格但额外依赖和学习成本
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-006: 隐私政策版本号客户端管理

- **Context**: 隐私政策内容可能随版本更新而变化，需确保用户对新内容知情同意
- **Decision**: 在小程序包内硬编码当前隐私政策版本号，同意状态（版本号 + 时间戳）缓存至微信 Storage。每次启动比对版本号，不一致则重新弹窗。
- **Consequences**:
  - Positive: 离线可判断、无服务端依赖、实现简单
  - Negative: 版本号由开发者手动维护（与小程序发版同步），若忘记更新则机制失效
- **Alternatives Considered**:
  - 服务端下发版本号: 可动态控制但增加网络依赖和延迟
  - 不做版本管理: 违反微信审核要求
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-007: Token 续期并发锁（Promise 级）

- **Context**: 多个 API 请求可能同时返回 401，触发多次 wx.login
- **Decision**: 在前端 `services/api.js` 响应拦截器中维护一个全局 Promise 锁。首个 401 触发续期后，后续 401 等待该 Promise 完成，复用结果。
- **Consequences**:
  - Positive: 避免多次 wx.login 浪费微信配额、避免多 JWT 混乱
  - Negative: 锁实现需正确处理失败释放（网络异常、续期失败时解锁并通知等待者）
- **Alternatives Considered**:
  - 队列重放: 实现复杂，过度设计
  - 不处理并发: 会导致多次 code 换取和微信 API 限流
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-008: 30 天到期清理策略 -- 惰性检查 + 定时扫描兜底

- **Context**: 注销账户在 30 天到期后需永久删除个人资料、清理部分关联数据。US7 要求"30 天后数据永久删除"，需确定触发机制。
- **Decision**: 采用**双路径策略**：(1) 主路径：惰性检查 -- 每次登录时，在 `POST /api/v1/auth/login` 中检查 `Status == Deleted && DeletedAt + 30天 < now`，命中则物理删除旧 User 并创建全新 User（视为新用户）；(2) 兜底路径：设置一个轻量级后台定时任务（如 Hangfire 或 Azure Functions Timer Trigger），每天凌晨 3:00 扫描 `Status == Deleted && DeletedAt + 30天 < now` 的 User 并批量清理。两种路径互不冲突：惰性检查确保"再次登录即清理"的即时性，定时任务清理"从未再次登录的沉默用户"。
- **Consequences**:
  - Positive: 惰性检查零额外基础设施（登录本身就走 DB 查询），定时任务兜底彻底；复用已有的 `POST /api/v1/auth/login` 查询路径，不新增单独清理入口；定时任务跨模块可扩展（后续家庭解散 30 天清理也可复用）
  - Negative: 定时任务需要额外的调度基础设施（Hangfire 入进程、或外部 CronJob）；若定时任务故障，沉默用户的过期数据不会被物理清理（但仍被标记为 Deleted，不影响业务）
- **Alternatives Considered**:
  - 纯定时任务无惰性检查：再次登录时可能残留过期数据，体验差（用户看到恢复页但实际已过期）
  - 纯惰性检查无定时任务：从未再登录的沉默用户数据永不清理，浪费存储
  - 数据库定时 Event Scheduler（pg_cron）：与 PostgreSQL 耦合，迁移时需额外同步；.NET 侧无感知
- **Status**: Accepted
- **Date**: 2026-08-08

#### ADR-009: 头像存储方案 -- 本地文件系统 + CDN 反向代理

- **Context**: `POST /api/v1/upload/avatar` 需要持久化头像文件并返回可访问的 URL。头部 CDN 对象存储（阿里云 OSS/腾讯云 COS）会增加运营复杂度和成本，首期规模极小（家庭用户场景，头像数量 < 1000张）。
- **Decision**: 首期采用**本地文件系统存储 + Nginx/CDN 反向代理**。头像上传后存储于服务器本地目录（如 `/data/avatars/{userId}.{ext}`），通过统一的静态资源域名（如 `https://static.example.com/avatars/{userId}.{ext}`）对外暴露，前面挂 Nginx 或 CDN 做缓存和加速。后端存储路径通过 `IConfiguration["Storage:AvatarRootPath"]` 配置、`IConfiguration["Storage:AvatarBaseUrl"]` 配置对外 URL 前缀。
- **Consequences**:
  - Positive: 零外部依赖（不需要 OSS SDK），本地文件 I/O 延迟最低；若未来迁移到对象存储，只需替换 `IAvatarStorageService` 实现（接口已预留）
  - Negative: 文件存储绑定单台服务器（多实例部署前需迁移到共享存储或对象存储）；无自动缩放和跨区域分发（但首期单实例部署，不构成瓶颈）
- **Alternatives Considered**:
  - 阿里云 OSS / 腾讯云 COS：生产级可靠性，但首期需要额外采购/配置云资源，运营成本高
  - Base64 直接存数据库：简单但每次查询都拉全量头像二进制，数据库膨胀严重，不可行
  - 微信云开发云存储：绑定腾讯云生态，丧失自主可控性
- **Status**: Accepted
- **Date**: 2026-08-08

### 3.3 数据模型（ER 图）

#### 实体定义

```
+----------------------------------------------------------------------+
|                            User                                      |
+----------------------------------------------------------------------+
|  Id          : Guid (PK)                                             |
|  OpenId      : string(64)     UNIQUE, NOT NULL, INDEXED              |
|  Nickname    : string(20)     NOT NULL, DEFAULT "微信用户"            |
|  AvatarUrl   : string(500)    NULLABLE                               |
|  Status      : UserStatus     NOT NULL, DEFAULT Active               |
|  DeletedAt   : DateTimeOffset? NULLABLE                              |
|  CreatedAt   : DateTimeOffset  NOT NULL                              |
|  LastLoginAt : DateTimeOffset  NOT NULL                              |
+----------------------------------------------------------------------+
|  UserStatus enum: { Active, Deleted }                                |
|                                                                      |
|  Deletion lifecycle:                                                 |
|    Active --[注销]-->> Deleted (DeletedAt = now)                       |
|    Deleted --[恢复]-->> Active (DeletedAt = null)                      |
|    Deleted --[30天后]-->> 永久删除（物理删除记录）                       |
|                                                                      |
|  Privacy consent: client-side only, version tracked in wx.Storage    |
+----------------------------------------------------------------------+
```

#### ER 关系

```
+----------+
|   User   |
|          |
|  Id (PK) |
|  OpenId  |---- UNIQUE ---- 通过 openid 查找用户（登录/注册）
|  Status  |---- Active / Deleted（注销状态编码在实体中）
|  ...     |
+----------+
     |
     | 1 --------- 0..1 --- (family membership, managed by Family module)
     |                      FamilyMember: UserId + FamilyId + Role
     |
     v
  (后续模块扩展)

隐私政策同意（客户端状态，不持久化到数据库）:
  wx.Storage: { key: "privacy_consent", value: { version: "1.0", time: 1691460000000 } }

登录态（客户端状态，不持久化到数据库）:
  wx.Storage: { key: "auth_token", value: "<jwt>" }
```

#### 关系基数推导

| 关系 | 基数 | 推导来源 |
|------|:----:|---------|
| User -- PrivacyConsent | 1 : 0..1（客户端） | US1: 每个用户有一个同意状态（含版本号），未同意时无记录。客户端管理，不建表。 |
| User -- Deletion | 1 : 0..1 | US7: 每个用户最多有一个活跃的注销状态（Status=Deleted）；Active 用户无注销记录 |
| User -- FamilyMember | 1 : 0..N（家庭模块） | 一个用户可属于 0 个或多个家庭（index.md 2.2） |

#### 级联规则

| 操作 | 规则 |
|------|------|
| 注销账户 | User.Status = Deleted, User.DeletedAt = now。**不级联删除**打卡记录（匿名化保留，移除 userId 替换为 `deleted_user_NNN`） |
| 30 天到期永久删除 | 物理删除 User 记录。**不级联**：打卡记录已在注销时匿名化，FamilyMember 已移除 |
| 正常使用 | 无级联 |

### 3.4 API 契约

所有 API 端点使用 URL 路径版本 `/api/v1/`（符合 dev-dotnet-standards API 版本管理规范）。

#### 端点清单

| 方法 | 路径 | 认证 | 说明 |
|------|------|:--:|------|
| POST | `/api/v1/auth/login` | 否 | 微信登录：code 换 JWT |
| POST | `/api/v1/auth/refresh` | 否 | 续期：新 code 换新 JWT |
| GET | `/api/v1/auth/profile` | 是 | 获取用户资料（昵称/头像/创建时间） |
| PUT | `/api/v1/auth/profile` | 是 | 更新用户资料（昵称/头像） |
| GET | `/api/v1/auth/deletion-status` | 是 | 查询注销状态与可注销条件 |
| POST | `/api/v1/auth/deletion` | 是 | 请求注销账户 |
| POST | `/api/v1/auth/deletion/recover` | 是 | 恢复已注销账户 |
| POST | `/api/v1/upload/avatar` | 是 | 上传头像图片 |
| GET | `/api/v1/users/me/families` | 是 | 获取当前用户关联的家庭列表（供"我的"页面使用） |

#### 请求/响应形状

**登录：**
```
POST /api/v1/auth/login
Request:  { "code": "wx_auth_code_string" }
Response: {
  "jwt": "eyJhbGci...",
  "userId": "guid",
  "isNewUser": true,
  "needsProfileCollection": true
}
Errors: 400 (code invalid/expired), 429 (rate limited), 502 (WeChat API error), 503 (WeChat API timeout)

注：30天到期清理逻辑嵌入此接口——
  查找 User by openid -> Status == Deleted && DeletedAt + 30天 < now
  -> YES: 物理删除旧 User -> 创建新 User -> isNewUser=true
  -> NO (Status==Deleted 但未到期): 返回 isDeleted=true, remainingDays
```

**续期：**
```
POST /api/v1/auth/refresh
Request:  { "code": "wx_auth_code_string" }
Response: { "jwt": "eyJhbGci...", "userId": "guid" }
Errors: 400 (code invalid), 429 (rate limited)
```

**获取资料：**
```
GET /api/v1/auth/profile
Response: {
  "userId": "guid",
  "nickname": "小明妈妈",
  "avatarUrl": "https://static.example.com/avatars/xxx.png",
  "createdAt": "2026-08-08T10:00:00Z"
}
Errors: 401 (token invalid/expired)
```

**更新资料：**
```
PUT /api/v1/auth/profile
Request:  { "nickname": "新昵称", "avatarUrl": "https://..." }
Response: { "userId": "guid", "nickname": "新昵称", "avatarUrl": "https://..." }
Errors: 400 (nickname empty/too long/contains sensitive words), 401, 413 (avatar too large)
```

**注销状态查询：**
```
GET /api/v1/auth/deletion-status
Response: {
  "isDeleted": false,
  "canDelete": true,
  "blockReason": null
}
-- or --
{
  "isDeleted": true,
  "expiresAt": "2026-09-07T10:00:00Z",
  "remainingDays": 23
}
-- or --
{
  "isDeleted": false,
  "canDelete": false,
  "blockReason": "FAMILY_STILL_ACTIVE"
}
Errors: 401
```

**请求注销：**
```
POST /api/v1/auth/deletion
Request:  {} (empty body, user identity from JWT)
Response: { "expiresAt": "2026-09-07T10:00:00Z", "remainingDays": 30 }
Errors: 400 (FAMILY_STILL_ACTIVE - 需先退出所有家庭), 401, 409 (already deleted - 幂等返回200)
```

**恢复注销：**
```
POST /api/v1/auth/deletion/recover
Request:  {} (empty body, user identity from JWT - issued at login for deleted user)
Response: { "jwt": "eyJhbGci...", "userId": "guid" }
Errors: 400 (NOT_DELETED / EXPIRED), 401
```

**上传头像：**
```
POST /api/v1/upload/avatar
Request:  multipart/form-data { file: <image> }
Response: { "url": "https://static.example.com/avatars/xxx.png" }
Errors: 400 (invalid format/size), 401, 413 (file too large)
```

**用户家庭列表（供"我的"页面使用）：**
```
GET /api/v1/users/me/families
Response: {
  "families": [
    {
      "familyId": "guid",
      "familyName": "我们一家",
      "role": "parent",
      "memberCount": 4
    }
  ]
}
Errors: 401

说明：本接口由 Auth 模块提供，内部通过跨上下文调用 Family 模块的 Service 接口（IFamilyQueryService.GetUserFamiliesAsync(userId)）
获取数据。若 Family 模块尚未实现，本接口返回空数组（families: []）。
```

#### 错误码枚举

| HTTP Status | 错误码 | 说明 |
|:--:|------|------|
| 400 | `CODE_INVALID` | 微信 code 无效或已使用 |
| 400 | `CODE_EXPIRED` | 微信 code 已过期 |
| 400 | `NICKNAME_EMPTY` | 昵称为空 |
| 400 | `NICKNAME_TOO_LONG` | 昵称超过 20 字符 |
| 400 | `NICKNAME_SENSITIVE` | 昵称含敏感词 |
| 400 | `FAMILY_STILL_ACTIVE` | 注销被拦截：用户仍属于家庭 |
| 400 | `NOT_DELETED` | 恢复请求无效：用户未处于已注销状态 |
| 400 | `EXPIRED` | 恢复请求无效：30 天已过 |
| 401 | `TOKEN_INVALID` | JWT 无效/过期/被篡改 |
| 409 | `ALREADY_DELETED` | 重复注销请求（幂等） |
| 413 | `FILE_TOO_LARGE` | 头像文件过大 |
| 429 | `RATE_LIMITED` | 登录/续期频率超限 |
| 502 | `WECHAT_API_ERROR` | 微信服务端返回错误 |
| 503 | `WECHAT_API_TIMEOUT` | 微信 API 超时 |

#### 安全约束

- 登录/续期接口：按 `openid`（登录时按 IP）做频率限制，每用户每分钟 <= 10 次
- 所有受保护接口：通过 `[Authorize]` 属性 + JWT Bearer 中间件校验
- JWT 签名密钥：`IConfiguration["Jwt:SecretKey"]`，由环境变量 `JWT_SECRET_KEY` 注入
- 密钥轮换支持：旧密钥验证宽限期 24h（`Jwt:LegacySecretKeys` 数组）
- API 版本：所有端点统一使用 `/api/v1/` URL 路径版本前缀，后续破坏性变更发 `/api/v2/`
- CORS：仅允许小程序合法域名（通过 `appsettings.json` 配置白名单）

### 3.5 前端架构

#### 页面路由与 TabBar

```json
// app.json
{
  "pages": [
    "pages/index/index",
    "pages/mine/index",
    "pages/profile-edit/index",
    "pages/settings/index",
    "pages/deleted-recovery/index",
    "pages/privacy-prompt/index"
  ],
  "tabBar": {
    "list": [
      { "pagePath": "pages/index/index", "text": "日历" },
      { "pagePath": "pages/mine/index", "text": "我的" }
    ]
  }
}
```

| 页面 | 路由 | 类型 | 说明 |
|------|------|------|------|
| 日历首页 | `pages/index/index` | Tab | 占位页，后续对接日程模块 |
| 我的 | `pages/mine/index` | Tab | 头像区 + 家庭信息 + 操作入口 |
| 编辑资料 | `pages/profile-edit/index` | 普通 | 头像更换 + 昵称修改 |
| 设置 | `pages/settings/index` | 普通 | 注销入口等 |
| 注销恢复 | `pages/deleted-recovery/index` | 普通 | 30天缓冲期内恢复/知道了 |
| 隐私提示 | `pages/privacy-prompt/index` | 普通 | 拒绝隐私政策后的静态提示 |

#### 组件树

```
App
+-- privacy-dialog              # 全局弹窗组件（在 app.js onLaunch 中按需渲染）
|   +-- 隐私政策文本（静态嵌入）
|   +-- 勾选框（默认未勾选）
|   +-- [不同意] 按钮
|   +-- [同意并继续] 按钮（勾选后方可用）
+-- pages/index/index           # 日历首页（占位）
+-- pages/mine/index            # "我的"页面
|   +-- 头像昵称区（点击 -> profile-edit）
|   +-- 当前家庭信息区（有家庭时显示）
|   |   +-- 点击 -> 家庭模块成员列表页（传递 familyId）
|   +-- 操作入口列表
|   |   +-- 切换家庭（>=2 个家庭时显示）
|   |   +-- 创建家庭
|   |   +-- 加入家庭
|   |   +-- 设置
|   +-- 空态/错误态/加载态
+-- pages/profile-edit/index    # 编辑资料页
|   +-- 头像区（当前头像 + [更换头像] 按钮，open-type="chooseAvatar"）
|   +-- 昵称输入框（type="nickname"，maxlength=20）
|   +-- [保存] 按钮
|   +-- 校验提示区
+-- pages/settings/index        # 设置页
|   +-- 注销账户入口
|   +-- （后续扩展：关于、反馈等）
+-- pages/deleted-recovery/index # 注销恢复页
|   +-- 倒计时展示（剩余 N 天 + 到期日期）
|   +-- [恢复账户] 按钮
|   +-- [知道了] 按钮
+-- pages/privacy-prompt/index  # 隐私政策拒绝提示页
    +-- 提示文案
    +-- [重新查看隐私政策] 按钮
```

#### 前端 data-id 速查表

所有可交互元素 MUST 添加 `data-id` 属性，命名遵循 `<组件/页面缩写>-<元素角色>` 模式（kebab-case）。以下为本模块涉及的全部可交互元素的 data-id 定义：

| 页面/组件 | 元素 | data-id | 说明 |
|----------|------|---------|------|
| `privacy-dialog` | 勾选框 | `privacy-dialog-checkbox` | 隐私政策勾选框 |
| `privacy-dialog` | 同意按钮 | `privacy-dialog-agree-btn` | 勾选后启用 |
| `privacy-dialog` | 不同意按钮 | `privacy-dialog-decline-btn` | 始终可点击 |
| `privacy-dialog` | 政策链接 | `privacy-dialog-policy-link` | 隐私政策文本链接 |
| `privacy-dialog` | 加载态 | `privacy-dialog-loading` | 操作进行中 |
| `privacy-prompt` | 重新查看按钮 | `privacy-prompt-review-btn` | 拒绝后唯一可操作按钮 |
| `profile-collection` | 头像区 | `profile-collection-avatar` | chooseAvatar 触发区 |
| `profile-collection` | 昵称输入框 | `profile-collection-nickname-input` | type="nickname" |
| `profile-collection` | 开始使用按钮 | `profile-collection-start-btn` | 提交或跳过 |
| `profile-collection` | 加载态 | `profile-collection-loading` | 提交进行中 |
| `mine` | 头像区 | `mine-avatar-area` | 点击进入编辑资料页 |
| `mine` | 当前家庭信息行 | `mine-family-info-{{familyId}}` | 点击进入成员列表 |
| `mine` | 切换家庭入口 | `mine-switch-family` | >=2个家庭时显示 |
| `mine` | 创建家庭入口 | `mine-create-family` | 始终可见 |
| `mine` | 加入家庭入口 | `mine-join-family` | 始终可见 |
| `mine` | 设置入口 | `mine-settings` | 始终可见 |
| `mine` | 加载态 | `mine-loading` | 页面加载中 |
| `mine` | 错误态 | `mine-error` | 加载失败占位 |
| `mine` | 空态（无家庭） | `mine-empty-family` | 无家庭时的空态提示 |
| `profile-edit` | 头像区 | `profile-edit-avatar` | chooseAvatar 触发区 |
| `profile-edit` | 昵称输入框 | `profile-edit-nickname-input` | 修改昵称 |
| `profile-edit` | 保存按钮 | `profile-edit-save-btn` | 提交修改 |
| `profile-edit` | 取消/返回 | `profile-edit-cancel-btn` | 放弃修改返回 |
| `profile-edit` | 校验提示 | `profile-edit-error` | 昵称校验错误提示 |
| `settings` | 注销入口 | `settings-delete-account` | 进入注销流程 |
| `settings` | 注销确认按钮 | `settings-delete-confirm-btn` | 二次确认弹窗中 |
| `settings` | 注销取消按钮 | `settings-delete-cancel-btn` | 取消注销 |
| `deleted-recovery` | 恢复账户按钮 | `deleted-recovery-restore-btn` | 恢复账户 |
| `deleted-recovery` | 知道了按钮 | `deleted-recovery-dismiss-btn` | 保持注销 |
| `deleted-recovery` | 倒计时展示 | `deleted-recovery-countdown` | 剩余天数展示区 |
| `deleted-recovery` | 加载态 | `deleted-recovery-loading` | 恢复操作进行中 |

#### 安全区域适配

小程序页面必须适配 iPhone X+ 底部安全区域和顶部刘海屏。适配策略：

- **底部固定元素**（如"我的"页面底部操作区、设置页底部按钮）：使用 `padding-bottom: calc(20rpx + env(safe-area-inset-bottom))` 留出安全距离
- **顶部自定义导航栏**：本模块使用微信原生导航栏（非 `navigationStyle: custom`），顶部安全区域由微信自动处理，无需手动适配 `statusBarHeight`
- **全局 Reset**：在 `app/styles/common.wxss` 中定义 `.safe-bottom` 工具类，统一底部安全区适配；各页面底部固定元素添加此类即可

适配验证清单：
- iPhone X / XS / 11 Pro / 12 mini / 13 mini（底部有 Home Indicator）
- iPhone 14 Pro / 15 Pro（灵动岛）
- Android 全面屏设备（底部手势导航栏）

#### 数据流

```
+-------------------------------------------------------------------------+
|                           前端数据流                                      |
+-------------------------------------------------------------------------+
|                                                                         |
|  wx.Storage (持久化)                    app.globalData (内存)             |
|  +----------------------+             +--------------------------+      |
|  | auth_token: "<jwt>"  |             | userId: "guid"           |      |
|  | privacy_consent:     |             | userProfile: {...}       |      |
|  |   {version, time}    |             | families: [...]          |      |
|  +----------------------+             |   (GET /users/me/families)|      |
|         |                             +--------------------------+      |
|         | 读取/写入                            |                          |
|         v                                     v                          |
|  +------------------------------------------------------------------+   |
|  |                     services/api.js                               |   |
|  |                                                                    |   |
|  |  请求拦截器:                                                       |   |
|  |    从 Storage 读 JWT -> Authorization: Bearer <jwt>                 |   |
|  |                                                                    |   |
|  |  响应拦截器:                                                       |   |
|  |    200 -> 正常返回                                                  |   |
|  |    401 -> 检查续期锁 -> wx.login -> refresh API -> 存新 JWT -> 重放    |   |
|  |    429 -> 提示"操作频繁"，等待 60s 后可重试                          |   |
|  |    其他 4xx/5xx -> 统一错误处理                                     |   |
|  +------------------------------------------------------------------+   |
|                                                                         |
|  "我的"页面数据来源:                                                    |
|    GET /api/v1/auth/profile     -> 头像/昵称（认证模块）                 |
|    GET /api/v1/users/me/families -> 家庭列表（跨模块调用 Family 服务）    |
|  页面根据 families 数组长度判断:                                        |
|    length == 0 -> "无家庭"布局                                         |
|    length >= 1 -> "有家庭"布局（>=2 时显示切换家庭入口）                  |
|                                                                         |
|  页面数据: 每个页面独立管理自己的 data + 通过 api.js 获取数据              |
|  页面间传参: URL query string (wx.navigateTo 的 query 参数)              |
|                                                                         |
+-------------------------------------------------------------------------+
```

#### 组件契约：`privacy-dialog` 与 `profile-collection`

| 组件 | 属性 (Props) | 事件 (Events) | 说明 |
|------|-------------|---------------|------|
| `privacy-dialog` | `show: Boolean` | `bind:agree` (同意), `bind:decline` (拒绝) | 由 app.js onLaunch 控制展示 |
| `profile-collection` | `prefillNickname: String` | `bind:submit` (含 {nickname, avatarUrl}), `bind:skip` (跳过) | 首次登录后以独立页面展示 |

### 3.6 核心时序图

#### 时序 1: 首次登录（正常路径）

```
用户              小程序前端                        后端 API                    微信服务器
 |                   |                                |                           |
 |  打开小程序        |                                |                           |
 |------------------>|                                |                           |
 |                   |                                |                           |
 |                   |-- 检查 Storage                  |                           |
 |                   |   privacy_consent = null        |                           |
 |                   |                                |                           |
 |                   |-- 展示隐私政策弹窗               |                           |
 |  <----------------|                                |                           |
 |                   |                                |                           |
 |  勾选 + 同意      |                                |                           |
 |------------------>|                                |                           |
 |                   |                                |                           |
 |                   |-- 缓存 consent to Storage       |                           |
 |                   |-- wx.login()                   |                           |
 |                   |                                |                           |
 |                   |   POST /api/v1/auth/login      |                           |
 |                   |   { code }                     |                           |
 |                   |------------------------------->|                           |
 |                   |                                |-- jscode2session(code)    |
 |                   |                                |-------------------------->|
 |                   |                                |<---- openid, session_key  |
 |                   |                                |                           |
 |                   |                                |-- find User by openid      |
 |                   |                                |   -> not found, 创建新用户  |
 |                   |                                |-- 签发 JWT (userId, exp)  |
 |                   |                                |                           |
 |                   |  <-- 200 {jwt,userId,          |                           |
 |                   |         isNewUser:true,         |                           |
 |                   |         needsProfile:true}      |                           |
 |                   |                                |                           |
 |                   |-- 存储 JWT to Storage           |                           |
 |                   |-- set globalData.userId         |                           |
 |                   |                                |                           |
 |                   |-- 导航到昵称头像收集页           |                           |
 |  <----------------|                                |                           |
 |                   |                                |                           |
 |  设置/跳过        |                                |                           |
 |------------------>|                                |                           |
 |                   |                                |                           |
 |                   |-- PUT /api/v1/auth/profile     |                           |
 |                   |   (或跳过，使用默认值)           |                           |
 |                   |------------------------------->|                           |
 |                   |                                |-- 更新 User.Nickname,      |
 |                   |                                |   User.AvatarUrl          |
 |                   |  <-- 200 {profile}             |                           |
 |                   |                                |                           |
 |                   |-- 导航到首页                    |                           |
 |  <----------------|                                |                           |
```

#### 时序 2: 登录 -- wx.login 失败

```
小程序前端                        后端 API
 |                                |
 |-- wx.login() 失败               |
 |   (微信服务异常/网络不可用)       |
 |                                |
 |-- 展示 Toast:                   |
 |   "登录失败，请检查网络后重试"    |
 |-- 显示 [重试] 按钮               |
 |                                |
 |   用户点击重试                  |
 |-- wx.login() 重新调用           |
 |   -> 进入正常流程                |
```

#### 时序 3: 登录 -- 后端换 openid 超时

```
小程序前端                        后端 API                        微信服务器
 |                                |                                |
 |   POST /api/v1/auth/login      |                                |
 |------------------------------->|                                |
 |                                |-- jscode2session(code) ------->|
 |                                |   ... 5s 超时 ...              |
 |                                |                                |
 |                                |-- 自动重试 1 次                 |
 |                                |-- jscode2session(code) ------->|
 |                                |   ... 仍超时 ...               |
 |                                |                                |
 |  <-- 503 {                     |                                |
 |    error: "WECHAT_API_TIMEOUT" |                                |
 |  }                             |                                |
 |                                |                                |
 |-- 展示: "服务繁忙，请稍后重试"    |                                |
```

#### 时序 4: 静默续期（正常路径）

```
小程序前端                            后端 API
 |                                    |
 |-- GET /api/v1/some-resource        |
 |   Authorization: Bearer <jwt>      |
 |----------------------------------->|
 |                                    |-- JWT 验签 -> exp 已过期
 |  <-- 401                           |
 |                                    |
 |-- 响应拦截器捕获 401                |
 |-- 检查续期锁 -> 未锁定              |
 |-- 设置锁 (pendingRefresh)          |
 |-- wx.login() -> new code            |
 |                                    |
 |-- POST /api/v1/auth/refresh        |
 |   { code: "new_code" }             |
 |----------------------------------->|
 |                                    |-- jscode2session(new_code)
 |                                    |-- 签发新 JWT
 |  <-- 200 { jwt: "new_jwt" }       |
 |                                    |
 |-- 更新 Storage: new_jwt            |
 |-- 释放锁                           |
 |-- 重放原请求（携带 new_jwt）        |
 |----------------------------------->|
 |  <-- 200 (正常响应)                |
 |                                    |
 |  用户全程无感知                      |
```

#### 时序 5: 静默续期 -- 并发 401

```
请求 A              请求 B              请求 C             services/api.js
 |                   |                   |                    |
 |-- GET /api/a -----|-------------------|-------------------->|
 |                   |-- GET /api/b -----|-------------------->|
 |                   |                   |-- GET /api/c ----->|
 |                   |                   |                    |
 |  <-- 401 ---------|-------------------|--------------------|
 |                   |  <-- 401 ---------|--------------------|
 |                   |                   |  <-- 401 ---------|
 |                   |                   |                    |
 |                   |                   |  拦截器处理:        |
 |                   |                   |  - 请求 A 抢到锁    |
 |                   |                   |  - 执行 wx.login   |
 |                   |                   |    -> refresh API  |
 |                   |                   |    -> 新JWT写入Storage|
 |                   |                   |    -> 释放锁        |
 |                   |                   |                    |
 |                   |                   |  - 请求 B/C 等待锁  |
 |                   |                   |    -> 锁释放后获取新JWT|
 |                   |                   |    -> 各自重放请求   |
 |                   |                   |                    |
 |  <-- 200 ---------|-------------------|--------------------|
 |                   |  <-- 200 ---------|--------------------|
 |                   |                   |  <-- 200 ---------|
```

#### 时序 6: 静默续期 -- 网络异常

```
小程序前端                            后端 API
 |                                    |
 |-- GET /api/v1/resource             |
 |----------------------------------->|
 |  <-- 401                           |
 |                                    |
 |-- 锁 = pending                     |
 |-- wx.login()                       |
 |   ... 网络不可用 ...                |
 |   wx.login 失败                     |
 |                                    |
 |-- 释放锁（失败状态）                 |
 |-- 清除 Storage 中 JWT               |
 |-- 展示: "网络异常，请检查网络"       |
 |-- 显示 [重试] 按钮                  |
```

#### 时序 7: 账户注销（正常路径）

```
用户              小程序前端                            后端 API
 |                   |                                    |
 |  进入设置 -> 注销  |                                    |
 |------------------>|                                    |
 |                   |                                    |
 |                   |-- GET /api/v1/auth/deletion-status |
 |                   |----------------------------------->|
 |                   |  <-- 200 {canDelete: true}         |
 |                   |                                    |
 |                   |-- 展示注销说明页                     |
 |  <----------------|                                    |
 |                   |                                    |
 |  确认             |                                    |
 |------------------>|                                    |
 |                   |-- 展示二次确认弹窗                   |
 |  <----------------|                                    |
 |                   |                                    |
 |  再次确认          |                                    |
 |------------------>|                                    |
 |                   |                                    |
 |                   |-- POST /api/v1/auth/deletion       |
 |                   |----------------------------------->|
 |                   |                                    |-- 检查家庭关联
 |                   |                                    |-- User.Status = Deleted
 |                   |                                    |-- User.DeletedAt = now
 |                   |                                    |-- 打卡记录匿名化
 |                   |  <-- 200 {expiresAt, remainingDays}|
 |                   |                                    |
 |                   |-- 清除 Storage (JWT)                |
 |                   |-- wx.exitMiniProgram()              |
 |  <----------------|  (小程序关闭)                       |
```

#### 时序 8: 注销恢复（30 天缓冲期内）

```
用户              小程序前端                            后端 API
 |                   |                                    |
 |  重新打开小程序     |                                    |
 |------------------>|                                    |
 |                   |                                    |
 |                   |-- wx.login()                       |
 |                   |   ... 隐私检查（如已同意则跳过）...  |
 |                   |-- POST /api/v1/auth/login {code}  |
 |                   |----------------------------------->|
 |                   |                                    |-- find User by openid
 |                   |                                    |-- Status = Deleted
 |                   |                                    |-- DeletedAt + 30 > now ?
 |                   |                                    |-- -> YES: 签发临时 JWT
 |                   |  <-- 200 {                         |
 |                   |    jwt: "temp_jwt",                |
 |                   |    isDeleted: true,                |
 |                   |    remainingDays: 23               |
 |                   |  }                                 |
 |                   |                                    |
 |                   |-- 存储 JWT to Storage              |
 |                   |-- 导航到恢复页面                    |
 |  <----------------|  (pages/deleted-recovery/index)    |
 |                   |  (显示剩余天数和两个按钮)           |
 |                   |                                    |
 |  点击"恢复账户"    |                                    |
 |------------------>|                                    |
 |                   |                                    |
 |                   |-- POST /api/v1/auth/deletion/recover|
 |                   |----------------------------------->|
 |                   |                                    |-- User.Status = Active
 |                   |                                    |-- User.DeletedAt = null
 |                   |  <-- 200 {jwt: "new_jwt"}         |
 |                   |                                    |
 |                   |-- 存储新 JWT -> 导航到首页          |
 |  <----------------|                                    |
```

#### 时序 9: 注销 30 天到期后登录

```
用户              小程序前端                            后端 API
 |                   |                                    |
 |  重新打开小程序     |                                    |
 |------------------>|                                    |
 |                   |                                    |
 |                   |-- wx.login()                       |
 |                   |-- POST /api/v1/auth/login {code}  |
 |                   |----------------------------------->|
 |                   |                                    |-- find User by openid
 |                   |                                    |-- Status = Deleted
 |                   |                                    |-- DeletedAt + 30 < now ?
 |                   |                                    |-- -> YES: 物理删除 User
 |                   |                                    |-- -> 创建全新 User
 |                   |                                    |-- -> 签发新 JWT
 |                   |  <-- 200 {                         |
 |                   |    jwt, userId,                    |
 |                   |    isNewUser: true                 |
 |                   |  }                                 |
 |                   |                                    |
 |                   |-- 同新用户首次登录流程               |
```

#### 时序 10: "我的"页面加载（家庭数据来源）

```
小程序前端                            后端 API
 |                                    |
 |  进入"我的"页面 (onShow)            |
 |                                    |
 |  +-- GET /api/v1/auth/profile      |  (并发请求)
 |  +-- GET /api/v1/users/me/families |
 |  |                                 |
 |  |------------------------------->|  AuthController -> AuthService
 |  |                                 |    -> IFamilyQueryService.GetUserFamiliesAsync(userId)
 |  |                                 |    -> 返回 [{familyId, familyName, role, memberCount}]
 |  |  <-- 200 {families: [...]}     |
 |  |  <-- 200 {profile}              |
 |  |                                 |
 |  |-- 判断 families.length          |
 |  |   == 0 -> 无家庭布局            |
 |  |   == 1 -> 有家庭布局（隐藏切换） |
 |  |   >= 2 -> 有家庭布局（显示切换） |
 |  |                                 |
 |  |-- 渲染页面                      |
 |  <--                               |
```

---

## Risks / Trade-offs

### 风险清单

| # | 风险 | 影响 | 可能性 | 缓解措施 |
|---|------|------|:--:|---------|
| R1 | 微信 jscode2session 接口限流导致登录失败 | 高 | 低 | 前端 login 加锁防并发；后端每用户每分钟限 10 次；超限返回 429 并提示等待 |
| R2 | JWT 密钥泄露导致所有 Token 可被伪造 | 极高 | 低 | 密钥环境变量注入不进源码；支持密钥轮换（24h 宽限期）；密钥仅运维可访问 |
| R3 | 微信基础库 `<input type="nickname">` 行为变更 | 中 | 中 | 仅用于初始收集和编辑；后端校验昵称长度/敏感词作为最后防线 |
| R4 | 30 天注销缓冲期内数据恢复与业务状态不一致 | 中 | 低 | 注销时清空家庭成员关系；打卡记录立即匿名化；恢复时仅恢复账户，不恢复家庭关系 |
| R5 | PostgreSQL 数据库不可用导致所有功能中断 | 高 | 低 | 运行状况监控；连接池配置合理（超时 5s）；自动故障转移（云环境） |
| R6 | 客户端时钟偏差导致 Token 提前失效 | 低 | 低 | 后端 30 秒时钟偏差容忍；Token 过期前 5 分钟内仍返回 401 触发续期 |
| R7 | 小程序包大小超过 2MB 限制 | 中 | 低 | 首期仅 3 个 Tab、约 5 个页面，预计 < 500KB，远低于限制 |
| R8 | 定时清理任务故障导致过期用户数据堆积 | 低 | 低 | 惰性检查路径独立于定时任务（再次登录即清理）；定时任务配置监控告警（失败时通知运维） |

### 已知权衡

| 权衡 | 选择 | 代价 |
|------|------|------|
| 不限制多设备登录 | 允许同一微信账号多设备同时持有独立 JWT | 无法强制单设备登录（家庭协作场景不需要） |
| 隐私政策版本客户端管理 | 不建服务端表 | 版本号需与小程序发版同步手动维护 |
| 注销状态编码在 User 表 | Status + DeletedAt 字段 | User 表增加状态字段，但避免多表 JOIN |
| Token 续期走 wx.login 而非 refresh_token | 复用微信登录链路 | 每次续期消耗一次 `jscode2session` 调用（但频率低，7 天一次） |
| 单数据库单项目 | 不拆微服务 | 未来模块增多时需注意项目文件数量管理 |
| 30天到期清理走惰性检查 + 定时扫描 | 双路径保证即时性和兜底 | 需要额外的定时任务基础设施（Hangfire / CronJob） |
| 头像本地文件系统存储 | 零外部依赖 + 接口预留迁移 | 多实例部署前需迁移到共享存储 |

---

## Handoff to dev-planning

### 模块到 Task 映射建议

| 模块/Story | 后端 Task | 前端 Task | 集成 Task |
|------------|----------|----------|----------|
| AUTH-001 (隐私+登录) | 搭建项目骨架、User实体、EF Core配置、WeChatService、JwtService、POST /login | 项目初始化、app.json配置、services/api.js、services/auth.js、privacy-dialog组件、privacy-prompt页面 | 前后端联调登录链路 |
| AUTH-002 (登录态管理) | JWT 验签中间件、POST /refresh、频率限制中间件 | 响应拦截器401处理、续期锁、Storage管理 | 联调续期全链路（含并发/异常） |
| AUTH-003 (资料管理) | GET/PUT /profile、敏感词校验、POST /upload/avatar、IAvatarStorageService | profile-collection组件、profile-edit页面 | 联调资料读写+头像上传 |
| AUTH-004 (我的页面) | GET /users/me/families（跨模块调用 IFamilyQueryService） | mine页面、各入口跳转逻辑、安全区域适配 | 联调页面加载+入口跳转 |
| AUTH-005 (账户注销) | GET /deletion-status、POST /deletion、POST /deletion/recover、30天清理（惰性+定时）、打卡记录匿名化 | settings页面、注销确认弹窗、deleted-recovery页面 | 联调注销+恢复全链路 |

### 集成 Task 时机

- AUTH-001 完成后即可进行首次前后端联调（登录链路）
- AUTH-002 在 AUTH-001 基础上叠加，联调续期链路（Mock 401 场景）
- AUTH-003/004/005 在 AUTH-002 完成后可并行开发与联调

### 前置依赖

- 开发环境：.NET 10 SDK、PostgreSQL 实例、微信小程序开发者工具、微信小程序 AppID + AppSecret（测试号即可）
- CI/CD：.NET 项目构建、EF Core 迁移执行、小程序上传密钥配置
- 定时任务：Hangfire 入进程或外部 CronJob（30 天清理兜底）

### 对后续模块的接口承诺

- 所有受保护 API 通过 `[Authorize]` 属性 + JWT Bearer 中间件获取 `userId`（`User.FindFirst("userId")`）
- 家庭模块通过 JWT 中解析的 `userId` 识别当前用户，无需额外认证
- "我的"页面中的家庭操作入口通过 `wx.navigateTo` 跳转，传递 `familyId`（如有）作为 query 参数
- `IFamilyQueryService` 接口定义在 `api/Auth/` 中（作为 Auth -> Family 的跨上下文契约），由 Family 模块实现
