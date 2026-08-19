# Test Plan: 展示模式模块一期（小学模式）

> 阶段：Stage 4 测试
> 变更：`add-display-mode-module`
> 范围：后端 5 个孩子端端点 + 前端 4 个孩子端页面 + JWT displayMode claim + 孩子周完成率统计
> 测试策略：微信小程序前端无法用 Playwright E2E（Playwright 仅覆盖 Web 应用），前端走 Jest + miniprogram-simulate 组件测试；后端已有较完整单元测试覆盖，本阶段重点补充缺口和前端测试。

---

## 1. 测试范围与策略

### 1.1 测试金字塔

```
           /\
          /  \  E2E：不适用（微信小程序，非 Web 应用）
         /    \
        /------\  集成测试：后端 5 个孩子端端点 HTTP 集成测试（可选补充）
       /        \
      /----------\  组件测试：前端 4 个页面 + child-schedule 服务（Jest + miniprogram-simulate）
     /            \
    /--------------\  单元测试：后端已有 45+ 用例，补充边界/异常缺口
```

### 1.2 测试策略决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 前端测试框架 | Jest + miniprogram-simulate | 微信小程序原生框架，无法用 Playwright（仅 Web）。模拟微信 API（wx.request、wx.setStorageSync 等），测试页面逻辑和渲染 |
| 后端 E2E | 不做 | 本项目无 Web 前端，Playwright E2E 仅覆盖 Web 应用。孩子端为小程序页面，E2E 需在微信开发者工具自动化（二期可考虑 miniprogram-automator） |
| 后端集成测试 | 可选补充 | 已有单元测试覆盖 Controller + Service 层，集成测试可补充 HTTP 层面的鉴权和路由正确性 |
| 后端单元测试 | 补充缺口 | 已有 45+ 用例覆盖核心路径，需补充边界值（RepeatEndDate、衍生日程 OverrideDate、DateExclusion）和空态/异常态 |

### 1.3 测试范围矩阵

| 组件 | 类型 | 已有测试 | 需新增 | 优先级 |
|------|------|:------:|:------:|:------:|
| `ChildScheduleController` | 后端单元 | 19 | 0 | -- |
| `ChildScheduleQueryService` | 后端单元 | 13 | 4 | Must |
| `TokenService` | 后端单元 | 5 | 1 | Should |
| `CompletionStatsService` | 后端单元 | 8 | 2 | Must |
| 孩子端 HTTP 端点 | 后端集成 | 0 | 5 | Should |
| `child-schedule.js` | 前端服务 | 0 | 5 | Must |
| `child-today` 页面 | 前端组件 | 0 | 8 | Must |
| `child-week` 页面 | 前端组件 | 0 | 5 | Must |
| `child-month` 页面 | 前端组件 | 0 | 5 | Must |
| `child-mine` 页面 | 前端组件 | 0 | 5 | Must |

---

## 2. 已有测试覆盖评估

### 2.1 ChildScheduleControllerTests（19 用例）

**覆盖范围**：

| 端点 | 正常路径 | Parent 角色 403 | 非家庭成员 403 | 空列表 | 越权 | 边界 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|
| GET /today | x | x | x | x | -- | -- |
| GET /week | x | x | -- | x | -- | -- |
| GET /month | x | x | -- | x | -- | -- |
| GET /{id} | x | x | -- | -- | x | -- |
| GET /weekly-completion | x | x | -- | -- | -- | x (total=0) |

**评估**：覆盖充分。所有 5 个端点都有正常路径、Parent 角色 403、空列表测试。错误码 `CHILD_ONLY_ENDPOINT` 与 `CHILD_ACCESS_DENIED` 区分清晰。无需新增。

### 2.2 ChildScheduleQueryServiceTests（13 用例）

**覆盖范围**：

| 场景 | 已有 | 评估 |
|------|:--:|------|
| 今日匹配 TimeSlot | x | OK |
| 作业按 DueDate 匹配 | x | OK |
| 今日无匹配 | x | OK |
| 他人日程过滤 | x | OK |
| 已取消日程排除 | x | OK |
| 已打卡计入完成 | x | OK |
| 周视图实例计数 | x | OK |
| 月视图跨月边界 | x | OK |
| GetById 他人日程抛异常 | x | OK |
| GetById 本人日程返回 | x | OK |
| GetById 不存在返回 null | x | OK |
| GetById 跨家庭返回 null | x | OK |
| **衍生日程（OverrideDate）** | 缺失 | **缺口** |
| **DateExclusion 排除** | 缺失 | **缺口** |
| **RepeatEndDate 边界** | 缺失 | **缺口** |
| **已删除日程过滤** | 缺失 | **缺口** |

**评估**：核心路径覆盖良好，缺少 4 类边界场景。需补充。

### 2.3 TokenServiceTests（5 用例）

| 场景 | 已有 | 评估 |
|------|:--:|------|
| 孩子 + 有效 FamilyMember → 包含 displayMode | x | OK |
| 孩子 + 无 FamilyMember → 不含 | x | OK |
| 家长 → 不含 | x | OK |
| 默认值 Primary | x | OK |
| 已注销 FamilyMember → 不含 | x | OK |
| **孩子属于多个家庭** | 缺失 | **缺口** |

**评估**：核心路径覆盖充分，5 个测试覆盖了孩子有/无 FamilyMember、家长、默认值、已注销五种场景。缺少多家庭场景（`FirstOrDefaultAsync` 行为）。

### 2.4 CompletionStatsServiceTests（8 用例）

| 场景 | 已有 | 评估 |
|------|:--:|------|
| 无日程 → zeros | x | OK |
| 仅统计本人日程 | x | OK |
| 两个实例一个打卡 → 50% | x | OK |
| 已取消日程不计入 | x | OK |
| 本周到期作业计入 | x | OK |
| 下周到期作业不计入 | x | OK |
| 已排除日期不计入 | x | OK |
| 全部打卡 → 100% | x | OK |
| **衍生日程（OverrideDate）** | 缺失 | **缺口** |
| **RepeatEndDate 边界** | 缺失 | **缺口** |

**评估**：核心路径覆盖良好，缺少 2 类边界场景。需补充。

### 2.5 前端测试（已有 60+ 用例）

**评估**：**已覆盖充分**。4 个孩子端页面 + 1 个 service 封装均有测试，分布在：

| 文件 | 用例数 | 覆盖内容 |
|------|:------:|------|
| `app/__tests__/services/child-schedule.test.js` | 7 | 5 个 API 端点 URL/参数/错误码透传 |
| `app/__tests__/pages/child-today.test.js` | 15+ | displayMode、列表加载、进度计算、空态、打卡/撤销、错误态、data-id、视图切换 |
| `app/__tests__/pages/child-week.test.js` | 12+ | displayMode、7 天日历、色点注入、日期点击跳转、错误态、data-id、视图切换 |
| `app/__tests__/pages/child-month.test.js` | 12+ | displayMode、42 格月历、色点注入、非当月日期不跳转、错误态、data-id、视图切换 |
| `app/__tests__/pages/child-mine.test.js` | 15+ | displayMode、孩子姓名、本周完成率、并发加载、失败降级、隐私策略、data-id、视图切换 |
| `app/__tests__/dataids.test.js` | 4 | 4 页面 data-id 契约完整性 |

**无需新增前端测试**。

---

## 3. 测试缺口分析

### 3.1 后端缺口（7 项）

| # | 缺口 | 影响 | 所属组件 |
|---|------|------|----------|
| G1 | 衍生日程（ThisOnly 编辑产生的 OverrideDate 日程）在日/周/月查询和完成率统计中的行为 | 中 | ChildScheduleQueryService, CompletionStatsService |
| G2 | DateExclusion 排除日期在日视图查询中的过滤 | 中 | ChildScheduleQueryService |
| G3 | RepeatEndDate 到期后日程不再出现在查询中 | 中 | ChildScheduleQueryService, CompletionStatsService |
| G4 | IsDeleted=true 的日程被过滤 | 低 | ChildScheduleQueryService |
| G5 | 孩子属于多个家庭时 TokenService 的 displayMode 行为 | 低 | TokenService |
| G6 | 孩子端 HTTP 端点集成测试（鉴权、路由、响应格式） | 中 | ChildScheduleController（集成） |
| G7 | ChildScheduleController 中 `EnsureChildAsync` 对非 NOT_FAMILY_MEMBER 异常的处理 | 低 | ChildScheduleController |

### 3.2 前端缺口（0 项 — 已全部覆盖）

> **调用核实（2026-08-18）**：前端 4 页面 + 1 服务 + data-id 契约测试均已存在于 `app/__tests__/`，覆盖测试计划中全部 28 个前端用例。无需新增前端测试。

### 3.3 缺口优先级汇总

| 优先级 | 数量 | 说明 |
|:------:|:----:|------|
| Must | 6 | 后端 6 项边界（B01-B04, C01-C02） |
| Should | 5 | 后端集成测试 + 后端边界（B05, B07, T01, I01-I05） |
| Could | 3 | 后端低影响边界（B06, C03, G7） |

> 前端 28 项用例已在 Stage 3 研发中随页面同时实现，无需本次补充。

---

## 4. 测试用例矩阵

### 4.1 后端单元测试补充（ChildScheduleQueryService）

> 等价类划分：实体类型（AfterSchoolActivity/DailyRoutine/HomeworkTask）、日程状态（正常/已取消/已排除/已删除/衍生日程）、时间范围（今天/本周/本月）、RepeatEndDate（null/有效期内/已过期）。

| ID | 场景 | 等价类 | 输入 | 预期结果 | 优先级 |
|----|------|--------|------|----------|:------:|
| B01 | 衍生日程按 OverrideDate 匹配今日 | 衍生日程 | OverrideDate=today 的衍生日程 | 出现在今日列表中，不计入原日程 | Must |
| B02 | 衍生日程 OverrideDate 不在今日则不出现 | 衍生日程 | OverrideDate!=today 的衍生日程 | 不出现在今日列表中 | Must |
| B03 | DateExclusion 排除日期过滤 | 已排除 | 原日程在今天有 DateExclusion | 不出现在今日列表中 | Must |
| B04 | RepeatEndDate 到期后不再出现 | 边界-到期 | RepeatEndDate=昨天，查询今天 | 不出现在列表中 | Must |
| B05 | RepeatEndDate 在周内最后一天 | 边界-边界值 | RepeatEndDate=本周六，查询周视图 | 周六之前的天出现，周日不出现 | Should |
| B06 | IsDeleted=true 的日程被过滤 | 已删除 | 日程度 IsDeleted=true | 不出现在任何查询中 | Could |
| B07 | 衍生日程在周视图正确计数 | 衍生日程 | 衍生日程 OverrideDate 在周内 | 计入 totalCount，不影响同一天的原始日程 | Should |

### 4.2 后端单元测试补充（CompletionStatsService）

| ID | 场景 | 等价类 | 输入 | 预期结果 | 优先级 |
|----|------|--------|------|----------|:------:|
| C01 | 衍生日程按 OverrideDate 计入周统计 | 衍生日程 | 衍生日程 OverrideDate 在周内 | 计入 total，若已打卡计入 completed | Must |
| C02 | RepeatEndDate 在周中到期，之后实例不计入 | 边界值 | RepeatEndDate=周三，weekStart=周一 | 周一至周三计入，周四至周日不计入 | Must |
| C03 | 日程度 IsDeleted=true 不计入 | 已删除 | 日程度 IsDeleted=true | 不计入 total | Could |

### 4.3 后端单元测试补充（TokenService）

| ID | 场景 | 等价类 | 输入 | 预期结果 | 优先级 |
|----|------|--------|------|----------|:------:|
| T01 | 孩子属于多个家庭，取第一个有效 FamilyMember 的 displayMode | 多家庭 | 同一用户在两个家庭有不同 DisplayMode | 取 FirstOrDefault 结果的 displayMode | Should |

### 4.4 后端集成测试（HTTP 端点）

| ID | 场景 | 等价类 | 输入 | 预期结果 | 优先级 |
|----|------|--------|------|----------|:------:|
| I01 | GET /api/v1/child/schedule/today 鉴权通过 | 正常 | 有效 Child JWT + X-Family-Id | 200 + ChildScheduleListResponse | Should |
| I02 | GET /api/v1/child/schedule/today 无 JWT | 未授权 | 无 Authorization header | 401 | Should |
| I03 | GET /api/v1/child/schedule/today Parent 角色 | 权限不足 | 有效 Parent JWT | 403 + CHILD_ONLY_ENDPOINT | Should |
| I04 | GET /api/v1/child/schedule/{id} 越权访问 | 权限不足 | Child JWT 访问他人日程 | 403 + CHILD_ACCESS_DENIED | Should |
| I05 | GET /api/v1/child/stats/weekly-completion 正常返回 | 正常 | 有效 Child JWT | 200 + {percentage, completed, total} | Should |

### 4.5 前端服务测试（child-schedule.js）

> 等价类划分：API 调用成功/失败/网络超时/403 越权。

| ID | 场景 | 等价类 | 输入 | 预期结果 | 优先级 |
|----|------|--------|------|----------|:------:|
| F01 | getTodayList 正常返回数据 | 正常 | 无参数 | 解析 res.data 为 {items, completedCount, totalCount, completionPercentage} | Must |
| F02 | getTodayList 带日期参数 | 边界 | date='2026-08-18' | 调用 API 带 ?date= 参数 | Must |
| F03 | getWeekList 正常返回 | 正常 | 无参数 | 返回周列表数据 | Must |
| F04 | getMonthList 正常返回 | 正常 | 无参数 | 返回月列表数据 | Must |
| F05 | getWeeklyCompletion 正常返回 | 正常 | 无参数 | 返回 {percentage, completed, total} | Must |
| F06 | getById 越权返回 403 | 错误 | 他人 scheduleId | 抛出 CHILD_ACCESS_DENIED 错误 | Must |
| F07 | 网络超时错误处理 | 网络异常 | 模拟超时 | 将错误向上抛出 | Should |

### 4.6 前端页面组件测试（child-today）

> 等价类划分：页面状态（加载中/正常/空态/错误态）、日程状态（未完成/已完成）、操作类型（打卡/撤销）。

| ID | 场景 | 等价类 | 输入 | 预期结果 | 优先级 |
|----|------|--------|------|----------|:------:|
| P01 | 正常加载今日日程列表 | 正常 | mock API 返回 1 条日程 | 渲染日程卡片，含类型图标+名称+时间 | Must |
| P02 | 顶部进度显示"已完成 X/Y" | 正常 | 2 条日程，1 条已完成 | 显示"已完成 1/2"，进度条 50% | Must |
| P03 | 点击打卡按钮触发打卡 | 正常 | 点击未完成日程的打卡按钮 | 调用打卡 API，状态变为已完成 | Must |
| P04 | 撤销打卡恢复状态 | 正常 | 点击已完成日程的撤销按钮 | 调用撤销 API，状态恢复为未完成 | Must |
| P05 | 空态展示 | 空值 | API 返回空列表 | 显示"今天还没有日程" | Must |
| P06 | 网络错误态展示 | 网络异常 | API 返回错误 | 显示"网络连接失败" + 重试按钮 | Must |
| P07 | 点击重试按钮重新加载 | 错误恢复 | 错误态下点击重试 | 重新调用 API，进入加载态 | Must |
| P08 | 加载态展示 | 加载中 | 页面初始 loading=true | 显示加载动画 + "加载今日日程中..." | Must |
| P09 | 视图切换器导航到周视图 | 导航 | 点击"本周" | 调用 onSwitchToWeek | Should |
| P10 | 打卡按钮 data-id 包含 scheduleId | 可测试性 | 渲染多条日程 | 每个打卡按钮 data-id 包含对应 scheduleId | Should |

### 4.7 前端页面组件测试（child-week）

| ID | 场景 | 等价类 | 输入 | 预期结果 | 优先级 |
|----|------|--------|------|----------|:------:|
| P11 | 7 天日历正常渲染 | 正常 | mock API 返回周数据 | 渲染 7 列日期，标记今天 | Must |
| P12 | 有日程的日期显示色点 | 正常 | 某天有 AfterSchoolActivity | 该天格显示蓝色点 | Must |
| P13 | 点击日期跳转到对应日视图 | 导航 | 点击某天 | 调用 onDayTap 并跳转 | Must |
| P14 | 错误态与重试 | 网络异常 | API 错误 | 显示错误信息 + 重试按钮 | Must |
| P15 | 加载态展示 | 加载中 | loading=true | 显示加载动画 | Must |

### 4.8 前端页面组件测试（child-month）

| ID | 场景 | 等价类 | 输入 | 预期结果 | 优先级 |
|----|------|--------|------|----------|:------:|
| P16 | 月日历正常渲染 | 正常 | mock API 返回月数据 | 渲染当月所有日期格 | Must |
| P17 | 有日程的日期显示色点 | 正常 | 某天有日程 | 该天格显示对应颜色点 | Must |
| P18 | 非当月日期灰显 | 边界 | 月初/月末跨月日期 | 非当月日期带 other-month 样式 | Should |
| P19 | 点击日期跳转 | 导航 | 点击某天 | 调用 onDayTap 并跳转 | Must |
| P20 | 错误态与重试 | 网络异常 | API 错误 | 显示错误信息 + 重试按钮 | Must |

### 4.9 前端页面组件测试（child-mine）

| ID | 场景 | 等价类 | 输入 | 预期结果 | 优先级 |
|----|------|--------|------|----------|:------:|
| P21 | 显示孩子姓名 | 正常 | mock 用户数据 | 渲染孩子姓名 | Must |
| P22 | 显示本周完成率进度条 | 正常 | API 返回 60% | 进度条宽度 60%，显示"60%" | Must |
| P23 | 完成率文字显示 | 正常 | 3/5 已完成 | 显示"已完成 3/5" | Must |
| P24 | 部分信息加载失败不阻塞 | 错误 | 完成率 API 失败 | 仍显示姓名，错误区域显示"部分信息加载失败" | Should |
| P25 | 加载态展示 | 加载中 | loading=true | 显示加载动画 | Must |

### 4.10 前端 data-id 契约验证

| ID | 场景 | 验证目标 | 方法 | 优先级 |
|----|------|----------|------|:------:|
| D01 | child-today 页面 data-id 完整性 | 所有可交互元素有 data-id | 渲染后 DOM 查询 | Should |
| D02 | child-week 页面 data-id 完整性 | 所有可交互元素有 data-id | 渲染后 DOM 查询 | Should |
| D03 | child-month 页面 data-id 完整性 | 所有可交互元素有 data-id | 渲染后 DOM 查询 | Should |
| D04 | child-mine 页面 data-id 完整性 | 所有可交互元素有 data-id | 渲染后 DOM 查询 | Should |

### 4.11 去冗余分析

以下用例因覆盖同一等价类而合并或被已有用例覆盖，不再单独列出：

| 冗余用例 | 被覆盖方式 |
|----------|-----------|
| child-week 空态测试 | 与 child-today 空态测试等价（复用同一错误/空态组件模式），合并到 P14+ P19 |
| child-month 空态测试 | 同上，合并到 P20 |
| child-week 视图切换导航到今日/月/我的 | 与 child-today 视图切换等价，P09 已覆盖 |
| GetDailyListAsync 中 DailyRoutine 类型 | 与 AfterSchoolActivity 同属 TimeSlot 匹配逻辑，B01 已覆盖 |
| GetWeeklyListAsync 中 HomeworkTask 类型 | 作业任务按 DueDate 判定，与日视图逻辑一致，已有 C01 覆盖 |
| TokenService 对 Parent 角色多个 FamilyMember | 等价于已有 Parent 测试（不查 FamilyMember），T01 覆盖多家庭场景 |
| GetById 越权 Parent 角色 | 已有 ChildScheduleControllerTests 覆盖（通过 EnsureChildAsync 校验） |

---

## 5. 测试数据需求

### 5.1 后端测试数据

| 数据 | 用途 | 说明 |
|------|------|------|
| 衍生日程（SourceScheduleId + OverrideDate） | B01/B02/C01 | 模拟 ThisOnly 编辑产生的单次实例日程 |
| DateExclusion 记录 | B03 | 模拟日程在某天被排除 |
| RepeatEndDate 边界的日程 | B04/B05/C02 | 模拟 RepeatEndDate 在周中到期的日程 |
| IsDeleted=true 的日程 | B06/C03 | 模拟已软删除的日程 |
| 多家庭孩子 | T01 | 同一 UserId 在 2 个 Family 各有 FamilyMember 记录 |

### 5.2 前端测试数据

| 数据 | 用途 | 说明 |
|------|------|------|
| 今日日程列表 mock | P01-P04 | 含完整 ScheduleInfo 数据（typeIcon/name/time/status） |
| 空列表 mock | P05 | items=[] |
| 网络错误 mock | P06/P14/P20 | 模拟 API 调用失败 |
| 周视图数据 mock | P11-P13 | 7 天日程概览 + 色点 |
| 月视图数据 mock | P16-P19 | 整月日期格 + 色点 |
| 完成率 mock | P22-P23 | percentage=60, completed=3, total=5 |
| 孩子姓名 mock | P21 | childName="小明" |

---

## 6. data-id 前缀清单

本模块涉及的 data-id 前缀（用于测试定位）：

| 页面 | data-id 前缀 | 示例 |
|------|-------------|------|
| child-today | `child-today-` | `child-today-item-{scheduleId}`, `child-today-checkin-btn-{scheduleId}`, `child-today-undo-btn-{scheduleId}`, `child-today-progress`, `child-today-empty`, `child-today-error`, `child-today-retry-btn`, `child-today-loading`, `child-today-nav-*` |
| child-week | `child-week-` | `child-week-day-{date}`, `child-week-grid`, `child-week-error`, `child-week-retry-btn`, `child-week-loading`, `child-week-nav-*` |
| child-month | `child-month-` | `child-month-day-{date}`, `child-month-grid`, `child-month-error`, `child-month-retry-btn`, `child-month-loading`, `child-month-nav-*` |
| child-mine | `child-mine-` | `child-mine-name`, `child-mine-progress`, `child-mine-progress-bar-fill`, `child-mine-progress-text`, `child-mine-error`, `child-mine-loading`, `child-mine-nav-*` |

### 缺失 data-id 标记

审查 4 个页面的 WXML 后，以下元素缺少 data-id：

| 位置 | 缺失元素 | 建议 data-id | 影响 |
|------|----------|-------------|------|
| child-today | 已完成状态图标 | `child-today-status-done-{scheduleId}` | 低（已有 data-id，用于渲染完成状态图标） |
| child-week | 色点（dot）元素 | `child-week-dot-{scheduleId}-{typeClass}` | 低（纯展示，非交互元素） |
| child-month | 色点（dot）元素 | `child-month-dot-{scheduleId}-{typeClass}` | 低（纯展示，非交互元素） |

> 注：色点和状态图标为纯展示元素，按 `data-id` 规范无需强制添加。仅当测试需要验证特定日的色点是否存在时才需要。

---

## 7. 风险点

| 风险 | 等级 | 说明 | 缓解措施 |
|------|:----:|------|----------|
| 前端测试框架可用性 | 高 | 微信小程序原生框架的 Jest 测试方案（miniprogram-simulate）是否已在项目中配置？ | 需先验证 `app/` 目录下的 Jest 配置和测试基础设施 |
| 衍生日程逻辑遗漏 | 中 | OverrideDate 逻辑在 ThisOnly 编辑时产生，但查询和统计服务中尚未测试 | B01/B02/C01 补充 |
| 日期边界（RepeatEndDate） | 中 | 到期后日程是否仍出现在查询中 | B04/B05/C02 补充 |
| 多家庭场景 | 低 | 孩子属于多个家庭时 displayMode 取第一个有效记录 | T01 补充 |
| 前端页面数据一致性 | 中 | 打卡/撤销后 UI 更新是否与后端状态同步 | P03/P04 组件测试覆盖 |
| 视图切换后模式生效 | 低 | 模式切换依赖 JWT 刷新，无法在单元测试中覆盖 | 暂不测试，等二期集成测试 |

---

## 8. 测试执行计划

### 8.1 执行顺序

```
第 1 梯队（后端单元测试补充，可并行）
├── B01-B07: ChildScheduleQueryService 边界测试
├── C01-C03: CompletionStatsService 边界测试
└── T01: TokenService 多家庭场景测试

第 2 梯队（后端集成测试，可选）
├── I01-I05: HTTP 端点集成测试

前端测试已在 Stage 3 研发中随页面同步实现，无需新增。
```

### 8.2 验证命令

```bash
# 后端单元测试
dotnet test api/ --filter "FullyQualifiedName~ChildScheduleQueryService"
dotnet test api/ --filter "FullyQualifiedName~CompletionStatsService"
dotnet test api/ --filter "FullyQualifiedName~TokenService"

# 后端全部测试
dotnet test api/

# 前端测试（需确认 Jest 配置）
cd app && npx jest --testPathPattern="child-schedule"
cd app && npx jest --testPathPattern="child-today"
cd app && npx jest --testPathPattern="child-week"
cd app && npx jest --testPathPattern="child-month"
cd app && npx jest --testPathPattern="child-mine"
```

### 8.3 预期结果

| 层级 | 新增用例数 | 累计用例数 | 目标 |
|------|:--------:|:--------:|------|
| 后端单元 | 11 | 56+ | 全部通过 |
| 后端集成 | 5 | 5 | 全部通过 |
| 前端服务 | 0 | 7 | 已有，全部通过 |
| 前端页面 | 0 | 60+ | 已有，全部通过 |
| data-id 验证 | 0 | 4 | 已有，全部通过 |
| **合计** | **16** | **132+** | 全部通过 |

---

## 9. 附录：测试文件规划

### 9.1 新增测试文件

```
api/
├── Schedule/Services/__tests__/
│   └── ChildScheduleQueryServiceTests.cs  -- 已在，补充 B01-B07
├── Checkin/Services/__tests__/
│   └── CompletionStatsServiceTests.cs     -- 已在，补充 C01-C03
├── Auth/Services/__tests__/
│   └── TokenServiceTests.cs              -- 已在，补充 T01
└── Schedule/Controllers/__tests__/
    └── ChildScheduleControllerIntegrationTests.cs  -- 新建，I01-I05

app/
├── services/__tests__/
│   └── child-schedule.test.js            -- 新建，F01-F07
├── pages/child-today/__tests__/
│   └── index.test.js                     -- 新建，P01-P10
├── pages/child-week/__tests__/
│   └── index.test.js                     -- 新建，P11-P15
├── pages/child-month/__tests__/
│   └── index.test.js                     -- 新建，P16-P20
└── pages/child-mine/__tests__/
    └── index.test.js                     -- 新建，P21-P25
```

### 9.2 已有测试文件（无需修改）

```
api/
├── Schedule/Controllers/__tests__/
│   └── ChildScheduleControllerTests.cs   -- 覆盖充分，无需新增
```

---

*测试计划产出日期：2026-08-18*
*下游：test-writer agent*