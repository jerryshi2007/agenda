# 家庭管理模块 · 架构设计

## Context

### 需求摘要

家庭管理模块是日程/打卡模块的数据隔离边界补全。产品设计中所有日程与打卡统计均以家庭为数据隔离维度，但家庭实体、成员角色、邀请机制、多家庭切换等功能尚未完整实现。本次变更完整实现家庭生命周期全流程：

**核心功能：**
- 家庭创建（创建者自选角色：家长/孩子，孩子角色可自升级为家长）
- 双轨邀请机制（微信分享卡片邀请家长 + 6 位数字邀请码邀请孩子，邀请码仅用 2-9、24h 有效、一次性、可撤销）
- 成员管理（按家长/孩子分组展示、移除成员、转让创建者、孩子姓名家庭内覆盖微信昵称、已注销成员 30 天缓冲）
- 孩子展示模式设置（学龄前/小学/高年级三档，第一期统一小学模式，仅完成字段存储）
- 多家庭切换（每个家庭独立记忆视图/日期/筛选状态，单家庭隐藏入口）
- 退出解散恢复（创建者不可退出、解散需输入名称确认、解散后数据保留 30 天可恢复、到期物理删除）

**约束：**
- 家庭人数上限：10 人
- 邀请码仅使用数字 2-9（排除易混淆的 0/1 方便孩子输入）
- 数据按家庭隔离，非家庭成员无法访问
- 30 天缓冲规则：已注销成员 → 30 天缓冲期（占位不占名额）→ 到期移除；解散家庭 → 30 天保留可恢复 → 到期物理删除

### 现状对账清单（dev-codegraph rule）

| 分类 | 元素 | 已有现状 | 本次变更处理 |
|------|------|----------|-------------|
| **后端领域实体** | `Family` | `Id/Guid, Name/string(50), CreatedAt/DateTimeOffset` | **扩展** |
| **后端领域实体** | `FamilyMember` | `Id/Guid, FamilyId/Guid, UserId/Guid, Role/UserRole, JoinedAt/DateTimeOffset` | **扩展** |
| **后端枚举** | `UserRole` | `Parent=1, Child=2` | **复用** |
| **后端服务** | `IFamilyContextService` | 已实现，从 `userId` 查询当前家庭上下文 | **复用 + 扩展**（适配多家庭） |
| **后端数据访问** | `AppDbContext` | 已有 `Families` / `FamilyMembers` DbSet | **复用** |
| **后端数据** | `Schedule` | 已有 `FamilyId` 外键，家庭隔离边界预留 | **复用** |
| **后端数据** | `Checkin` | 通过 `Schedule` 关联到家庭，无需额外 `FamilyId` | **复用** |
| **后端接口** | `GET /api/v1/users/me/families` | 已有端点骨架，`EmptyFamilyQueryService` 空实现 | **扩展**（完整实现） |
| **前端页面** | `pages/mine/index.js` | 已有骨架，操作入口占位，点击显示"开发中" | **扩展**（实现跳转） |
| **前端服务** | `services/auth.js` | 已有 `getMyFamilies()` 封装 | **复用** |
| **功能** | 邀请码生成/验证/撤销 | 无 | **新建** |
| **前端页面** | 首次引导/创建家庭/加入家庭/邀请成员/邀请记录/成员列表/展示模式设置/切换家庭/恢复家庭 | 无 | **新建**（7 页） |

### 限界上下文划分

| 限界上下文 | 聚合根 | 说明 |
|-------------|--------|------|
| `family-lifecycle` | `Family` | 家庭创建/修改名称/多家庭切换/退出/解散/恢复 |
| `family-member` | `FamilyMember` | 成员邀请加入/成员列表/移除/转让创建者/孩子姓名/展示模式设置/已注销处理 |
| `family-invite` | `InvitationCode` | 邀请码生成/验证/撤销/过期处理、微信分享卡片参数生成 |

**项目结构对齐已有模式：**
- 后端：`Agenda.Api.Family/` 命名空间，分层（Controller/Dtos/Services/Validators）
- 前端：`app/pages/family-*/` 各页面，`app/services/family.js` API 封装

## Goals-NonGoals

### Goals
- 完整实现需求文档中 Must 优先级全部功能
- 对齐已有架构模式（.NET 分层 + EF Core + 微信小程序原生）
- 产出完整 API 契约（枚举/错误码/DTO）供三端共享
- 增量设计不破坏现有日程/打卡/认证模块功能
- 支持数据按家庭隔离的安全约束

### NonGoals
- 第一期不实现差异化展示模式 UI 渲染（仅存储设置，第二期实现）
- 第一期不实现成员搜索（家庭上限 10 人，滚动足够）
- 第一期不实现解散后订阅消息通知（成员打开自然看到提示）
- 不改变现有认证流程（JWT 保持不变）

## Decisions

### ADR 记录

---

#### ADR-001：家庭上下文注入方式 — X-Family-Id Header

**Context**
- 用户可同时属于多个家庭，需要在 API 请求中指明当前操作哪个家庭
- 现有架构：JWT 携带 userId，家庭上下文需要额外传递

**Decision（用户确认 2026-08-18）**
- 采用 **`X-Family-Id` 请求 Header** 方案
- 前端在切换家庭后，将当前选中家庭 ID 存储到本地，后续每个 API 请求都携带此 Header
- 后端 middleware 从 Header 解析并验证用户是否为该家庭成员，存入请求上下文供业务层使用

**Alternatives Considered**
1. **JWT Token Claim** — 将当前 FamilyId 存在 JWT Claim 中。缺点：切换家庭需要重新获取 Token，用户体验差。否决。
2. **查询参数 `?familyId=xxx`** — 放在 URL 中。缺点：POST/PUT 请求不自然，日志可能记录。否决。

**Consequences**
- ✅  Positive：切换家庭无需重新登录，用户体验流畅
- ✅  Positive：符合现有中间件扩展模式，不改变认证流程
- ✅  Positive：每个请求明确指定上下文，便于调试
- ❌  Negative：前端需要记住当前选中家庭并在每个请求携带，增加少量重复代码

**Status**：Accepted

---

#### ADR-002：已注销成员 30 天缓冲 — 软删除 + DeletedAt 时间戳

**Context**
- 需求：家庭成员注销账户后，需要保留 30 天占位（显示为"已注销"灰色，不占用家庭人数名额），30 天后自动彻底移除
- 若用户在 30 天内恢复账户，需要自动恢复家庭成员身份

**Decision（用户确认 2026-08-18）**
- `FamilyMember` 实体新增：
  - `IsDeleted: bool` — 标记是否已注销
  - `DeletedAt: DateTimeOffset?` — 注销时间，null 表示未注销
- 查询规则：
  - 成员列表显示：包括已注销（灰色占位）
  - 家庭人数计算：`WHERE IsDeleted = false`（已注销不占用名额）
  - 后台清理定时任务：移除 `DeletedAt < now - 30days` 的记录

**Alternatives Considered**
1. **直接删除** — 账户注销后立即删除 `FamilyMember`。缺点：不满足 30 天缓冲需求，用户恢复账户需要重新邀请。否决。

**Consequences**
- ✅  Positive：精确满足需求，用户恢复账户后自动恢复成员身份
- ✅  Positive："不占用名额"容易实现（SQL 过滤）
- ❌  Negative：需要新增两个字段，增加少量存储

**Status**：Accepted

---

#### ADR-003：家庭解散恢复 — Family.Status 枚举

**Context**
- 需求：家庭解散后，数据保留 30 天，任意原成员可在 30 天内恢复，30 天后永久删除
- 需要决定：解散后如何存储状态，是否级联删除所有子数据

**Decision（用户确认 2026-08-18）**
- `Family` 实体新增：
  - `Status: FamilyStatus` 枚举 — `Normal` / `Dissolved`
  - `DissolvedAt: DateTimeOffset?` — 解散时间，null 表示未解散
  - `CreatorId: Guid` — 创建者 ID（原有字段缺失，本次新增）
- 解散行为：仅修改 `Family.Status = Dissolved` + `DissolvedAt = now`，**不修改** `FamilyMember`/`Schedule`/`Checkin` 等子数据
- 恢复行为：仅修改 `Family.Status = Normal` + `DissolvedAt = null`，所有数据自动恢复完整
- 物理删除：30 天后级联删除所有关联数据（依赖 EF Core 级联删除配置）

**Alternatives Considered**
1. **级联软删除** — `Family` 软删除 + 级联所有 `FamilyMember`/`Schedule` 都软删除。缺点：恢复需要级联恢复，复杂度高，容易漏恢复。否决。

**Consequences**
- ✅  Positive：实现最简单，恢复时数据完整性 100% 保证
- ✅  Positive：符合需求"任意原成员可恢复"
- ❌  Negative：解散后数据仍占用存储空间 30 天，可接受

**Status**：Accepted

---

### 数据模型设计

#### ER 图

```
┌─────────────────────────────────────────────────────────────────┐
│                         User (已有)                              │
│                                                                 │
│  Id: Guid PK                                                    │
│  ... (已有字段保持不变)                                         │
│                                                                 │
│          │ 1                                                    │
│          │                                                      │
│          │ 0..*                                                 │
│          ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
  │                     FamilyMember (扩展)                    │    │
  │                                                           │    │
  │  Id: Guid PK                                              │    │
  │  FamilyId: Guid FK → Family                               │    │
  │  UserId: Guid FK → User                                    │    │
  │  Role: UserRole (enum: Parent/Child)                       │    │
  │  JoinedAt: DateTimeOffset                                 │    │
  │  ChildName: string? (nullable, 覆盖微信昵称)              │    │
  │  DisplayMode: DisplayMode (enum: Preschool/Primary/...)  │    │
  │  IsDeleted: bool (soft delete for 30 days grace)          │    │
  │  DeletedAt: DateTimeOffset?                               │    │
  │                                                           │    │
  └─────────────────────────────────────────────────────────┘    │
│          │ 1                                                    │
│          │                                                      │
│          │                                                      │
└──────────┼──────────────────────────────────────────────────────┘
           │
           │ 0..*
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Family (扩展)                               │
│                                                                 │
│  Id: Guid PK                                                    │
│  Name: string (max 50)                                          │
│  CreatedAt: DateTimeOffset                                      │
│  CreatorId: Guid FK → User  <- 新增                              │
│  Status: FamilyStatus (Normal/Dissolved)  <- 新增                │
│  DissolvedAt: DateTimeOffset?                    <- 新增         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           │ 1
           │
           │ 0..*
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   InvitationCode (新建)                         │
│                                                                 │
│  Id: Guid PK                                                    │
│  Code: string (6 chars, unique)                                 │
│  FamilyId: Guid FK → Family                                     │
│  TargetRole: UserRole                                           │
│  TargetChildName: string? (nullable, 邀请孩子时指定)            │
│  TargetDisplayMode: DisplayMode?  <- 邀请孩子时指定           │
│  CreatorId: Guid FK → User                                     │
│  CreatedAt: DateTimeOffset                                      │
│  ExpiresAt: DateTimeOffset                                     │
│  Status: InvitationCodeStatus (Pending/Used/Redeemed/Expired)  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           │
           │ (Schedule 已有 FamilyId FK 存在)
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Schedule (已有)                                │
│                          FamilyId → Family                      │
└─────────────────────────────────────────────────────────────────┘
```

#### 关系基数与级联规则

| 关系 | 基数 | 级联删除 | 说明 |
|------|------|----------|------|
| User → FamilyMember | 1 : 0..* | 级联 | User 删除 → FamilyMember 级联删除 |
| Family → FamilyMember | 1 : 0..* | 级联 | Family 删除 → FamilyMember 级联删除 |
| Family → InvitationCode | 1 : 0..* | 级联 | Family 删除 → InvitationCode 级联删除 |
| Family → Schedule | 1 : 0..* | 级联 | 已有，保持不变 |

#### 唯一性约束

- `FamilyMember(UniqueIndex: (FamilyId, UserId))` — 同一个用户不能重复加入同一个家庭
- `InvitationCode(unique: Code)` — 邀请码全局唯一

### 后端架构设计

#### 分层结构

```
Agenda.Api/
└── Family/
    ├── Controllers/        # API 控制器
    ├── Dtos/               # 请求/响应 DTO
    ├── Services/           # 业务服务
    ├── Interfaces/         # 接口定义
    └── Validators/         # FluentValidation 校验
```

**对齐已有模式**：与 `Auth` / `Schedule` / `Checkin` 模块结构一致。

#### API 契约轮廓

| 端点 | 方法 | 说明 | 需要 `X-Family-Id` |
|------|------|------|:----------------:|
| `GET /api/v1/families/me` | GET | 获取当前用户所有家庭列表 | - |
| `POST /api/v1/families` | POST | 创建家庭 | - |
| `PUT /api/v1/families/{id}/name` | PUT | 修改家庭名称 | ✅ |
| `GET /api/v1/families/{id}/members` | GET | 获取家庭成员列表 | ✅ |
| `POST /api/v1/families/{id}/invite-code` | POST | 生成邀请码 | ✅ |
| `GET /api/v1/families/{id}/invites` | GET | 获取邀请记录列表 | ✅ |
| `DELETE /api/v1/families/{id}/invites/{codeId}` | DELETE | 撤销邀请码 | ✅ |
| `POST /api/v1/families/join-by-code` | POST | 通过邀请码加入家庭 | - |
| `DELETE /api/v1/families/{id}/members/{memberId}` | DELETE | 移除成员 | ✅ |
| `POST /api/v1/families/{id}/transfer-creator/{newCreatorId}` | POST | 转让创建者 | ✅ |
| `PUT /api/v1/families/members/{memberId}/display-mode` | PUT | 设置孩子展示模式 | ✅ |
| `POST /api/v1/families/{id}/exit` | POST | 退出家庭 | ✅ |
| `POST /api/v1/families/{id}/dissolve` | POST | 解散家庭 | ✅ |
| `POST /api/v1/families/{id}/restore` | POST | 恢复解散家庭 | - |
| `GET /api/v1/families/get-share-info/{code}` | GET | 获取分享卡片信息（微信分享） | - |

**说明**：
- `X-Family-Id` 不是必须的端点：创建家庭 / 加入家庭 / 恢复家庭 这些操作发生在用户无家庭或非当前家庭场景，不需要
- 所有端点都需要 JWT 鉴权（`Authorization: Bearer <token>`）

#### 认证授权方案

- **认证**：沿用现有 JWT 认证，从 JWT 获取 userId
- **家庭上下文**：middleware 从 `X-Family-Id` Header 读取家庭 ID，验证当前用户是该家庭成员，验证通过后将 `FamilyId` + `Role` 存入 `HttpContext.Items`
- **权限检查**：
  - 修改家庭名称 / 邀请 / 移除成员 / 转让创建者 / 解散 → 需要 `Parent` 角色
  - 创建者转让 / 解散 → 需要创建者身份
  - 退出 → 不能是创建者且家庭还有其他成员（最后一人例外）

### 前端架构设计（微信小程序）

#### 新增页面

| 页面路径 | 功能 | 说明 |
|----------|------|------|
| `pages/family-welcome/index` | 首次引导页 | 登录后无家庭时显示，提供"创建家庭"/"加入家庭"按钮 |
| `pages/family-create/index` | 创建家庭页 | 输入名称 + 选择角色 |
| `pages/family-join/index` | 加入家庭页 | 输入邀请码 |
| `pages/family-invite/index` | 邀请成员页 | 选择邀请类型（家长/孩子）、生成邀请码/分享卡片 |
| `pages/family-invite-list/index` | 邀请记录列表 | 查看所有邀请、撤销待使用邀请 |
| `pages/family-members/index` | 成员列表页 | 成员列表（分组）、操作入口、退出/解散 |
| `pages/family-display-mode/index` | 展示模式设置页 | 选择孩子展示模式 |
| `pages/family-switch/index` | 切换家庭页 | 展示所有家庭列表、切换 |
| `pages/family-restore/index` | 恢复家庭页 | 解散后恢复提示与操作 |

> 共计 9 页，其中必须实现 8 页（`family-restore` 是可选边界场景也需要）。

#### 新增 API 封装

`app/services/family.js` — 封装上述所有端点。

#### 状态管理

- 当前选中家庭 ID：存储在 `getApp().globalData.currentFamilyId` + 本地缓存 `STORAGE_KEYS.CURRENT_FAMILY_ID`
- 每个家庭的独立状态记忆：**前端微信本地缓存按家庭存储**，结构如下：

  ```javascript
  // Storage key: `family-{familyId}-state`
  {
    lastView: 'week' | 'month' | 'day',  // 上次视图
    lastDate: 'YYYY-MM-DD',             // 上次查看日期
    filter: {
      childId: Guid | null,             // 按孩子筛选
      type: ScheduleType | null        // 按类型筛选
    }
  }
  ```

**ADR-004：多家庭 UI 状态记忆存储方案 — 前端本地缓存按家庭分键存储**

**Context**
- 需求要求"每个家庭独立记忆上次视图/日期/筛选状态"，切换家庭时恢复
- 需要决定存储位置：后端存储还是前端本地缓存

**Decision（审核建议采纳 2026-08-18）**
- 采用 **前端本地缓存** 方案
- 使用分键存储：`family-{familyId}-state` 作为 Storage 键，每个家庭独立存储 JSON 结构
- 存储字段：`lastView`（上次视图）、`lastDate`（上次日期）、`filter`（筛选条件）

**Alternatives Considered**
1. **后端存储** — 后端 `UserFamilyState` 表存储每个用户-家庭的状态。缺点：增加后端复杂度，状态是 UI 层面不需要后端同步。否决。

**Consequences**
- ✅  Positive：实现非常简单，不需要后端新增表或字段
- ✅  Positive：满足需求，每个家庭独立记忆
- ❌  Negative：换设备登录不恢复之前的状态，可接受（用户重新选择即可）

**Status**：Accepted

---

**总结**
- 当前选中家庭 ID：`getApp().globalData.currentFamilyId` + 本地缓存
- 每个家庭状态记忆：前端 `wx.setStorageSync` 按 `family-{familyId}-state` 键独立存储
- API 请求封装 `services/api.js` 会自动从本地读取当前 `currentFamilyId` 并添加 `X-Family-Id` Header

### InvitationCode 设计要点

- **邀请码生成**：6 位纯数字，仅使用 `2-9` 八个数字（排除 0/1 避免孩子输入混淆）
- **碰撞处理**：生成后检查唯一性，重复则重新生成，最多重试 5 次
- **有效期**：生成时间 + 24 小时 = 过期时间
- **过期判定时机**：**查询时动态判断**（审核推荐方案，2026-08-18 采纳）
  - 每次查询邀请码验证时，比较 `ExpiresAt` 和当前时间，如果已过期则状态自动判定为 `Expired`
  - 不需要定时任务批量更新状态，实现更简单
  - 不会有批量更新延迟，过期判定精确到秒
- **状态机**：

```
Pending → Used (被使用)
   ↓
Redeemed (被撤销)
   ↓
Expired (过期动态判定)
```

---

#### ADR-005：前端框架选型 — 沿用微信原生小程序

**Context**
- 项目已有技术栈：微信原生小程序（WXML / WXSS / JavaScript），不使用 uni-app / Taro 等跨端框架
- 需要确认本次新增家庭模块是否沿用既有技术栈

**Decision（审核建议采纳 2026-08-18）**
- **沿用微信原生小程序**，不引入新框架
- UI 组件遵循 `ui-miniapp-standards` rule：
  - 优先使用微信原生组件
  - 第三方组件使用 Vant Weapp（项目约定）
  - 样式定制走设计令牌映射到 WeUI CSS 变量

**Alternatives Considered**
1. **引入 uni-app / Taro** — 需要重构已有代码，成本高。本次变更不改变技术栈。否决。

**Consequences**
- ✅  Positive：和现有代码风格一致，开发者熟悉
- ✅  Positive：不需要额外编译工具链，保持简单
- ✅  Positive：符合项目 `CLAUDE.md` 约定（微信小程序前端）
- ❌  Negative：无法跨端复用，但产品目标平台就是微信小程序，可接受

**Status**：Accepted

---

### 微信分享卡片设计

- 分享路径：`pages/family-welcome?inviteCode={code}`
- 后端生成分享参数（path + query），前端调用 `wx.shareAppMessage`
- 用户点击卡片打开小程序 → 跳转到加入页面，自动填入邀请码 → 用户确认加入

### 前端"我的"页面修改

- `onFamilyTap` → 跳转到 `family-members` 页面（当前家庭的成员管理）
- `onSwitchFamily` → 跳转到 `family-switch` 页面
- `onCreateFamily` → 跳转到 `family-create` 页面
- `onJoinFamily` → 跳转到 `family-join` 页面

## Risks-Trade-offs

### 风险与权衡

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 邀请码碰撞 | 生成时重复，概率低 | 生成后检查唯一性，重复重试 |
| 多人同时用同一邀请码 | 第一个成功，第二个失败 | 事务 + 唯一约束，保证原子性 |
| 解散后恢复多人同时操作 | 第一个恢复成功，后续失败 | 事务 + 状态检查，幂等 |
| 已注销成员 30 天后自动清理 | 需要定时任务 | 托管给 IHostedService 定时执行（已有删除清理服务可复用） |

###  Trade-offs

- **简单性优先**：解散恢复采用仅修改 Family.Status 方案，虽然解散后数据仍占用空间 30 天，但实现简单且恢复可靠，优先选择简单性
- **无状态前端缓存**：家庭 UI 状态记忆存在前端，不需要后端存储，减少后端复杂度
- **邀请码排除 0/1**：牺牲少量熵（从 10^6 → 8^6 = 26万，仍足够），换取孩子输入更低错误率，符合产品目标

---

## 构建序列

1. 后端：新增枚举（`FamilyStatus`/`InvitationCodeStatus`/`DisplayMode`）→ 实体扩展（`Family`/`FamilyMember` 新增字段）→ 新增 `InvitationCode` 实体 → 新增 EF Core 配置 → 新增迁移
2. 后端：新增 DTO/Validators → 新增 Services → 新增 Controller
3. 前端：新增 pages 骨架 + API 封装 `family.js`
4. 前端：实现首次引导 + 创建家庭页面
5. 前端：实现邀请流程（邀请生成 + 邀请记录 + 加入）
6. 前端：实现成员管理 + 展示模式设置
7. 前端：实现多家庭切换 + "我的"页面接入
8. 前端：实现退出解散恢复
9. 后端：集成家庭上下文 middleware 更新
10. 联调测试

---

## 自审检查

- [x] spec 覆盖：所有需求功能都有对应设计
- [x] ER 可反推：每个关系基数可从需求场景反推
- [x] 时序完整：正常路径 + 异常分支都考虑
- [x] 项目结构已对齐：与现有 Auth/Schedule/Checkin 模块结构一致
- [x] 复用检查：尽可能复用已有实体/服务/接口
- [x] 现状对账：完成，清单已写入本节
- [x] 无 TBD/TODO：所有决策已完成
- [x] 规则合规：避开 C#/SQL 关键词（`Family`/`FamilyMember` 都不是关键词）
- [x] 契约文件：将产出 `openspec/contracts/family/` 下三个 JSON
