# Tasks: add-display-mode-module (孩子展示模式一期 - 小学模式)

> 日期：2026-08-18
> 总 task 数：11

## Task 依赖关系图

```
第 0 梯队（后端，可并行）
├── Task 1: 新增孩子日程查询 Controller
├── Task 2: 新增孩子日程查询 DTO
├── Task 3: 新增孩子日程查询 Service 接口和实现
├── Task 4: 扩展 TokenService 添加 displayMode claim
└── Task 5: 扩展 CompletionStatsService 添加每周完成率统计
        │
        ▼
第 1 梯队（前端，可并行，依赖第 0 梯队 API 稳定）
├── Task 6: 新增 child-schedule service API 封装
├── Task 7: 新增 child-today 页面（今日只读视图）
├── Task 8: 新增 child-week 页面（周只读视图）
├── Task 9: 新增 child-month 页面（月只读视图）
└── Task 10: 新增 child-mine 页面（我的页面 + 本周完成率）
        │
        ▼
第 2 梯队（测试，依赖第 1 梯队完成）
└── Task 11: 后端添加单元测试
```

## Task 列表

### 第 0 梯队：后端基础设施

### Task 1: 新增 ChildScheduleController 孩子端日程端点

- **负责 agent**：`dev-dotnet`
- **依赖**：无
- **输入**：openspec/contracts/family/dto.json 定义的 DTO
- **产出文件**：
  - `api/Schedule/Controllers/ChildScheduleController.cs`
- **完成标准**：
  1. 实现 5 个端点：GET /api/v1/child/schedule/today、/week、/month、/{id}、/stats/weekly-completion
  2. 所有端点添加 `[Authorize]` 鉴权
  3. 从 claims 解析 userId 和 role，验证角色为 Child
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

---

### Task 2: 新增孩子端日程响应 DTO

- **负责 agent**：`dev-dotnet`
- **依赖**：无
- **输入**：openspec/contracts/family/dto.json
- **产出文件**：
  - `api/Schedule/Dtos/ChildScheduleResponses.cs`
- **完成标准**：
  1. `ChildScheduleListResponse` 类包含 `items`、`completedCount`、`totalCount`、`completionPercentage`
  2. `ChildWeeklyCompletionResponse` 类包含 `percentage`、`completed`、`total`
  3. 所有属性与 contracts JSON 对齐
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

---

### Task 3: 新增孩子日程查询 Service

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 2（DTO）
- **输入**：设计文档 API 契约、现有 ScheduleQueryService 模式
- **产出文件**：
  - `api/Schedule/Services/IChildScheduleQueryService.cs`
  - `api/Schedule/Services/ChildScheduleQueryService.cs`
- **完成标准**：
  1. `GetDailyListAsync` 返回今日日程列表 + 完成统计
  2. `GetWeeklyListAsync` 返回本周日程概览
  3. `GetMonthlyListAsync` 返回本月日程概览
  4. `GetByIdAsync` 返回单个日程详情 + 权限检查
  5. 所有查询自动过滤 `AssignedChildId == currentUserId`
  6. 使用 `.AsNoTracking()` 因为只读
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

---

### Task 4: 扩展 TokenService 添加 displayMode claim

- **负责 agent**：`dev-dotnet`
- **依赖**：无（DisplayMode 枚举已存在）
- **输入**：现有 TokenService 实现
- **产出文件**：
  - `api/Auth/Services/TokenService.cs`
- **完成标准**：
  1. 当用户角色为 Child 且有 FamilyMember 记录时，添加 `displayMode` claim 到 JWT
  2. 当用户角色为 Parent 时，不添加该 claim
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

---

### Task 5: 扩展 CompletionStatsService 添加孩子每周完成率统计

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 2（DTO）
- **输入**：现有完成率统计逻辑
- **产出文件**：
  - `api/Checkin/Services/ICompletionStatsService.cs`
  - `api/Checkin/Services/CompletionStatsService.cs`
- **完成标准**：
  1. 新增 `GetChildWeeklyCompletionRateAsync(Guid userId, Guid familyId)` 方法
  2. 只统计当前孩子（`AssignedChildId == userId`）本周的日程
  3. 返回 `(percentage, completed, total)`
- **验证命令**：`dotnet build api/Agenda.Api.csproj`

---

### 第 1 梯队：前端页面（可并行）

### Task 6: 新增 child-schedule API 服务封装

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 1-5（后端 API 已完成）
- **输入**：API 契约 design.md
- **产出文件**：
  - `app/services/child-schedule.js`
- **完成标准**：
  1. 封装 `getTodayList()`、`getWeekList()`、`getMonthList()`、`getById()`、`getWeeklyCompletion()` 五个方法
  2. 所有方法走统一 `api` 封装，自动注入 X-Family-Id
  3. 枚举值引用 `app/contracts/family.js`，不手写字符串
- **验证命令**：（无单独测试，构建小程序验证）

---

### Task 7: 新增 child-today 孩子今日视图页面

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6（service）
- **输入**：设计文档小学模式今日视图规范
- **产出文件**：
  - `app/pages/child-today/index.js`
  - `app/pages/child-today/index.wxml`
  - `app/pages/child-today/index.wxss`
  - `app/pages/child-today/index.json`
- **完成标准**：
  1. onLoad 读取 displayMode 从 globalData
  2. 调用 API 获取今日日程列表
  3. 顶部显示 "已完成 X/Y" 进度
  4. 列表渲染每项：类型图标 + 名称 + 时间 + 打卡按钮 + 状态图标
  5. 点击打卡按钮直接打卡，点击已打卡项撤销打卡
  6. 所有可交互元素添加符合规范的 `data-id`
  7. 空态显示 "今天还没有日程"
- **验证命令**：（无单独测试，页面开发完成后模拟器验证）

---

### Task 8: 新增 child-week 孩子周视图页面

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6（service）
- **输入**：设计文档小学模式周视图规范
- **产出文件**：
  - `app/pages/child-week/index.js`
  - `app/pages/child-week/index.wxml`
  - `app/pages/child-week/index.wxss`
  - `app/pages/child-week/index.json`
- **完成标准**：
  1. 7 天日历展示，每天显示日程类型色点
  2. 只读，点击日期跳转到对应日期的今日视图
  3. 所有可交互元素添加 `data-id`
- **验证命令**：（无单独测试，模拟器验证）

---

### Task 9: 新增 child-month 孩子月视图页面

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6（service）
- **输入**：设计文档小学模式月视图规范
- **产出文件**：
  - `app/pages/child-month/index.js`
  - `app/pages/child-month/index.wxml`
  - `app/pages/child-month/index.wxss`
  - `app/pages/child-month/index.json`
- **完成标准**：
  1. 月日历展示，有日程的日期显示色点
  2. 只读，点击日期跳转到对应日期的今日视图
  3. 所有可交互元素添加 `data-id`
- **验证命令**：（无单独测试，模拟器验证）

---

### Task 10: 新增 child-mine 孩子我的页面

- **负责 agent**：`dev-miniapp`
- **依赖**：Task 6（service）
- **输入**：设计文档小学模式我的页面规范
- **产出文件**：
  - `app/pages/child-mine/index.js`
  - `app/pages/child-mine/index.wxml`
  - `app/pages/child-mine/index.wxss`
  - `app/pages/child-mine/index.json`
- **完成标准**：
  1. 显示孩子姓名
  2. 显示本周完成率进度条（百分比 + X/Y 文字）
  3. 不显示其他管理功能（切换家庭、设置等）
- **验证命令**：（无单独测试，模拟器验证）

---

### 第 2 梯队：测试

### Task 11: 后端孩子端端点单元测试

- **负责 agent**：`dev-dotnet`
- **依赖**：Task 1-5（后端实现完成）
- **输入**：现有测试项目结构
- **产出文件**：
  - `api/Schedule/__tests__/ChildScheduleControllerTests.cs`
- **完成标准**：
  1. 测试正常路径：孩子获取自己日程成功
  2. 测试权限异常：孩子尝试获取他人日程返回 403
  3. 测试空列表返回正确
  4. 所有测试通过
- **验证命令**：`dotnet test api/ --filter "FullyQualifiedName~ChildScheduleController"`
