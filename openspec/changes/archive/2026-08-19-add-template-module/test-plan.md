# Test Plan: 模板系统模块（add-template-module）

> 日期：2026-08-19
> 路径：`openspec/changes/add-template-module/test-plan.md`
> 平台：微信小程序（`app/`）+ .NET 10 Web API（`api/`）—— 走小程序分支
> 上游：staging `production/staging/2026-08-19-模板系统/`（dev-ready） + design.md + 3 个 delta spec
> 下游：test-writer（按需补全测试） → test-reviewer → 主代理执行测试 → 人审批

---

## 1. 测试概述

### 1.1 范围

覆盖模板系统首期 8 个 Must 需求 + 16 个 Story，对应 3 个 delta spec：

| Spec | Requirement 数 | 关键能力 |
|------|:-:|------|
| template-crud | 6 | 创建/列表/详情/更新/删除/usageCount |
| template-application | 2 | 从模板生成日程 + 跨家庭拒绝 |
| template-preset | 3 | 种子初始化 + 预设只读 + 全局可见 |

### 1.2 测试策略（小程序分支，非 Web E2E）

依据 [`../.claude/rules/req-staging.md`](../.claude/rules/req-staging.md) §"Stage 4 平台分支"：

- 后端：xUnit（Moq + InMemoryDatabase），覆盖 Controller + Service + Validator + HostedService
- 前端：Jest + miniprogram-simulate，覆盖 contract parity + service + component + page + 全链路冒烟
- 集成：主代理手动启动 `dotnet run` + `npx jest` 联动验证
- **不走 Playwright**（`testing/e2e/` 下的 Playwright 套件仅适用于 Web 应用，本项目无 `web/` 目录）

### 1.3 测试深度目标

| 层级 | 目标覆盖率 | 优先级 |
|------|:---:|------|
| 后端 Service | ≥ 80% 行覆盖 | Must |
| 后端 Controller | ≥ 80% 分支覆盖（含 4xx/403/404） | Must |
| 后端 Validator | 100% 规则覆盖 | Must |
| 前端契约 | 100% parity（JSON ↔ JS） | Must |
| 前端 service | URL/method/错误映射 100% | Must |
| 前端组件 | 4 mode × 关键状态 | Must |
| 前端页面 | 6 页面全流程 | Must |
| 冒烟 | 7+ 端到端用例 | Must |

---

## 2. 已有测试覆盖评估

### 2.1 后端已有测试

| 文件 | 测试方法数 | 覆盖场景 | 缺口 |
|------|:-:|------|------|
| `api/Template/Controllers/__tests__/TemplateControllerTests.cs` | 9 | 角色校验（3 端点）、List 成功+分页上限、GetById null→404/success、Create 成功+验证异常、Apply 成功+起始日期过期 | Update / Delete 端点无测试 |
| `api/Template/Services/__tests__/TemplateServiceTests.cs` | 18 | Create 正常/重名/跨家庭/非法类型、Update 拥有者/非拥有者/预设只读、Delete 同样、GetById 跨家庭/预设可访问、List 预设+自定义/keyword/isPreset 过滤、Apply 成功/孩子不在家庭/跨家庭/字段覆盖、usageCount 软删除过滤 | ListAsync scheduleType 过滤未覆盖；ListAsync 默认 page/pageSize 边界；ListAsync 跨家庭过滤断言；CreateAsync notes/location 长度边界；DeleteAsync 二次删除幂等性 |
| `api/Template/Services/TemplateSeedHostedService.cs` | **0** | 整个文件无单元测试 | **严重缺口** —— HostedService 启动 + 幂等性 + 失败重试未覆盖 |
| `api/Template/Validators/*RequestValidator.cs` | **0** | Validator 类无独立测试 | **中度缺口** —— 仅通过 Controller 间接验证，FluentValidation 规则（name/notes/location 长度、timeSlots 边界）的失败路径覆盖不足 |

**后端已有用例总计**：27 个 [Fact]

### 2.2 前端已有测试

| 文件 | 测试方法数 | 覆盖场景 | 缺口 |
|------|:-:|------|------|
| `app/__tests__/contracts/template.test.js` | 12 | TemplateSource/ScheduleType 枚举值、ErrorCodes/ErrorMessages/HttpStatus 三个 map 完整性、ScheduleTypeLabels、CreateTemplateRequest/ApplyTemplateRequest 字段、TemplateSummary 字段、usageCount 字段 | 暂无明显缺口 |
| `app/__tests__/services/template.test.js` | 12 | 6 端点 URL/method 透传、apply 错误码防御性 message 补充（含 START_DATE_INVALID 透传/补齐/未知错误） | POST/PUT 错误码 message 补齐未覆盖（仅 apply 测试）；5xx 错误的处理 |
| `app/__tests__/components/schedule-form.test.js` | 23 | 4 mode 默认值、类型选择/锁定、5 字段输入、孩子多选、8 种校验（4 失败 + 2 成功）、submit 事件、WXML data-id 契约（8 个） | template-create 模式下 location/repeatEndDate 字段编辑；type-locked 时修改提示 |
| `app/__tests__/components/use-template-dialog.test.js` | 22 | 初始化（visible/childId/startDate/hasNoChild）、4 输入处理（child/date/name/notes）、onClose、onConfirm 8 个场景（2 校验失败 + 5 成功变体 + 1 重复点击保护 + 1 未知错误）、WXML data-id（6 个） | location 覆盖输入未测；timeSlots 覆盖路径未测；startDate < today 时服务端 START_DATE_INVALID 的本地校验拦截（应有 wx.showToast 在请求前） |
| `app/__tests__/pages/template-list.test.js` | 14 | onLoad/onShow 加载、presets/customs 分区、搜索（输入/触发/清空）、模板点击（预设弹 dialog / 自定义跳详情 / action=apply）、新建入口（顶部+空态）、dialog success 回调、dialog close、WXML data-id（6 个） | 空态文案验证；keyword 搜索无结果文案；不同 scheduleType 过滤 |
| `app/__tests__/pages/template-detail.test.js` | 12 | onLoad（缺 id/有 id/成功/失败）、预设模板不显示编辑删除、onTapEdit、onTapDelete（4 个变体：确认弹窗含 usageCount/确认/取消/失败）、onTapUse 弹 dialog、WXML data-id（3 个） | 404 时是否需要 navigateBack；usageCount=0 时的弹窗文案 |
| `app/__tests__/pages/template-create.test.js` | 10 | 2 mode（template-create/template-edit）切换、加载失败、4 提交场景（创建成功/编辑成功/校验失败/失败 Toast）、WXML data-id 契约（schedule-form 4 个 prop） | 编辑模式下 scheduleType 不可变的 prop 传递验证；重名校验触发（duplicate name） |
| `app/__tests__/pages/schedule-create-from-template.test.js` | 2 | onTapFromTemplate 跳转 URL 参数、按钮 data-id | **缺口** —— 从模板创建日程的完整回跳流程（`returnTo=schedule-create`）未测；schedule-create 页接收到已选模板后的展示行为未测 |
| `app/__tests__/pages/schedule-detail-save-as-template.test.js` | 4 | 弹 showModal 二次确认（含模板名）、确认后构造 payload 调 template.create、取消、失败 Toast、WXML data-id | **缺口** —— schedule-form 模式兼容未单独验证（`save-as-template` 实际是 schedule-detail 自己构造 payload）；preset 类型 schedule 保存行为 |
| `app/__tests__/templates/template-smoke.test.js` | 7 | 全链路冒烟（列表加载 → 弹 dialog → 调 apply → 编辑跳转 → 删除 → 使用 dialog → 成功回调） | 边界场景冒烟（如 list 失败 + dialog 关闭的组合） |
| `app/__tests__/helpers/template-mock.js` | — | 6 端点的 mock 工厂 | 完整 |

**前端已有用例总计**：118 个 [test]

### 2.3 覆盖汇总

| 维度 | 已有 | 应有 | 缺口 |
|------|:-:|:-:|------|
| 后端 Controller 端点 | 5/6 | 6 | 1（Update/Delete 未测） |
| 后端 Service 方法 | 7/7 | 7 | 0（核心方法已覆盖） |
| 后端 Validator 规则 | 0/3 | 3 | 3（全部缺失） |
| 后端 HostedService | 0/1 | 1 | 1（种子初始化） |
| 前端契约 | 12/12 | 12 | 0 |
| 前端 service | 5/6 | 6 | 1（POST/PUT 错误补齐） |
| 前端组件 | 2/2 | 2 | 0（核心组件已覆盖） |
| 前端页面 | 6/6 | 6 | 0 |
| 冒烟 | 7/6+ | 6+ | 0 |
| **合计** | **145** | **150** | **约 5-10 个补充用例** |

---

## 3. 等价类划分

### 3.1 输入域等价类

| 字段 | 合法类 | 非法类 | 边界 |
|------|--------|--------|------|
| name（模板名） | 1-50 字符 | 空 / 空白 / > 50 / null | `""`, `"a"`, `"a"×49`, `"a"×50`, `"a"×51` |
| scheduleType | AfterSchoolActivity / DailyRoutine / HomeworkTask | 非法字符串 / null / 空 | `"AfterSchoolActivity"`, `"HomeworkTask"`, `"InvalidType"`, `""` |
| timeSlots | 类型相关（HomeworkTask 空 / 其他 ≥ 1） | 类型错配 / 空 | 0 项, 1 项, 7 项（每 DayOfWeek 一项） |
| timeSlots.TimeInvalid | startTime < endTime | startTime == endTime / startTime > endTime | 08:00-09:00, 09:00-09:00, 10:00-09:00 |
| notes | 0-500 字符 | > 500 | 500, 501 |
| location | 0-100 字符 | > 100 | 100, 101 |
| repeatEndDate | DateOnly ≥ today（HomeworkTask 为 null） | < today / 非法格式 | today, today+1, today-1 |
| childId | 家庭成员（UserRole=Child） | 非家庭成员 / 非 Child 角色 / Guid.Empty | childA, childB（其他家庭）, parentA, Empty |
| startDate | ≥ today | < today | today, today+1, today-1 |
| keyword | 任意字符串（含中文） | null / 超长 | `"钢琴"`, `""`, `"xyz"`, `"a"×1000` |
| isPreset | true / false / null | — | — |
| page | ≥ 1 | 0 / 负数 | 1, 2, 0, -1 |
| pageSize | 1-100 | 0 / 负数 / > 100 | 20, 100, 0, 101, 999 |

### 3.2 状态等价类

| 状态 | 描述 | 关联场景 |
|------|------|----------|
| 模板类型 | 预设（IsPreset=true） / 自定义（IsPreset=false） | 更新/删除权限不同 |
| 拥有者 | 创建者（CreatedBy=currentUserId） / 非创建者（同家庭） | 更新/删除权限不同 |
| 家庭 | 同家庭 / 跨家庭 | 列表/详情/应用/编辑均校验 |
| 角色 | 家长（Parent） / 孩子（Child） | 所有端点拒绝 Child |
| 软删除 | 未删（IsDeleted=false） / 已软删（IsDeleted=true） | 软删后不可见但 SourceTemplateId 仍指向 |
| 使用次数 | usageCount=0 / usageCount≥1 | 删除确认弹窗文案不同 |

### 3.3 错误路径

| 场景 | 错误码 | 触发条件 |
|------|--------|----------|
| 名称空 | TEMPLATE_NAME_EMPTY | name="" / 纯空白 |
| 名称超长 | TEMPLATE_NAME_TOO_LONG | name 长度 > 50 |
| 备注超长 | TEMPLATE_NOTES_TOO_LONG | notes 长度 > 500 |
| 地点超长 | TEMPLATE_LOCATION_TOO_LONG | location 长度 > 100 |
| timeSlots 类型错配 | TEMPLATE_TIMESLOT_INVALID | HomeworkTask + timeSlots 非空 |
| timeSlots 缺失 | TEMPLATE_TIMESLOT_REQUIRED | 非 HomeworkTask + timeSlots 空 |
| timeSlot 时间无效 | TEMPLATE_TIMESLOT_TIME_INVALID | startTime >= endTime |
| 重名 | TEMPLATE_DUPLICATE_NAME | 同家庭 + name 重复 |
| 不存在 | TEMPLATE_NOT_FOUND | templateId 不存在 / 跨家庭访问 |
| 预设只读 | TEMPLATE_PRESET_READONLY | 对 IsPreset=true 调 PUT/DELETE |
| 非拥有者 | TEMPLATE_NOT_OWNER | CreatedBy ≠ currentUserId 调 PUT/DELETE |
| 孩子角色 | CHILD_ACCESS_DENIED | role=Child 调任何端点 |
| 孩子不在家庭 | CHILD_NOT_IN_FAMILY | childId 不在当前家庭 |
| 起始日期过早 | START_DATE_INVALID | startDate < today |
| 类型无效 | TEMPLATE_TYPE_INVALID | scheduleType 非枚举值 |

---

## 4. 测试矩阵

### 4.1 端点 × 等价类 × 边界 × 错误路径

| 端点 | 正常路径（已有 / 补充） | 边界值（已有 / 补充） | 错误路径（已有 / 补充） | 角色 / 隔离（已有 / 补充） |
|------|------|------|------|------|
| **GET /api/v1/templates** | 列表返回预设+自定义 ✓ | pageSize=100 钳制 ✓ / page=0 / 默认 page=1+pageSize=20（缺） | scheduleType 过滤（缺） / keyword=无结果空数组 ✓ | 跨家庭过滤 ✓ / Child 角色 403 ✓ |
| **GET /api/v1/templates/{id}** | 自定义详情 ✓ / 预设详情 ✓ | — | 跨家庭 404 ✓ / 不存在 404（隐含于上） | Child 角色 403 ✓ |
| **POST /api/v1/templates** | AfterSchoolActivity ✓ / HomeworkTask ✓ | name 50 字符 / timeSlots 7 项 / timeSlots time invalid（缺） | 重名 409 ✓ / 类型无效 ✓ / 5 种 name/timeSlot 非法（缺）/ notes/location 超长（缺） | Child 角色 403 ✓ |
| **PUT /api/v1/templates/{id}** | 拥有者更新 ✓ | scheduleType 字段未在 UpdateRequest（DTO 验证，缺） / timeSlots 完整替换 ✓ | 非拥有者 403 ✓ / 预设 403 ✓ / 跨家庭 404（缺） / 字段非法（缺） | 缺 Controller 端点测试 |
| **DELETE /api/v1/templates/{id}** | 拥有者软删 ✓ | 二次删除幂等性（缺） | 非拥有者 403 ✓ / 预设 403 ✓ / 跨家庭 404（缺） / 已软删再删（缺） | 缺 Controller 端点测试 |
| **POST /api/v1/templates/{id}/apply** | 成功生成 ✓ | startDate=today / 覆盖全部字段 ✓ | startDate 过期（Controller 已测）/ childId 不在家庭 ✓ / 模板不存在 404 ✓ / 跨家庭 404 ✓ | Child 角色 403（隐含于 Service，Controller 缺） |
| **POST /api/v1/templates** + 种子 | — | — | **HostedService 启动（缺）/ 幂等性（缺）/ 启动失败重试（缺）** | — |

### 4.2 前端页面 × 行为矩阵

| 页面 | 加载 | 展示 | 交互 | 错误处理 | data-id 契约 |
|------|:---:|:---:|:---:|:---:|:---:|
| **template-list** | onLoad + onShow 调 list ✓ | presets/customs 分区 ✓ | 搜索 ✓ / 点击（预设/自定义）✓ / 新建入口 ✓ / dialog success ✓ | 加载失败 Toast ✓ | 8 个 data-id ✓ |
| **template-detail** | onLoad 调 getById ✓ | isPreset 分支 ✓ / 时间槽摘要 ✓ | onTapEdit ✓ / onTapDelete（4 个）✓ / onTapUse ✓ | 缺 id / 加载失败 / 删除失败 Toast ✓ | 3 个 data-id ✓ |
| **template-create** | onLoad 按 query 选 mode ✓ | mode 切换 ✓ | onFormSubmit（4 个）✓ | 加载失败 ✓ / 提交失败 Toast ✓ | schedule-form 4 prop ✓ |
| **use-template-dialog** | props + visible 触发 ✓ | childId/hasNoChild/overrideName/Notes ✓ | onConfirm（8 个）✓ | START_DATE_INVALID / CHILD_NOT_IN_FAMILY Toast ✓ | 6 个 data-id ✓ |
| **schedule-form** | 4 mode properties ✓ | 字段 / 孩子 / 时间槽 ✓ | 校验（8 个）✓ / submit 事件 ✓ | locked 模式拒绝变更 ✓ | 8 个 data-id ✓ |
| **schedule-create** | onLoad / onTapFromTemplate ✓ | — | 跳转 URL 含 action=apply&returnTo=schedule-create ✓ | — | 1 个 data-id ✓ |
| **schedule-detail** | onLoad / onShow ✓ | — | onSaveAsTemplate（4 个）✓ | Toast ✓ | 1 个 data-id ✓ |

---

## 5. 补充测试用例清单（test-writer 需补全）

> **注**：以下仅列**待补全**的等价类，已有的不再列。test-writer 应按此清单编写实际测试代码。

### 5.1 后端需补充（建议 ≥ 10 个 [Fact]）

#### TemplateServiceTests.cs 补充

| ID | 测试名 | 覆盖等价类 | 优先级 |
|----|--------|----------|:---:|
| T-S01 | `ListAsync_WithScheduleTypeFilter_ReturnsOnlyMatching` | scheduleType=DailyRoutine 过滤 | Must |
| T-S02 | `ListAsync_WithPagination_ReturnsCorrectPage` | page=2 / pageSize=5 边界 | Should |
| T-S03 | `ListAsync_DefaultPageIsOneAndSizeIs20` | 不传 page/pageSize 时默认值 | Should |
| T-S04 | `CreateAsync_NameAt50CharBoundary_Succeeds` | name=50 字符（合法边界） | Should |
| T-S05 | `CreateAsync_NameAt51CharBoundary_ThrowsTemplateNameTooLong` | name=51 字符（非法边界） | Must |
| T-S06 | `CreateAsync_NotesAt500CharBoundary_Succeeds` | notes=500 字符（合法边界） | Should |
| T-S07 | `CreateAsync_NotesAt501CharBoundary_ThrowsTemplateNotesTooLong` | notes=501 字符（非法边界） | Must |
| T-S08 | `CreateAsync_TimeSlotStartTimeEqualsEndTime_ThrowsTemplateTimeslotTimeInvalid` | startTime == endTime | Must |
| T-S09 | `CreateAsync_TimeSlotStartTimeAfterEndTime_ThrowsTemplateTimeslotTimeInvalid` | startTime > endTime | Must |
| T-S10 | `DeleteAsync_OnSoftDeletedTemplate_SucceedsIdempotently` | 软删后再删不报错（IsDeleted=true） | Should |
| T-S11 | `UpdateAsync_OnOtherFamilyTemplate_ThrowsTemplateNotFound` | 跨家庭 update 返回 404 | Must |
| T-S12 | `DeleteAsync_OnOtherFamilyTemplate_ThrowsTemplateNotFound` | 跨家庭 delete 返回 404 | Must |
| T-S13 | `ApplyAsync_OnNonExistentTemplate_ThrowsTemplateNotFound` | 不存在 templateId | Must |
| T-S14 | `ApplyAsync_WithNoTimeSlotsOverride_PassesTemplateTimeSlots` | 不传覆盖时使用模板默认 | Should |
| T-S15 | `GetByIdAsync_OnSoftDeletedTemplate_ReturnsNull` | 软删后 GetById 返回 null | Should |

#### TemplateControllerTests.cs 补充

| ID | 测试名 | 覆盖等价类 | 优先级 |
|----|--------|----------|:---:|
| T-C01 | `Update_WhenChildRole_Returns403` | Child 角色拒绝更新 | Must |
| T-C02 | `Delete_WhenChildRole_Returns403` | Child 角色拒绝删除 | Must |
| T-C03 | `Delete_WhenServiceSucceeds_Returns200` | 删除成功返回 200 | Should |
| T-C04 | `Update_WhenServiceThrowsTemplateNotFound_Returns404` | update 跨家庭时 404 | Must |
| T-C05 | `Delete_WhenServiceThrowsTemplateNotFound_Returns404` | delete 跨家庭时 404 | Must |
| T-C06 | `Apply_WhenChildRole_Returns403` | Child 角色拒绝 apply | Must |

#### TemplateSeedHostedServiceTests.cs 新建（必须）

| ID | 测试名 | 覆盖等价类 | 优先级 |
|----|--------|----------|:---:|
| T-H01 | `SeedAsync_EmptyDatabase_Inserts3PresetTemplates` | 首次启动 | Must |
| T-H02 | `SeedAsync_AlreadySeeded_DoesNothing` | 幂等性 | Must |
| T-H03 | `SeedAsync_PartiallySeeded_InsertsMissingOnly` | 部分种子时补齐 | Should |
| T-H04 | `SeedAsync_AfterSchoolClass_HasCorrectFields` | 预设字段准确性 | Must |
| T-H05 | `SeedAsync_DailyRoutine_HasMonToSunTimeSlots` | 日常作息 7 天时间槽 | Must |
| T-H06 | `SeedAsync_Homework_HasNoTimeSlots` | 作业无时间槽 | Must |
| T-H07 | `SeedAsync_AllPresets_HaveIsPresetTrueAndFamilyIdNull` | 字段约束 | Must |
| T-H08 | `SeedAsync_OnDatabaseError_LogsAndDoesNotThrow` | 失败不阻塞 | Should |

#### ValidatorTests.cs 新建（建议）

| ID | 测试名 | 覆盖等价类 | 优先级 |
|----|--------|----------|:---:|
| T-V01 | `CreateTemplateValidator_EmptyName_FailsWithNameEmpty` | name 空 | Must |
| T-V02 | `CreateTemplateValidator_51CharName_FailsWithNameTooLong` | name 51 字符 | Must |
| T-V03 | `CreateTemplateValidator_501CharNotes_FailsWithNotesTooLong` | notes 501 字符 | Must |
| T-V04 | `CreateTemplateValidator_101CharLocation_FailsWithLocationTooLong` | location 101 字符 | Must |
| T-V05 | `CreateTemplateValidator_HomeworkWithTimeSlots_FailsWithTimeslotInvalid` | type 错配 | Must |
| T-V06 | `CreateTemplateValidator_ActivityWithoutTimeSlots_FailsWithTimeslotRequired` | type 缺时间槽 | Must |
| T-V07 | `UpdateTemplateValidator_AcceptsUpdateWithoutScheduleType` | 确认 UpdateRequest 不含 scheduleType 字段 | Should |
| T-V08 | `ApplyTemplateValidator_StartDateYesterday_FailsWithStartDateInvalid` | startDate < today | Must |
| T-V09 | `ApplyTemplateValidator_StartDateToday_Succeeds` | startDate = today（合法边界） | Must |

### 5.2 前端需补充（建议 ≥ 5 个 [test]）

#### schedule-form.test.js 补充

| ID | 测试名 | 覆盖等价类 | 优先级 |
|----|--------|----------|:---:|
| F-SF01 | `template-edit 模式：onFieldInput 修改 location/notes/repeatEndDate 正常` | 模板编辑字段可改 | Should |
| F-SF02 | `template-create 模式：name 50 字符合法 + 51 字符非法` | name 长度边界 | Should |
| F-SF03 | `template-create 模式：notes 500 字符合法 + 501 字符非法` | notes 长度边界 | Should |

#### use-template-dialog.test.js 补充

| ID | 测试名 | 覆盖等价类 | 优先级 |
|----|--------|----------|:---:|
| F-UT01 | `onLocationInput 更新 overrideLocation` | 覆盖 location | Should |
| F-UT02 | `onTimeSlotChange 更新 overrideTimeSlots` | 覆盖时间槽 | Should |
| F-UT03 | `startDate=昨天 → 阻止 submit（本地校验拦截，不发请求）` | startDate 边界 | Must |
| F-UT04 | `apply 返回 TEMPLATE_NOT_FOUND 错误码 → Toast` | 模板被删后并发场景 | Should |

#### template-list.test.js 补充

| ID | 测试名 | 覆盖等价类 | 优先级 |
|----|--------|----------|:---:|
| F-TL01 | `customs 为空时显示空态文案"还没有自定义模板..."` | 空态展示 | Should |
| F-TL02 | `keyword 搜索无结果 → 显示"未找到匹配模板"提示` | 搜索无结果 | Should |
| F-TL03 | `下拉刷新/上拉加载更多（如有实现）` | 分页边界 | Could |

#### template-create.test.js 补充

| ID | 测试名 | 覆盖等价类 | 优先级 |
|----|--------|----------|:---:|
| F-TC01 | `提交返回 TEMPLATE_DUPLICATE_NAME → Toast "当前家庭已存在同名模板"` | 重名错误码 | Must |
| F-TC02 | `编辑模式下 scheduleTypeLocked=true 时类型卡片不可点击` | 锁定行为 | Should |

#### schedule-create-from-template.test.js 补充

| ID | 测试名 | 覆盖等价类 | 优先级 |
|----|--------|----------|:---:|
| F-SC01 | `接收到 returnTo=schedule-create 参数时预填模板预览` | 完整回跳流程 | Should |

---

## 6. 测试数据需求

### 6.1 后端测试 fixture

```csharp
// 已有（TemplateServiceTests 静态字段）
public static readonly Guid FamilyA = Guid.NewGuid();
public static readonly Guid FamilyB = Guid.NewGuid();
public static readonly Guid UserA = Guid.NewGuid();
public static readonly Guid UserOther = Guid.NewGuid();
public static readonly Guid ChildA = Guid.NewGuid();
```

需补充：

- `ChildB`：FamilyB 下的 child UserId（用于跨家庭测试）
- `PresetTemplate1/2/3`：3 个预设模板的 GUID（用于 HostedService 测试）
- `TimeSlotSunday / TimeSlotMonday`：固定时间槽样本（用于 7 天边界）
- `LongName` / `LongNotes` / `LongLocation`：50/500/100 字符边界样本

### 6.2 前端测试 mock

已有 `app/__tests__/helpers/template-mock.js`，需在以下场景覆盖更多 mock：

- 50 字符 name 的 mock
- 重名错误的 mock（`error: 'TEMPLATE_DUPLICATE_NAME'`）
- 7 项 timeSlots 的 mock
- 软删后的 mock（应用层仍可访问但 list 不返回）
- preset template 的 mock（`isPreset: true`）

---

## 7. data-id 可测试性契约清单

### 7.1 已有 data-id（已被现有 WXML data-id 测试覆盖）

| 页面/组件 | data-id | 测试文件 |
|------|------|------|
| `template-list` | `template-list-search-input`, `template-list-add-btn`, `template-list-empty-add-btn`, `template-list-preset-section`, `template-list-custom-section`, `template-list-{preset,custom}-row-{templateId}` | template-list.test.js |
| `template-detail` | `template-detail-edit-btn`, `template-detail-delete-btn`, `template-detail-use-btn` | template-detail.test.js |
| `template-create` | 引用 `schedule-form` 组件 4 prop | template-create.test.js |
| `use-template-dialog` | `use-template-dialog-child-picker`, `use-template-dialog-start-date-picker`, `use-template-dialog-confirm-btn`, `use-template-dialog-cancel-btn`, `use-template-dialog-name-input`, `use-template-dialog-notes-input` | use-template-dialog.test.js |
| `schedule-form` | `schedule-form-type-{afterschool,daily,homework}`, `schedule-form-name-input`, `schedule-form-notes-input`, `schedule-form-location-input`, `schedule-form-repeat-end`, `schedule-form-due-date`, `schedule-form-suggest-start`, `schedule-form-suggest-end`, `schedule-form-child-{...}`, `schedule-form-start-date` | schedule-form.test.js |
| `schedule-create` | `schedule-create-from-template-btn` | schedule-create-from-template.test.js |
| `schedule-detail` | `schedule-detail-save-as-template-btn` | schedule-detail-save-as-template.test.js |

### 7.2 建议补充的 data-id（test-writer 可选）

| 位置 | 建议 data-id | 用途 |
|------|-------------|------|
| `use-template-dialog` | `use-template-dialog-location-input` | 覆盖 location 输入 |
| `use-template-dialog` | `use-template-dialog-timeslot-edit-btn` | 覆盖时间槽编辑入口 |
| `template-detail` | `template-detail-usage-count` | 使用次数展示节点 |
| `template-list` | `template-list-empty-state` | 空态文案容器 |

---

## 8. 缺失 / 阻塞项标记

### 8.1 阻塞项（必须解决才能进入 test-runner）

| 项 | 风险 | 缓解 |
|----|------|------|
| **HostedService 无测试** | 3 个预设模板可能缺失或重复，主代理执行时无法验证 | test-writer 必须先补 `TemplateSeedHostedServiceTests.cs`（T-H01~T-H08） |
| **Update/Delete Controller 无测试** | 端点层 403/404 路径未覆盖，错误码透传未验证 | test-writer 必须补 T-C01~T-C06 |
| **Validator 无独立测试** | 字段长度边界（50/500/100）失败路径只通过 Controller 间接验证 | test-writer 必须补 T-V01~T-V09 |

### 8.2 非阻塞项（建议补全）

- CreateAsync 字段长度边界（50/500/100）的 Service 层断言（T-S04~T-S07）
- 软删幂等性（T-S10）
- 前端 location/timeSlots 覆盖输入（F-UT01/F-UT02）
- 完整回跳流程（F-SC01）
- 重名错误 toast（F-TC01）

### 8.3 已知文档不一致（不影响测试，但需后续 design 修复）

- `errors.json` 中 `CHILD_ACCESS_DENIED` message 为 "孩子角色无权访问模板"，与 spec 中部分 scenario 的 "孩子角色不能创建模板" 措辞略不同。**测试以 errors.json 为准**（前端 parity 测试已锁定）。

---

## 9. 风险点

| # | 风险 | 影响 | 测试缓解 |
|---|------|------|----------|
| 1 | HostedService 启动失败阻塞应用 | 3 个预设缺失 | T-H01~T-H08 验证幂等 + 失败不抛 |
| 2 | 跨家庭访问绕过权限 | 数据泄露 | 已有 T-S10（Delete）+ T-S11/T-S12 补充 |
| 3 | 字段长度边界 50/500/100 漏检 | DB 异常或前端截断 | T-S04~T-S07 + T-V01~T-V05 |
| 4 | timeSlot startTime >= endTime 漏检 | 数据无效 | T-S08/T-S09 补充 |
| 5 | update/delete 后已生成日程被影响（违反"复制"语义） | 数据丢失 | spec scenario "Edit/delete does not affect schedules" 需有集成测试覆盖（建议 test-writer 补一个 `ApplyAsync_AfterTemplateEdited_ScheduleRetainsOriginalName`） |
| 6 | SourceTemplateId 索引缺失导致 usageCount 慢查询 | 删除弹窗延迟 | 已有 T-S 18（GetByIdAsync_UsageCount）+ 索引在 Migration 阶段验证 |
| 7 | schedule-form 4 mode 回归导致现有创建日程流程破损 | 高 | schedule-form.test.js 23 个用例覆盖 4 mode 行为 |
| 8 | 重名校验并发场景（两个家长同时创建同名） | 数据脏 | T-S 已有 + Service 层 `TEMPLATE_DUPLICATE_NAME` 抛 DomainException |

---

## 10. 执行策略（主代理 Stage 4 流程）

### 10.1 阶段顺序

```
1. test-writer 按 §5 清单补全后端 + 前端测试
   - 后端：在 TemplateServiceTests.cs / TemplateControllerTests.cs 追加
   - 新建：TemplateSeedHostedServiceTests.cs / ValidatorTests.cs
   - 前端：在现有 5 个 .test.js 文件追加 test()
2. test-reviewer 审查新增测试
3. 主代理直接执行（不走 test-runner agent，小程序分支）：
   - cd api && dotnet test --filter "FullyQualifiedName~Template" --logger "console;verbosity=normal"
   - cd app && npx jest __tests__/contracts __tests__/services __tests__/components __tests__/pages __tests__/templates
4. 收集失败 → 分类（真实 bug / 环境问题 / 脚本错误 / flaky）
5. 修复后重跑
6. 生成 test-report.md
7. 人审批 → 归档
```

### 10.2 验收门（人审批前必须满足）

- [ ] 后端所有 [Fact] 通过（应有 ≥ 35 个，含补充后）
- [ ] 前端所有 [test] 通过（应有 ≥ 123 个，含补充后）
- [ ] 后端 xUnit 覆盖率（Template 模块）≥ 80%
- [ ] 前端 `app/__tests__/contracts/template.test.js` parity 100%
- [ ] 冒烟测试 7 个全过
- [ ] 无 flaky 标记
- [ ] 失败用例 ≤ 1 项且为已知 skip

### 10.3 报告模板

主代理在 `openspec/changes/add-template-module/test-report.md` 写入：

```markdown
# Test Report: 模板系统模块

## 执行概览
- 后端：x test passed / y test failed (z skipped)
- 前端：a test passed / b test failed (c skipped)
- 总耗时：N 分 N 秒

## 新增测试
- 后端：N 个新 [Fact]（列出文件）
- 前端：N 个新 [test]（列出文件）

## 失败分类
| # | 测试 | 类别 | 处理 |
|---|------|------|------|
| 1 | XXX | 真实 bug | 修复后通过 |
| 2 | YYY | flaky | 重跑通过 |

## 覆盖率
- TemplateService：XX%
- TemplateController：XX%
- 前端 pages/template-*：XX%

## 结论
- ✅ 通过 / ⚠️ 通过但有 flaky / ❌ 未通过
```

---

## 附录 A：现状对账（测试角度）

| 已有测试 | 用途 | 复用 | 新增 |
|----------|------|:---:|:---:|
| `api/Template/Controllers/__tests__/TemplateControllerTests.cs` | 端点编排测试 | 复用 | 补 6 个 |
| `api/Template/Services/__tests__/TemplateServiceTests.cs` | 核心服务测试 | 复用 | 补 12 个 |
| `api/Template/Services/TemplateSeedHostedService.cs` | 种子服务 | **新建测试** | 8 个 |
| `api/Template/Validators/*RequestValidator.cs` | 3 个 Validator | **新建测试** | 9 个 |
| `app/__tests__/contracts/template.test.js` | 契约 parity | 复用 | 0 |
| `app/__tests__/services/template.test.js` | API service | 复用 | 0-2 |
| `app/__tests__/components/schedule-form.test.js` | 表单组件（4 mode） | 复用 | 3 |
| `app/__tests__/components/use-template-dialog.test.js` | 使用模板弹窗 | 复用 | 4 |
| `app/__tests__/pages/template-list.test.js` | 列表页 | 复用 | 3 |
| `app/__tests__/pages/template-detail.test.js` | 详情页 | 复用 | 0 |
| `app/__tests__/pages/template-create.test.js` | 创建/编辑页 | 复用 | 2 |
| `app/__tests__/pages/schedule-create-from-template.test.js` | 从模板创建入口 | 复用 | 1 |
| `app/__tests__/pages/schedule-detail-save-as-template.test.js` | 保存为模板 | 复用 | 0 |
| `app/__tests__/templates/template-smoke.test.js` | 全链路冒烟 | 复用 | 0 |

## 附录 B：测试用例编号对照表（test-writer 实现时引用）

后端 T-S01~T-S15 / T-C01~T-C06 / T-H01~T-H08 / T-V01~T-V09 = **35 个新 [Fact]**
前端 F-SF01~F-SF03 / F-UT01~F-UT04 / F-TL01~F-TL03 / F-TC01~F-TC02 / F-SC01 = **13 个新 [test]**

**总计补充约 48 个新用例**。
