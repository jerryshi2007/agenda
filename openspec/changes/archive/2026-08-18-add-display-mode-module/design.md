## Context

本变更实现**孩子展示模式模块**，为不同年龄阶段的孩子提供适配认知水平的 UI 体验。

**背景与现状：**
- 产品需求：三种展示模式（学龄前/小学/高年级），一期仅实现小学模式基准视图
- 数据库层面：`FamilyMember` 实体已存在 `DisplayMode` 字段（默认值 `Primary`），无需新增数据库字段
- 后端层面：`DisplayMode` 枚举已定义，`SetDisplayMode` API 端点已存在于 `FamilyController`
- 前端层面：家长端展示模式设置页面 `family-display-mode` 已创建
- 契约层面：`DisplayMode` 枚举已在 `openspec/contracts/family/enums.json` 定义

**约束：**
- 遵循既有分层架构：Domain → Application → Controller 分层
- 小程序前端遵循：页面 kebab-case 命名、统一 API 封装、data-id 可测试契约
- API 契约遵循 `dev-contracts` 规则，共享枚举/错误码/DTO
- 一期范围：仅小学模式全量开发，学龄前/高年级差异化 UI 留二期

## Goals / Non-Goals

**Goals:**
- 为孩子用户提供小学模式基准视图：今日/周/月只读视图 + 直接打卡 + 本周完成率
- 扩展 JWT token 包含 `displayMode` claim，小程序无需额外 API 获取
- 孩子端权限控制：只能查看/打卡自己的日程，不能编辑
- 遵循已有架构模式，增量设计不推翻既有实现

**Non-Goals:**
- 不实现学龄前模式差异化 UI（二期）
- 不实现高年级模式差异化 UI（二期）
- 不实现家长端模式配置入口（已在家庭模块实现）
- 不修改数据库结构（DisplayMode 字段已存在）

## 现状对账清单（dev-codegraph）

| 已有实体/服务/组件 | 现状 | 本次变更 |
|------------------|------|----------|
| `DisplayMode` 枚举（api/Domain/Enums/DisplayMode.cs）| 已定义 `Preschool=1`/`Primary=2`/`UpperGrades=3` | **复用** — 无需修改 |
| `FamilyMember.DisplayMode` 字段 | 已存在数据库字段，默认值 `Primary` | **复用** — 无需迁移 |
| `SetDisplayMode` API（FamilyController）| 已实现端点 | **复用** — 无需修改 |
| `openspec/contracts/family/enums.json` | DisplayMode 已定义 | **复用** — 无需修改 |
| `app/contracts/family.js` | DisplayMode 枚举已同步 | **复用** — 无需修改 |
| `app/pages/family-display-mode/` | 设置页面已创建 | **复用** — 无需修改 |
| `Schedule` 实体 | 已存在，`AssignedChildId` 字段关联孩子 | **复用** — 权限检查已实现 |
| `ScheduleService.GetByIdAsync` | 已有孩子权限检查（`role == Child && schedule.AssignedChildId != userId` → 403） | **复用** — 权限逻辑已正确 |
| `ScheduleQueryService` | 已有按日期查询日程列表 | **扩展** — 需新增孩子端专用查询端点 |
| JWT token generation | 已有 auth 流程生成 token | **扩展** — 需添加 `displayMode` claim |
| 小程序孩子端页面 | 不存在 | **新建** — 新增 4 个页面：child-today / child-week / child-month / child-mine |
| 孩子端日程查询 service | 不存在 | **新建** — 新增 `services/child-schedule.js` |
| 孩子端本周完成率统计 | 不存在 | **新建** — 后端新增查询 API |

## 限界上下文划分

| 限界上下文 | 聚合根 | 说明 | 项目/命名空间 |
|------------|--------|------|--------------|
| **Family** | `Family` / `FamilyMember` | 展示模式作为 FamilyMember 属性存储 | 已有 `Agenda.Api.Family` → **复用扩展** |
| **Auth** | `User` | JWT 添加 displayMode claim | 已有 `Agenda.Api.Auth` → **扩展** |
| **Schedule** | `Schedule` | 孩子端查询日程、权限检查 | 已有 `Agenda.Api.Schedule` → **扩展** |
| **Checkin** | `Checkin` | 打卡操作、统计计算 | 已有 `Agenda.Api.Checkin` → **复用扩展** |
| **MiniProgram Frontend** | N/A | 孩子端四页面 + service 层 | `app/pages/child-*` + `app/services/child-*.js` → **新建** |

### 划分原则确认

- **项目策略**：不新增 .NET 项目，扩展现有 `Agenda.Api.Family` / `Agenda.Api.Auth` / `Agenda.Api.Schedule` / `Agenda.Api.Checkin` 项目
- **命名空间策略**：保持现有命名空间，新增类型放在对应现有命名空间
- **数据库策略**：不新增表，不修改现有表结构（`DisplayMode` 字段已存在）

> 请确认以上划分原则是否正确？

---

## 决策记录 (ADR)

### ADR 001：孩子端页面独立于家长端

**Context**
- 需求要求孩子端视图与家长端不同（只读、简化、不同布局）
- 现有家长端已有 schedule today/week/month 页面

**Decision**
- 小程序端新建独立的孩子端页面：`child-today` / `child-week` / `child-month` / `child-mine`
- 不复用家长端页面加条件分支——分离关注点，避免复杂度爆炸

**Alternatives Considered**
1. **复用家长端页面 + 条件分支渲染**：节省代码但逻辑复杂，后续模式扩展会让代码难以维护
2. **抽成通用组件 + 不同页面组合**：当前一期仅小学模式，过早抽象收益不大

**Consequences**
- Positive：页面逻辑清晰、独立可演化、不同模式可独立优化
- Negative：少量代码重复（日历组件可抽成共享）
- Status：Accepted

### ADR 002：JWT 携带 displayMode，不额外 API 查询

**Context**
- 小程序进入应用时需要立即知道当前展示模式来选择正确渲染方式
- 有两种选择：(1) JWT 携带；(2) 登录后额外 API 查询获取

**Decision**
- 在 JWT token 中添加 `displayMode` claim（仅当角色为 Child 时）
- 小程序登录后可直接从 token 读取，无需额外网络请求

**Alternatives Considered**
1. **小程序登录后调用 /api/me 获取**：需要额外 round-trip，增加首屏加载时间
2. **小程序本地缓存**：模式变更后缓存不一致需要过期处理，复杂度高

**Consequences**
- Positive：零额外网络请求，首屏更快，实现简单
- Negative：JWT 长度略有增加（可忽略，仅增加十几个字符）
- Status：Accepted

### ADR 003：孩子端查询接口复用现有业务逻辑

**Context**
- 孩子端需要查询今日/周/月日程
- 已有 `ScheduleQueryService` 支持按日期范围查询

**Decision**
- 在 `ScheduleQueryService` 中新增 `GetChildDailyListAsync` / `GetChildWeeklyListAsync` / `GetChildMonthlyListAsync` 方法
- 复用现有查询逻辑，只增加孩子权限过滤（仅返回 AssignedChildId == 当前 userId 的日程）
- 返回 DTO 与家长端相同，前端根据只读模式渲染

**Alternatives Considered**
1. **全新写一套查询逻辑**：重复代码，维护成本高
2. **修改现有方法增加参数 `isChildReadonly`**：污染现有API，现有调用者不需要这个参数

**Consequences**
- Positive：复用现有查询逻辑和缓存（若有），测试成本低
- Negative：方法数量略有增加，但每个方法很简单
- Status：Accepted

### ADR 004：小学模式我的页面仅显示本周完成率

**Context**
- 需求规定小学模式我的页面只显示本周完成率，不显示其他统计

**Decision**
- 后端新增 `GetChildWeeklyCompletionRateAsync` API
- 返回：`{ percentage, completed, total }`
- 前端简单条形进度条展示

**Alternatives Considered**
1. **复用现有家庭统计 API 过滤**：家庭统计返回全家庭数据，过滤后数据量浪费
2. **前端计算完成率**：需要返回全量本周日程给前端计算，数据量更大

**Consequences**
- Positive：后端计算，只返回需要的数据，网络流量小
- Negative：需要新增一个小端点，实现简单
- Status：Accepted

## 架构设计

### 后端架构（.NET）

#### 分层与模块边界

```
Agenda.Api
├── Auth
│   ├── Services
│   │   └── TokenService.cs          —— 添加 displayMode claim 到 JWT
│   └── ... (existing)
├── Family
│   └── ... (existing, DisplayMode already defined)
├── Schedule
│   ├── Controllers
│   │   └── ChildScheduleController.cs  —— NEW: 孩子端查询端点
│   ├── Dtos
│   │   └── ChildScheduleResponses.cs  —— NEW: 孩子端响应 DTO
│   ├── Services
│   │   └── IChildScheduleQueryService.cs —— NEW: 孩子端查询接口
│   └── ... (existing)
└── Checkin
    ├── Services
    │   └── ICompletionStatsService.cs  —— EXTEND: 添加孩子本周完成率统计
    └── ... (existing)
```

#### ER 图（现状不变，仅标注关系）

```
┌─────────────────────────────────────────────────────────────┐
│                     Family                                    │
│  Id: Guid                                                    │
│  Name: string                                                │
└──────────────┐──────────────────────────────────────────────┘
               │ 1
               │
               │
        ┌──────▼──────────┐        ┌───────────────────────┐
        │  FamilyMember  │        │         Schedule       │
        │               │        │                       │
        │  Id: Guid     │        │  Id: Guid            │
        │  Role: Role   │        │  AssignedChildId: Guid│◄──┐
        │  DisplayMode: │        │  ...                 │   │
        │  DisplayMode  │        │                       │   │
        └──────┬────────┘        └───────────┬───────────┘   │
               │ 0..N                      │ 1             │   │
               │                           │               │   │
               │                           └───────────────┼───┘
               │                               AssignedChildId │
               └─────────────────────────────────────────────┘

Notes:
- DisplayMode 已在 FamilyMember 存在，默认 Primary
- Schedule.AssignedChildId 关联到 FamilyMember.UserId（孩子用户 ID）
- 权限检查：孩子只能访问 AssignedChildId == 自己UserId 的日程
```

#### 关系基数

- `Family` 1 — * `FamilyMember`：一个家庭有多个成员
- `FamilyMember`（孩子角色）0..N — * `Schedule`：一个孩子有多个日程
- `DisplayMode` 是 `FamilyMember` 的属性，不是独立实体

#### API 契约

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `api/v1/child/schedule/today` | GET | 获取孩子今日日程列表 | 需要 JWT + X-Family-Id |
| `api/v1/child/schedule/week` | GET | 获取孩子本周日程概览 | 需要 JWT + X-Family-Id |
| `api/v1/child/schedule/month` | GET | 获取孩子本月日程概览 | 需要 JWT + X-Family-Id |
| `api/v1/child/schedule/{id}` | GET | 获取单个日程详情（只读） | 需要 JWT + X-Family-Id |
| `api/v1/child/stats/weekly-completion` | GET | 获取本周完成率统计 | 需要 JWT + X-Family-Id |

**权限规则：**
- 所有孩子端端点要求用户角色为 `Child`
- 自动过滤仅返回 `AssignedChildId == CurrentUserId` 的日程
- 尝试访问他人日程返回 `CHILD_ACCESS_DENIED` (403)

#### 新增/修改 DTO

```csharp
// ChildScheduleListResponse
{
  items: ScheduleInfo[]  // 复用现有 ScheduleInfo 结构
  completedCount: int    // 今日已完成
  totalCount: int        // 今日总共有
  completionPercentage: double // 0-100
}

// ChildWeeklyCompletionResponse
{
  percentage: double    // 完成率 0-100
  completed: int        // 已完成数
  total: int            // 总日程数
}
```

#### 错误码（新增到 family  contracts）

| 错误码 | HTTP 状态 | 消息 |
|--------|----------|------|
| `CHILD_ACCESS_DENIED` | 403 | 你只能查看自己的日程 |

#### 数据访问策略

- 复用现有 `AppDbContext` 和 `DbSet<Schedule>`
- 所有查询使用 `.AsNoTracking()`（孩子端只读）
- 无需新增仓储接口，复用现有 `IScheduleQueryService` 模式

---

### 前端架构（微信小程序）

#### 页面结构（新增）

```
app/pages/
├── child-today/           —— 孩子今日视图（小学模式）
│   ├── index.js
│   ├── index.wxml
│   ├── index.wxss
│   └── index.json
├── child-week/            —— 孩子周视图
│   ├── ...
├── child-month/           —— 孩子月视图
│   ├── ...
└── child-mine/            —— 孩子我的页面
    ├── ...
```

#### 服务层（新增）

```
app/services/
└── child-schedule.js      —— NEW: 封装孩子端所有 API 调用
```

#### 路由与 TabBar

- 孩子用户登录后默认进入 `child-today` 页面
- TabBar 保留四个 tab：今日 / 周 / 月 / 我的（对应孩子端四页面）
- 家长用户仍使用原有家长端页面

#### 状态管理

- displayMode 从 JWT token 解码后存入 `app/globalData`
- 每个孩子页面 onLoad 时读取 globalData.displayMode 确认模式
- 模式变更在孩子下次进入或切换页面时自动生效（符合需求）

#### UI 设计要点（小学模式）

- **今日视图**：时间线列表，每项显示：类型图标 + 名称 + 具体时间 + 打卡按钮 + 状态图标
- 顶部显示进度：`已完成 X/Y`
- 所有日程只读，无编辑/删除按钮
- **打卡交互**：点击打卡按钮直接打卡，无需弹窗确认；点击已打卡项可撤销
- **周/月视图**：与家长端布局相似，但只读不可点击编辑
- **我的页面**：仅显示孩子姓名 + 本周完成率进度条

---

### 契约文件（openspec/contracts）

DisplayMode 枚举已存在于 `openspec/contracts/family/enums.json`，无需修改。

新增错误码 `CHILD_ACCESS_DENIED` 到 `openspec/contracts/family/errors.json`。

DTO 新增孩子端响应 DTO 到 `openspec/contracts/family/dto.json`。

---

## 核心时序图

### 正常路径：孩子登录并查看今日日程

```
孩子打开小程序
  → wx.login → code 发给后端
  → 后端认证 → 查找 FamilyMember → 读取 DisplayMode
  → 生成 JWT → 包含 displayMode claim
  → 前端存储 token → 解码 displayMode 到 globalData
  → 前端跳转 child-today 页面
  → 前端调用 GET /api/v1/child/schedule/today
  → 后端权限验证（角色==Child）→ 过滤 AssignedChildId == userId
  → 返回今日日程列表 + 完成统计
  → 前端渲染只读列表
```

### 异常分支：孩子尝试访问他人日程

```
孩子调用 GET /api/v1/child/schedule/{id}
  → 后端查找 Schedule → AssignedChildId != 当前 userId
  → 返回 403 + CHILD_ACCESS_DENIED
  → 前端显示错误消息"你只能查看自己的日程"
```

### 异常分支：网络断开

```
孩子进入 child-today 页面
  → 前端发起请求 → 超时/网络错误
  → 前端显示标准错误提示"网络连接失败，请检查网络设置"
  → 提供重试按钮
```

### 模式切换生效

```
家长在孩子设置中将模式从 Primary 改为 Preschool
  → 孩子正在使用小程序，当前在 child-today 页面
  → 孩子切换到 child-week 页面
  → onShow 触发 → 从 JWT 读取新的 displayMode（token 在重新登录后更新）
  → 页面以新模式渲染（二期实现差异化）
```

Notes: JWT 刷新发生在下次登录或 token 刷新时，所以模式变更不会立即在当前页面生效——符合需求"下次进入或切换页面时生效"。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 孩子端页面与家长端代码重复 | 维护成本略有增加 | 共享工具函数和类型图标组件，仅页面布局分离 |
| JWT 增大 | 可忽略 | displayMode 只增加十几个字符 |
| 未来多模式切换增加复杂度 | 可接受 | 当前架构通过 displayMode 开关已经支持，二期只需要新增对应页面组件 |

## Migration Plan

- 数据库：无迁移需要（DisplayMode 字段已存在）
- 后端：新增控制器、服务方法，无破坏性变更
- 前端：新增页面，不修改现有页面
- 回滚：删除新增控制器/页面即可，不影响现有功能

## Open Questions

- 无——所有设计决策已明确，需求分期清晰
