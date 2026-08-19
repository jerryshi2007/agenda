# Proposal: 模板系统模块（add-template-module）

## Why

家长在创建日程时存在大量重复录入（课后班、日常作息、作业等类型每天/每周重复），需要"模板"机制来沉淀"内容骨架"（名称、类型、时间槽、重复规则、备注），使用时只指定关联孩子和生效起始日期，一键生成日程。该需求已通过 `production/staging/2026-08-19-模板系统/` 完成需求评审（dev-ready 状态），与现有日程管理（add-event-module / add-display-mode-module）、家庭管理（add-family-module）能力正交但耦合——模板与日程共享类型字段（ScheduleType）、时间槽结构（TimeSlot），通过"生成时复制"实现松耦合。

## What Changes

- **新增模板实体**：独立 `Templates` 表 + `TemplateTimeSlots` 子表，复用 ScheduleType/TimeSlot 字段语义
- **新增模板 CRUD API**：`/api/v1/templates/*` 路由，列表/详情/创建/更新/删除 5 个端点
- **新增"从模板生成日程" API**：`POST /api/v1/templates/{id}/apply`，内部组合 `IScheduleService.CreateAsync` 实现（DRY，参考 Checkin 复用 IScheduleQueryService 模式）
- **新增模板种子数据**：3 个系统预设模板（课后班/日常作息/作业），应用启动时幂等插入
- **新增前端模板管理页面**：列表页（预设/自定义分区 + 搜索）、详情/编辑页、使用模板弹窗
- **小程序新增"从模板创建日程"入口**：在 `pages/schedule-create/` 顶部加模板选择入口
- **小程序新增"从日程保存为模板"入口**：在 `pages/schedule-detail/` 操作菜单加"保存为模板"按钮
- **新增契约文件**：`openspec/contracts/template/{enums,errors,dto}.json`（ScheduleType 枚举值复用现有契约）

## Capabilities

### New Capabilities

- `template-crud`: 模板实体的 CRUD 能力——创建、读取（单条 + 列表 + 搜索）、更新、删除、预设模板只读、权限隔离（家庭级）
- `template-application`: 从模板一键生成日程的能力——预填字段、选择孩子、选择起始日期，调用生成接口
- `template-preset`: 系统预设模板管理——3 个系统模板的种子数据、不可编辑/不可删除标识、可见性规则

### Modified Capabilities

（无。模板系统是新增模块，未改变现有 capability 的需求语义。日程管理 capability 仅在"创建日程"端增加"从模板创建"前端入口，但 API 契约未变。）

## Impact

**受影响代码路径**：

| 路径 | 变更类型 | 说明 |
|------|---------|------|
| `api/Domain/Entities/` | 新建 | `Template.cs` + `TemplateTimeSlot.cs` |
| `api/Template/` | 新建 | 模块目录（Controllers/Services/Dtos/Validators） |
| `api/Infrastructure/Data/AppDbContext.cs` | 扩展 | 新增 `DbSet<Template>` + `DbSet<TemplateTimeSlot>` |
| `api/Infrastructure/Data/Configurations/` | 新建 | `TemplateConfiguration.cs` + `TemplateTimeSlotConfiguration.cs` |
| `api/Infrastructure/ErrorCodes.cs` | 扩展 | 新增 Template 模块错误码常量 |
| `api/Migrations/` | 新建 | `AddTemplateModule` 迁移 + 种子数据 |
| `api/Program.cs` | 扩展 | DI 注册 + HostedService 种子数据初始化 |
| `app/pages/template-list/` | 新建 | 模板管理列表页 |
| `app/pages/template-edit/` | 新建 | 模板详情/编辑页 |
| `app/components/use-template-dialog/` | 新建 | 使用模板弹窗组件 |
| `app/services/template.js` | 新建 | 模板 API 封装 |
| `app/contracts/template.js` | 新建 | 模板契约镜像 |
| `app/pages/schedule-create/index.{js,wxml}` | 扩展 | 顶部加"从模板创建"入口 |
| `app/pages/schedule-detail/index.{js,wxml}` | 扩展 | 加"保存为模板"按钮 |
| `app/components/schedule-form/` | 新建 | 抽取日程/模板共用表单组件（DRY） |
| `openspec/contracts/template/` | 新建 | enums.json / errors.json / dto.json |

**API 端点新增**：

- `GET /api/v1/templates?keyword=&scheduleType=&preset=` — 列表（分页 + 搜索 + 类型筛选 + 预设/自定义筛选）
- `GET /api/v1/templates/{id}` — 详情
- `POST /api/v1/templates` — 创建自定义模板
- `PUT /api/v1/templates/{id}` — 更新模板（仅自定义模板，仅创建者可改）
- `DELETE /api/v1/templates/{id}` — 删除模板（仅自定义模板，仅创建者可删）
- `POST /api/v1/templates/{id}/apply` — 从模板生成日程（请求：childId + startDate + 可选字段覆盖）

**性能影响**：

- 模板列表加载 ≤ 500ms（家庭级数据量小，加索引即达标）
- 从模板生成日程响应 ≤ 1s（单事务，包含 N 个孩子的展开，与 Schedule.CreateAsync 性能基线一致）

**安全影响**：

- 家庭级数据隔离：`Templates.FamilyId`（自定义模板）或 `Templates.IsPreset=true`（预设）
- 孩子角色权限：所有模板端点显式校验 `UserRole.Parent`，与日程管理一致
- 创建者权限：自定义模板的 Update/Delete 校验 `CreatedBy == currentUserId`
