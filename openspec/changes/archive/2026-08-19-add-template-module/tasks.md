# Tasks: 模板系统模块

> 日期：2026-08-19
> 总 task 数：35（按 9 梯队分组）
> 上游：design.md（add-template-module）
> 下游执行：dev-dotnet / dev-miniapp
>
> 进度：dev-dotnet 任务 0.3/0.4/1.1-1.5/2.1-2.7/3.1-3.2/4.1-4.2/8.1 ✅ 完成（2026-08-19）；dev-miniapp 任务待启动

---

## Task 依赖关系图

```
[第 0 梯队：基础设施]
  Task 0.1 契约 JSON                              ← 无依赖
  Task 0.2 契约镜像 (app/contracts/template.js)   ← 依赖 0.1
  Task 0.3 Schedule 实体扩展字段定义              ← 无依赖（仅加属性）
  Task 0.4 EF Migration AddTemplateModule          ← 依赖 1.1, 1.2, 0.3

[第 1 梯队：后端数据层]
  Task 1.1 Template 实体                          ← 依赖 0.1 (dto 字段名)
  Task 1.2 TemplateTimeSlot 实体                  ← 无依赖
  Task 1.3 TemplateConfiguration                  ← 依赖 1.1
  Task 1.4 TemplateTimeSlotConfiguration          ← 依赖 1.2
  Task 1.5 AppDbContext 扩展 + Schedule 索引      ← 依赖 1.1, 1.2

[第 2 梯队：后端服务层]
  Task 2.1 ErrorCodes 新增 Template 常量          ← 依赖 0.1
  Task 2.2 DTOs 全部 (10 个 record)               ← 依赖 0.1
  Task 2.3 CreateTemplateRequestValidator         ← 依赖 2.2
  Task 2.4 UpdateTemplateRequestValidator         ← 依赖 2.2
  Task 2.5 ApplyTemplateRequestValidator          ← 依赖 2.2
  Task 2.6 ITemplateService + TemplateService     ← 依赖 1.3, 1.4, 1.5, 2.1, 2.2
  Task 2.7 ScheduleService.CreateAsync 接受 SourceTemplateId  ← 依赖 0.3, 1.5

[第 3 梯队：后端 API 层]
  Task 3.1 TemplateController                     ← 依赖 2.3, 2.4, 2.5, 2.6
  Task 3.2 Program.cs DI 注册                     ← 依赖 3.1, 2.6

[第 4 梯队：种子数据]
  Task 4.1 TemplateSeedHostedService              ← 依赖 1.5, 2.6
  Task 4.2 Program.cs 注册 HostedService          ← 依赖 4.1

[第 5 梯队：前端契约 + service]
  Task 5.1 app/services/template.js               ← 依赖 0.1
  Task 5.2 app/contracts/template.js parity 测试  ← 依赖 0.1, 0.2

[第 6 梯队：前端 schedule-form 抽取]
  Task 6.1 schedule-form 组件（4 mode）            ← 无依赖
  Task 6.2 schedule-create 重构使用 schedule-form  ← 依赖 6.1
  Task 6.3 schedule-edit 重构使用 schedule-form   ← 依赖 6.1

[第 7 梯队：前端页面]
  Task 7.1 components/use-template-dialog         ← 依赖 5.1
  Task 7.2 pages/template-list                    ← 依赖 5.1, 7.1
  Task 7.3 pages/template-detail (查看+编辑+删除) ← 依赖 5.1
  Task 7.4 pages/template-create (从零)            ← 依赖 6.1
  Task 7.5 schedule-detail 加"保存为模板"按钮     ← 依赖 5.1
  Task 7.6 schedule-create 顶部加"从模板创建"入口  ← 依赖 7.1

[第 8 梯队：E2E 联调]
  Task 8.1 后端单元测试 + 集成测试                ← 依赖 3.2
  Task 8.2 前端 schedule-form 回归                ← 依赖 6.2, 6.3
  Task 8.3 全链路 E2E 冒烟                        ← 依赖 7.x 全部, 4.2
```

---

## Task 列表

### 第 0 梯队：基础设施

#### Task 0.1: 契约 JSON（enums/errors/dto）

- **负责 agent**：`arch-architect`（本次交付）
- **依赖**：无
- **产出文件**：
  - `openspec/contracts/template/enums.json`
  - `openspec/contracts/template/errors.json`
  - `openspec/contracts/template/dto.json`
- **完成标准**：
  1. 3 个 JSON 文件已写入（已交付）
  2. 字段命名与 `app/contracts/template.js` 镜像一致
- **验证命令**：`cat openspec/contracts/template/dto.json | jq .`

#### Task 0.2: app 端契约镜像

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 0.1
- **产出文件**：
  - `app/contracts/template.js` —— 派生自 `openspec/contracts/template/*.json`，导出 `TemplateSource`、`ErrorCodes`、`ErrorMessages`、`HttpStatus`
- **完成标准**：
  1. `app/contracts/template.js` 与 `openspec/contracts/template/*.json` 字段一一对应
  2. 所有错误码、枚举值从 JSON 镜像导出，无手写字面量
- **验证命令**：`cd app && node -e "require('./contracts/template.js')"`

#### Task 0.3: Schedule 实体扩展 SourceTemplateId

- **负责 agent**：`dev-dotnet`
- **依赖**：无
- **输入**：`openspec/changes/add-template-module/design.md` §Decision 6
- **产出文件**：
  - `api/Domain/Entities/Schedule.cs`（修改：新增 `public Guid? SourceTemplateId { get; set; }`）
- **完成标准**：
  1. `Schedule` 类新增 `SourceTemplateId` 可空 Guid 属性
  2. 现有测试通过（`dotnet test api/Schedule/`）
- **验证命令**：`dotnet build api/Agenda.Api.csproj && dotnet test api/ --filter "FullyQualifiedName~ScheduleService"`

#### Task 0.4: EF Migration AddTemplateModule

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1.1, 1.2, 0.3
- **输入**：`design.md` §Decision 2 ER 图
- **产出文件**：
  - `api/Migrations/YYYYMMDDHHMMSS_AddTemplateModule.cs`（YYYYMMDDHHMMSS = 实际生成时间）
  - `api/Migrations/YYYYMMDDHHMMSS_AddTemplateModule.Designer.cs`
- **完成标准**：
  1. Migration 包含：`CREATE TABLE Templates`（13 列）、`CREATE TABLE TemplateTimeSlots`（4 列 + 唯一索引）、`ALTER TABLE Schedules ADD SourceTemplateId UUID NULL` + 索引
  2. Migration Down 方法正确回滚
  3. `dotnet ef database update` 在开发库成功执行
- **验证命令**：
  ```bash
  dotnet ef migrations add AddTemplateModule --project api/ --startup-project api/
  dotnet ef database update --project api/ --startup-project api/
  dotnet build api/Agenda.Api.csproj
  ```

---

### 第 1 梯队：后端数据层

#### Task 1.1: Template 实体

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 0.1
- **输入**：`design.md` §Decision 2 ER 图 + `openspec/contracts/template/dto.json`
- **产出文件**：
  - `api/Domain/Entities/Template.cs`
- **完成标准**：
  1. 13 个属性全部定义（Id, Name, ScheduleType, IsPreset, FamilyId, CreatedBy, RepeatEndDate, Location, Notes, IsDeleted, CreatedAt, UpdatedAt）
  2. 导航属性 `TimeSlots: ICollection<TemplateTimeSlot>` 初始化为空 List
  3. 命名空间 `Agenda.Api.Domain.Entities`
  4. **不写任何 EF Core 特性**（Configuration 单独定义，遵循现有模式）
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 1.2: TemplateTimeSlot 实体

- **负责 agent**：`dev-dotnet`
- **依赖**：无
- **产出文件**：
  - `api/Domain/Entities/TemplateTimeSlot.cs`
- **完成标准**：
  1. 4 个属性：Id, TemplateId, DayOfWeek, StartTime, EndTime
  2. 导航属性 `Template: Template`（nullable，启用延迟加载兼容性）
  3. 命名空间 `Agenda.Api.Domain.Entities`
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 1.3: TemplateConfiguration

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1.1
- **输入**：`design.md` §Decision 2 约束
- **产出文件**：
  - `api/Infrastructure/Data/Configurations/TemplateConfiguration.cs`
- **完成标准**：
  1. 实现 `IEntityTypeConfiguration<Template>`，命名空间 `Agenda.Api.Infrastructure.Data.Configurations`
  2. Name: `IsRequired().HasMaxLength(50)`
  3. ScheduleType: `IsRequired().HasConversion<int>()`
  4. FamilyId: `IsRequired(false)`
  5. IsPreset: `IsRequired().HasDefaultValue(false)`
  6. IsDeleted: `IsRequired().HasDefaultValue(false)`
  7. 索引：
     - `HasIndex(t => t.FamilyId)`
     - `HasIndex(t => t.CreatedBy)`
     - `HasIndex(t => t.IsPreset)`
     - 过滤索引：`HasIndex(t => new { t.FamilyId, t.Name }).IsUnique().HasFilter("\"IsPreset\" = false AND \"IsDeleted\" = false")`
  8. 关系：`HasMany(t => t.TimeSlots).WithOne(ts => ts.Template).HasForeignKey(ts => ts.TemplateId).OnDelete(DeleteBehavior.Cascade)`
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 1.4: TemplateTimeSlotConfiguration

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1.2
- **产出文件**：
  - `api/Infrastructure/Data/Configurations/TemplateTimeSlotConfiguration.cs`
- **完成标准**：
  1. 实现 `IEntityTypeConfiguration<TemplateTimeSlot>`
  2. TemplateId: `IsRequired()`
  3. DayOfWeek: `IsRequired().HasConversion<int>()`
  4. StartTime/EndTime: `IsRequired()`
  5. 索引：`HasIndex(ts => new { ts.TemplateId, ts.DayOfWeek }).IsUnique()`
  6. 索引：`HasIndex(ts => ts.TemplateId)`
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 1.5: AppDbContext 扩展 + Schedule 索引

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1.1, 1.2
- **产出文件**：
  - `api/Infrastructure/Data/AppDbContext.cs`（修改：新增 2 个 DbSet）
  - `api/Infrastructure/Data/Configurations/ScheduleConfiguration.cs`（修改：新增 SourceTemplateId 索引）
- **完成标准**：
  1. `AppDbContext` 新增 `public DbSet<Template> Templates => Set<Template>();` 和 `DbSet<TemplateTimeSlot> TemplateTimeSlots => Set<TemplateTimeSlot>();`
  2. `ScheduleConfiguration` 新增 `builder.HasIndex(e => e.SourceTemplateId);`
  3. `dotnet build` 成功
- **验证命令**：
  ```bash
  dotnet build api/Agenda.Api.csproj
  dotnet ef migrations add AddSourceTemplateIdIndex --project api/ --startup-project api/  # 仅在需要时
  ```

---

### 第 2 梯队：后端服务层

#### Task 2.1: ErrorCodes 新增 Template 常量

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 0.1
- **产出文件**：
  - `api/Infrastructure/ErrorCodes.cs`（修改：新增 14 个 Template 常量）
- **完成标准**：
  1. 按 `openspec/contracts/template/errors.json` 顺序新增常量：`TemplateNameEmpty`、`TemplateNameTooLong`、`TemplateNotesTooLong`、`TemplateLocationTooLong`、`TemplateTimeslotInvalid`、`TemplateTimeslotRequired`、`TemplateTimeslotTimeInvalid`、`TemplateDuplicateName`、`TemplateNotFound`、`TemplatePresetReadonly`、`TemplateNotOwner`、`ChildAccessDenied`（注：与 Checkin 共享，引用即可）、`ChildNotInFamily`、`StartDateInvalid`、`TemplateTypeInvalid`
  2. 与契约文件字面量完全一致
  3. 现有 `ErrorCodes` 测试通过
- **验证命令**：`dotnet build api/Agenda.Api.csproj && dotnet test api/ --filter "FullyQualifiedName~ErrorCodes"`

#### Task 2.2: DTOs 全部

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 0.1
- **产出文件**：
  - `api/Template/Dtos/TemplateTimeSlotDto.cs`
  - `api/Template/Dtos/TemplateSummary.cs`
  - `api/Template/Dtos/TemplateDetail.cs`
  - `api/Template/Dtos/CreateTemplateRequest.cs`
  - `api/Template/Dtos/UpdateTemplateRequest.cs`
  - `api/Template/Dtos/ApplyTemplateRequest.cs`
  - `api/Template/Dtos/ListTemplatesResponse.cs`
  - `api/Template/Dtos/DeleteTemplateResponse.cs`
- **完成标准**：
  1. 8 个 record 文件全部按 `openspec/contracts/template/dto.json` 字段定义
  2. 命名空间 `Agenda.Api.Template.Dtos`
  3. `TemplateDetail` 包含 `UsageCount` 字段（int）
  4. `ApplyTemplateRequest` 的覆盖字段均为 nullable
  5. `ListTemplatesResponse` 包含 `Items`、`TotalCount`、`Page`、`PageSize`
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 2.3: CreateTemplateRequestValidator

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 2.2
- **产出文件**：
  - `api/Template/Validators/CreateTemplateRequestValidator.cs`
- **完成标准**：
  1. 使用 FluentValidation，命名空间 `Agenda.Api.Template.Validators`
  2. Name: `NotEmpty()` + `MaximumLength(50)`，错误码用 `ErrorCodes.TemplateNameEmpty` / `TemplateNameTooLong`
  3. ScheduleType: `Must(BeValidScheduleType)`（枚举名检查）
  4. TimeSlots:
     - `Must(HaveTimeSlotsForNonHomework)`：当 ScheduleType != HomeworkTask 时 `Count >= 1`
     - `Must(HaveNoTimeSlotsForHomework)`：当 ScheduleType == HomeworkTask 时 `Count == 0`
     - 错误码：`TemplateTimeslotRequired` / `TemplateTimeslotInvalid`
  5. Location: `MaximumLength(100)` 错误码 `TemplateLocationTooLong`
  6. Notes: `MaximumLength(500)` 错误码 `TemplateNotesTooLong`
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 2.4: UpdateTemplateRequestValidator

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 2.2
- **产出文件**：
  - `api/Template/Validators/UpdateTemplateRequestValidator.cs`
- **完成标准**：
  1. 字段约束与 CreateTemplateRequest 类似（Name/Location/Notes 长度）
  2. TimeSlots 在 Update 中**必须提供**（可能为 HomeworkTask 的空数组）
  3. 不校验 scheduleType（UpdateTemplateRequest 不含此字段）
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 2.5: ApplyTemplateRequestValidator

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 2.2
- **产出文件**：
  - `api/Template/Validators/ApplyTemplateRequestValidator.cs`
- **完成标准**：
  1. ChildId: `NotEqual(Guid.Empty)`
  2. StartDate: `GreaterThanOrEqualTo(DateOnly.FromDateTime(DateTime.Today))`，错误码 `StartDateInvalid`
  3. 覆盖字段 Name/Location/Notes 的可选长度校验
  4. TimeSlots（若提供）：每项 StartTime < EndTime，错误码 `TemplateTimeslotTimeInvalid`
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 2.6: ITemplateService + TemplateService

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1.3, 1.4, 1.5, 2.1, 2.2
- **输入**：`design.md` §Decision 3
- **产出文件**：
  - `api/Template/Services/ITemplateService.cs`
  - `api/Template/Services/TemplateService.cs`
- **完成标准**：
  1. ITemplateService 接口方法（7 个）：
     ```csharp
     Task<ListTemplatesResponse> ListAsync(Guid familyId, string? keyword, ScheduleType? type, bool? isPreset, int page, int pageSize, CancellationToken ct);
     Task<TemplateDetail?> GetByIdAsync(Guid templateId, Guid familyId, CancellationToken ct);
     Task<TemplateDetail> CreateAsync(Guid familyId, Guid userId, CreateTemplateRequest req, CancellationToken ct);
     Task<TemplateDetail> UpdateAsync(Guid templateId, Guid userId, UpdateTemplateRequest req, CancellationToken ct);
     Task DeleteAsync(Guid templateId, Guid userId, CancellationToken ct);
     Task<CreateScheduleResponse> ApplyAsync(Guid templateId, Guid familyId, Guid userId, ApplyTemplateRequest req, CancellationToken ct);
     ```
  2. TemplateService 实现：
     - 依赖 `AppDbContext`、`IScheduleService`、`ILogger<TemplateService>`
     - 所有查询走 `_db.Templates.AsNoTracking()`，过滤 `IsDeleted=false`
     - 创建/更新：事务包裹 `Templates` + `TemplateTimeSlots`
     - Update：先校验 `IsPreset=false` + `CreatedBy=userId` + `IsDeleted=false`，否则抛 `DomainException(TemplatePresetReadonly)` / `TemplateNotOwner`
     - Delete：软删除（`IsDeleted=true`），同 Update 权限校验
     - GetById 跨家庭隔离：`(t.IsPreset || t.FamilyId == familyId) && !t.IsDeleted`
     - ApplyAsync：
       1. GetByIdAsync 拿 Template（已含权限校验）
       2. 验证 `childId` 是当前家庭成员（`_db.FamilyMembers.Any(fm => fm.UserId == childId && fm.FamilyId == familyId && fm.Role == UserRole.Child)`）
       3. 合并覆盖字段：构造 `CreateScheduleRequest { Name=req.Name ?? template.Name, ScheduleType=template.ScheduleType.ToString(), ChildIds=new(){req.ChildId}, TimeSlots=req.TimeSlots ?? template.TimeSlots.Select(...).ToList(), RepeatEndDate=req.RepeatEndDate ?? template.RepeatEndDate, Location=req.Location ?? template.Location, Notes=req.Notes ?? template.Notes, SourceTemplateId=templateId }`
       4. 调用 `_scheduleService.CreateAsync(familyId, userId, merged, ct)`，返回结果
     - ListAsync 排序：`(t.IsPreset ? 0 : 1), t.CreatedAt DESC`
  3. **usageCount 统计**：在 GetByIdAsync 中通过 `_db.Schedules.CountAsync(s => s.SourceTemplateId == templateId && !s.IsDeleted)` 填充
  4. 抛 DomainException 携带契约错误码
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 2.7: ScheduleService.CreateAsync 接受 SourceTemplateId

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 0.3, 1.5
- **产出文件**：
  - `api/Schedule/Dtos/CreateScheduleRequest.cs`（修改：新增 `Guid? SourceTemplateId` 字段）
  - `api/Schedule/Services/ScheduleService.cs`（修改：在构造 Schedule 实体时设置 `SourceTemplateId = request.SourceTemplateId`）
- **完成标准**：
  1. `CreateScheduleRequest` 新增 `public Guid? SourceTemplateId { get; init; }`（默认 null）
  2. `ScheduleService.CreateAsync` 在 `new Domain.Entities.Schedule { ... }` 块中新增 `SourceTemplateId = request.SourceTemplateId`
  3. 现有 CreateScheduleRequest 测试通过（不传 SourceTemplateId 时为 null）
  4. `dotnet test api/Schedule/` 全部通过
- **验证命令**：
  ```bash
  dotnet build api/Agenda.Api.csproj
  dotnet test api/ --filter "FullyQualifiedName~ScheduleService"
  ```

---

### 第 3 梯队：后端 API 层

#### Task 3.1: TemplateController

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 2.3, 2.4, 2.5, 2.6
- **产出文件**：
  - `api/Template/Controllers/TemplateController.cs`
- **完成标准**：
  1. 命名空间 `Agenda.Api.Template.Controllers`
  2. `[ApiController] [Route("api/v1/templates")] [Authorize]`
  3. 6 个端点：
     - `GET /` → List（query: keyword, scheduleType, isPreset, page, pageSize）→ 调 `_templateService.ListAsync(familyId, ...)`
     - `GET /{id}` → GetById → 调 `_templateService.GetByIdAsync(id, familyId)`，null 返回 404 `TEMPLATE_NOT_FOUND`
     - `POST /` → Create（body: CreateTemplateRequest）→ FluentValidation + 调 service
     - `PUT /{id}` → Update（body: UpdateTemplateRequest）→ FluentValidation + 调 service
     - `DELETE /{id}` → Delete → 调 service
     - `POST /{id}/apply` → Apply（body: ApplyTemplateRequest）→ FluentValidation + 调 service
  4. 所有 action 开头校验 `role != UserRole.Parent` → `ForbidJwt("CHILD_ACCESS_DENIED", "孩子角色不能访问模板")`
  5. 通过 `_familyContext.GetFamilyContextAsync(User.GetUserId(), ct)` 获取 familyId
  6. DomainException 由全局中间件映射
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

#### Task 3.2: Program.cs DI 注册

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 3.1, 2.6
- **产出文件**：
  - `api/Program.cs`（修改：在 ServiceCollection 注册块新增 3 行）
- **完成标准**：
  1. 注册 `ITemplateService` → `TemplateService`（Scoped）
  2. 注册 3 个 Validators（Scoped）
  3. 注册 `TemplateSeedHostedService`（`AddHostedService`）——**实际见 Task 4.2**
  4. 现有 API 启动不报错
- **验证命令**：
  ```bash
  dotnet build api/Agenda.Api.csproj
  dotnet run --project api/Agenda.Api.csproj  # 应能正常监听端口
  curl http://localhost:5000/api/v1/templates  # 应返回 401（未认证）
  ```

---

### 第 4 梯队：种子数据

#### Task 4.1: TemplateSeedHostedService

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1.5, 2.6
- **产出文件**：
  - `api/Template/Services/TemplateSeedHostedService.cs`
- **完成标准**：
  1. 实现 `IHostedService.StartAsync(CancellationToken)`，命名空间 `Agenda.Api.Template.Services`
  2. 注入 `IServiceProvider`（Scoped DbContext 需创建 scope）
  3. StartAsync 流程：
     - 创建 scope
     - 取 `AppDbContext` 和 `ILogger<TemplateSeedHostedService>`
     - 查 `_db.Templates.CountAsync(t => t.IsPreset)`
     - 若 < 3：循环 3 个预设定义（AfterSchoolClass / DailyRoutine / Homework），按 `(Name, ScheduleType)` 幂等检查，缺失则 `_db.Templates.Add(...)` + TimeSlots
     - `_db.SaveChangesAsync()`
     - catch 所有异常 + `_logger.LogError(ex, "模板种子失败")` + 不抛（不让应用启动失败）
  4. 3 个预设定义见 `design.md` §Decision 4
- **验证命令**：
  ```bash
  dotnet build api/Agenda.Api.csproj
  # 启动应用后查 DB：
  # SELECT * FROM "Templates" WHERE "IsPreset" = true;  -- 应有 3 条
  ```

#### Task 4.2: Program.cs 注册 HostedService

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 4.1
- **产出文件**：
  - `api/Program.cs`（修改：新增 `builder.Services.AddHostedService<TemplateSeedHostedService>();`）
- **完成标准**：
  1. DI 注册语句在 Validators 之后
  2. 启动应用：日志可见 "模板种子完成：插入 N 条" 或 "模板种子已存在，跳过"
- **验证命令**：
  ```bash
  dotnet run --project api/Agenda.Api.csproj
  # 观察启动日志
  # 访问 GET /api/v1/templates 验证有 3 条 IsPreset=true
  ```

---

### 第 5 梯队：前端契约 + service

#### Task 5.1: app/services/template.js

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 0.1
- **产出文件**：
  - `app/services/template.js`
- **完成标准**：
  1. 7 个函数：`list(keyword, scheduleType, isPreset, page, pageSize)`、`getById(id)`、`create(data)`、`update(id, data)`、`remove(id)`、`apply(id, data)`
  2. 全部走 `require('./api').{get,post,put,del}` 封装
  3. URL 前缀 `/api/v1/templates`
  4. **不写错误码字符串字面量**，所有错误处理通过 `app/contracts/template.js` 的 `ErrorMessages` 显示
- **验证命令**：`cd app && node -e "const s = require('./services/template.js'); console.log(Object.keys(s))"`

#### Task 5.2: app/contracts/template.js parity 测试

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 0.1, 0.2
- **产出文件**：
  - `app/__tests__/contracts/template.test.js`
- **完成标准**：
  1. 引用 `require('../../openspec/contracts/template/enums.json')` / errors.json / dto.json（用 fs.readFileSync 读 JSON）
  2. 测试：app/contracts/template.js 导出的 ErrorCodes 键集合 === errors.json 键集合
  3. 测试：ErrorMessages 消息值 === errors.json 消息值
  4. 测试：dto.json 中 ScheduleType 引用对应 enums.json 的 ScheduleType 枚举值集合
  5. 失败时给出 diff 信息
- **验证命令**：`cd app && npx jest __tests__/contracts/template.test.js`

---

### 第 6 梯队：前端 schedule-form 抽取

#### Task 6.1: schedule-form 组件

- **负责 agent**：`dev-miniapp`
- **依赖**：无
- **输入**：`design.md` §Decision 8
- **产出文件**：
  - `app/components/schedule-form/index.js`
  - `app/components/schedule-form/index.wxml`
  - `app/components/schedule-form/index.wxss`
  - `app/components/schedule-form/index.json`
- **完成标准**：
  1. 组件 props（input `properties`）：
     - `mode`: String, 值 'create' | 'edit' | 'template-create' | 'template-edit'
     - `initialValues`: Object, 字段同 CreateScheduleRequest / CreateTemplateRequest
     - `childSelectorVisible`: Boolean, 默认 true（template 模式传 false）
     - `startDateVisible`: Boolean, 默认 true（template 模式传 false）
     - `scheduleTypeLocked`: Boolean, 默认 false（template-edit 模式传 true）
     - `onSubmit`: event, 提交时触发 `detail = {formData, valid}`
  2. 内部 data：所有表单字段 + 校验状态
  3. 校验逻辑（前端兜底）：
     - Name: 必填，1-50 字符
     - ScheduleType: 必选
     - TimeSlots: 根据 scheduleType 动态校验
     - ChildIds: childSelectorVisible=true 时必选且 ≥ 1
     - StartDate: startDateVisible=true 时必选
  4. 所有可交互元素加 `data-id`，遵循 `dev-miniapp-standards` 规范
  5. 复用 `app/components/time-slot-picker`
- **验证命令**：`cd app && npx miniprogram-simulate --component app/components/schedule-form/`（如有此工具），否则手动 `wx:for` 渲染验证

#### Task 6.2: schedule-create 重构使用 schedule-form

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6.1
- **产出文件**：
  - `app/pages/schedule-create/index.wxml`（修改：用 `<schedule-form>` 替代内联表单）
  - `app/pages/schedule-create/index.js`（修改：移除表单状态，绑定 onSubmit → scheduleService.create）
- **完成标准**：
  1. `index.wxml` 中表单部分替换为 `<schedule-form mode="create" bind:submit="onFormSubmit" />`
  2. `onFormSubmit(e)` 处理 `e.detail.formData`，调用 `scheduleService.create(formData)`，成功后 `wx.redirectTo` 详情页
  3. 顶部新增"从模板创建"入口（独立 task 7.6 处理）——本 task 不实现
  4. 现有 139/140 个 E2E 用例中创建日程相关的不回归
- **验证命令**：`cd testing/e2e && npx playwright test --grep "创建日程"`

#### Task 6.3: schedule-edit 重构使用 schedule-form

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6.1
- **产出文件**：
  - `app/pages/schedule-edit/index.wxml`（修改：用 `<schedule-form mode="edit">`）
  - `app/pages/schedule-edit/index.js`（修改：移除表单状态，绑定 onSubmit → scheduleService.update）
- **完成标准**：
  1. `index.wxml` 中表单部分替换为 `<schedule-form mode="edit" initial-values="{{schedule}}" bind:submit="onFormSubmit" />`
  2. `onFormSubmit(e)` 调 `scheduleService.update(scheduleId, formData)`
  3. 现有 E2E 用例中编辑日程相关的不回归
- **验证命令**：`cd testing/e2e && npx playwright test --grep "编辑日程"`

---

### 第 7 梯队：前端页面

#### Task 7.1: components/use-template-dialog

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 5.1
- **产出文件**：
  - `app/components/use-template-dialog/index.js`
  - `app/components/use-template-dialog/index.wxml`
  - `app/components/use-template-dialog/index.wxss`
  - `app/components/use-template-dialog/index.json`
- **完成标准**：
  1. 组件 props：
     - `template`: Object, 模板详情
     - `visible`: Boolean, 显示/隐藏
     - `bind:close`: event, 关闭
     - `bind:success`: event, 生成成功，detail = {scheduleId, groupKey}
  2. 内部 data：childId（默认第一个家庭孩子）、startDate（默认今天）、overrideFields（{name, timeSlots, notes, location}）
  3. 字段渲染：
     - 模板预览（只读）：类型、时间槽、备注
     - 可覆盖字段：名称、备注
     - 必填：孩子选择、起始日期
  4. 提交：`templateService.apply(templateId, {childId, startDate, ...overrideFields})` → 触发 `success` 事件
  5. 所有可交互元素加 `data-id`：`use-template-dialog-child-picker`、`use-template-dialog-start-date-picker`、`use-template-dialog-confirm-btn` 等
  6. 使用 `<picker mode="date">` 选日期
- **验证命令**：`cd app && npx miniprogram-simulate --component app/components/use-template-dialog/`

#### Task 7.2: pages/template-list

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 5.1, 7.1
- **产出文件**：
  - `app/pages/template-list/index.js`
  - `app/pages/template-list/index.wxml`
  - `app/pages/template-list/index.wxss`
  - `app/pages/template-list/index.json`
- **完成标准**：
  1. 顶部：搜索框（`data-id="template-list-search-input"`，bindinput 触发 onSearch）+ "新建模板"按钮（`data-id="template-list-add-btn"`，bindtap 跳 `/pages/template-create/index`）
  2. 预设模板分区（标题"预设模板"，使用 `data-id="template-list-preset-section"`）：
     - `wx:for="{{presets}}"` 渲染，每项 `data-id="template-list-preset-row-{{item.templateId}}"`
     - 点击：弹 `use-template-dialog`
  3. 自定义模板分区（标题"我的模板"，`data-id="template-list-custom-section"`）：
     - `wx:for="{{customs}}"` 渲染，每项 `data-id="template-list-custom-row-{{item.templateId}}"`
     - 点击：跳 `/pages/template-detail/index?id={{item.templateId}}`
  4. 空态（customs.length === 0）：显示"还没有自定义模板，从日程保存或新建模板开始" + 新建按钮
  5. 搜索无结果：显示"未找到匹配模板"
  6. onLoad 调 `templateService.list()` 加载
  7. onShow 监听家庭切换（订阅 `familyChanged` 全局事件）刷新列表
- **验证命令**：`cd testing/e2e && npx playwright test --grep "模板列表"`（E2E 编写时）

#### Task 7.3: pages/template-detail

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 5.1
- **产出文件**：
  - `app/pages/template-detail/index.js`
  - `app/pages/template-detail/index.wxml`
  - `app/pages/template-detail/index.wxss`
  - `app/pages/template-detail/index.json`
- **完成标准**：
  1. onLoad 接收 `id` query，调 `templateService.getById(id)` 加载
  2. 字段展示：名称、类型、时间槽、备注、地点、重复结束日期、usageCount
  3. 自定义模板显示"编辑"和"删除"按钮（`data-id="template-detail-edit-btn"` / `template-detail-delete-btn`）
  4. 删除按钮点击：`wx.showModal` 二次确认，提示"已有 N 个日程使用过此模板，删除模板不会影响这些日程"
  5. 确认删除：`templateService.remove(id)` → 成功 toast "模板已删除" + `wx.navigateBack`
  6. 预设模板：不显示编辑/删除按钮，显示"系统预设"标识
  7. 编辑按钮：跳 `/pages/template-create/index?id={{id}}`（复用创建页支持编辑模式，mode='template-edit'）
- **验证命令**：`cd testing/e2e && npx playwright test --grep "模板详情"`

#### Task 7.4: pages/template-create

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6.1
- **产出文件**：
  - `app/pages/template-create/index.js`
  - `app/pages/template-create/index.wxml`
  - `app/pages/template-create/index.wxss`
  - `app/pages/template-create/index.json`
- **完成标准**：
  1. 支持两种 mode：
     - 从零创建（无 id query）：`mode='template-create'`
     - 编辑（有 id query）：`mode='template-edit'`，onLoad 加载 initialValues
  2. 使用 `<schedule-form mode="..." initial-values="{{initialValues}}" child-selector-visible="{{false}}" start-date-visible="{{false}}" schedule-type-locked="{{true}}" bind:submit="onFormSubmit" />`
  3. onFormSubmit：
     - template-create → `templateService.create(formData)` → 成功 toast + navigateBack
     - template-edit → `templateService.update(id, formData)` → 成功 toast + navigateBack
  4. 标题：创建时"新建模板"，编辑时"编辑模板"
- **验证命令**：`cd testing/e2e && npx playwright test --grep "创建模板|编辑模板"`

#### Task 7.5: schedule-detail 加"保存为模板"按钮

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 5.1
- **产出文件**：
  - `app/pages/schedule-detail/index.wxml`（修改：操作菜单新增按钮）
  - `app/pages/schedule-detail/index.js`（修改：onSaveAsTemplate handler）
- **完成标准**：
  1. 在操作菜单（如有 "编辑日程" 按钮旁）新增 "保存为模板" 按钮
     - `data-id="schedule-detail-save-as-template-btn"`
  2. 点击：`wx.showModal` 确认 "确定将 'XXX' 保存为模板吗？"
  3. 确认后：从 schedule 构造 `{name: schedule.name, scheduleType: schedule.scheduleType, timeSlots: schedule.timeSlots, ...}`，调 `templateService.create(data)`
  4. 成功 toast "已保存为模板，可在模板管理中查看"
  5. 仅 scheduleType 支持模板化时启用（All 3 种都支持）
- **验证命令**：`cd testing/e2e && npx playwright test --grep "保存为模板"`

#### Task 7.6: schedule-create 顶部加"从模板创建"入口

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 7.1
- **产出文件**：
  - `app/pages/schedule-create/index.wxml`（修改：顶部加入口）
  - `app/pages/schedule-create/index.js`（修改：handler）
- **完成标准**：
  1. 顶部表单上方新增按钮 "从模板创建"（`data-id="schedule-create-from-template-btn"`）
  2. 点击：跳 `/pages/template-list/index?action=apply&returnTo=schedule-create`（template-list 接收 action 后用 use-template-dialog 弹窗而非跳详情）
  3. 成功生成后：跳 `/pages/schedule-detail/index?id=...`（use-template-dialog 的 success 事件内处理）
- **验证命令**：`cd testing/e2e && npx playwright test --grep "从模板创建"`

---

### 第 8 梯队：E2E 联调

#### Task 8.1: 后端单元测试 + 集成测试

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 3.2
- **产出文件**：
  - `api/Template/Services/__tests__/TemplateServiceTests.cs`（≥ 8 个测试）
  - `api/Template/Controllers/__tests__/TemplateControllerTests.cs`（≥ 6 个测试）
- **完成标准**：
  1. TemplateServiceTests 覆盖：
     - CreateAsync 正常路径 + 4 个异常（空名/超长/HomeworkTimeSlot/非Homework无TimeSlot）
     - UpdateAsync 创建者可改 + 2 个异常（非创建者/预设）
     - DeleteAsync 同 Update 权限
     - GetByIdAsync 跨家庭返回 null
     - ListAsync 返回 presets + 同家庭 customs + 排除其他家庭
     - ApplyAsync 正常路径 + 3 个异常（childId 不在家庭/startDate 过期/无权限）
     - usageCount 统计正确
  2. TemplateControllerTests 覆盖 6 个端点的正常 + 401/403 路径
  3. 全部通过
- **验证命令**：
  ```bash
  dotnet test api/ --filter "FullyQualifiedName~Template"
  ```

#### Task 8.2: 前端 schedule-form 回归

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6.2, 6.3
- **产出文件**：（无需新建，验证已有 E2E 通过）
- **完成标准**：
  1. 现有创建日程 E2E 用例（139 项中的日程创建部分）通过
  2. 现有编辑日程 E2E 用例通过
  3. 关键流程：无回归
- **验证命令**：`cd testing/e2e && npx playwright test --grep "日程"`

#### Task 8.3: 全链路冒烟测试

- **负责 agent**：`dev-dotnet` + `dev-miniapp` 协同
- **依赖**：Task 7.x 全部, 4.2
- **产出文件**：
  - `api/__tests__/Template/TemplateIntegrationTests.cs`（后端 API 集成测试）
  - `app/__tests__/templates/`（小程序前端 Jest 测试）
- **完成标准**：
  1. 后端 API 集成测试（xUnit）：
     - 模板 CRUD 全流程（创建 → 列表 → 详情 → 编辑 → 删除）
     - 从模板生成日程（apply 端点）
     - 预设模板只读校验
     - 跨家庭隔离校验
     - 孩子角色拒绝校验
     - 至少 12 个测试用例
  2. 前端 Jest 测试（miniprogram-simulate）：
     - 模板列表页渲染预设 + 自定义分区
     - 搜索过滤
     - 使用模板弹窗交互
     - 至少 6 个测试用例
  3. 全部通过
- **验证命令**：
  ```bash
  # 后端 API 集成测试
  dotnet test api/ --filter "FullyQualifiedName~Template"

  # 前端 Jest 测试
  cd app && npx jest __tests__/templates/
  ```

---

## 风险与提示

1. **ScheduleService 扩展影响面**：Task 2.7 改动 `CreateScheduleRequest` 和 `ScheduleService.CreateAsync`，所有现有调用方需回归（Task 8.2 覆盖）
2. **预设种子时序**：Task 4.1 HostedService 启动需在 DbContext 初始化之后；EF Migration 应在应用启动前完成（开发环境 `Database.MigrateAsync()`，生产 CI/CD 手动）
3. **schedule-form 抽取工作量**：Task 6.2 / 6.3 是高风险改动，建议先在分支上完成 Task 6.1 → 6.2 → 跑 E2E → 6.3，避免一次大改
4. **app/contracts/template.js parity 测试**：Task 5.2 失败时阻塞 Stage 3 完成，必须先于 Task 7.x 执行
5. **usageCount 性能**：删除确认弹窗才查询，单次请求可接受；如未来频繁查询加缓存
