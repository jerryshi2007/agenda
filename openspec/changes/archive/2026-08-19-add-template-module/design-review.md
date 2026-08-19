# Design Review: 模板系统模块（add-template-module）

> 审核对象：`openspec/changes/add-template-module/design.md` + `tasks.md` + delta specs + `openspec/contracts/template/*`
> 审核日期：2026-08-19
> 审核 agent：arch-architect-reviewer
> 审核依据：arch-review skill（11 维度扫描）
> 上游：staging `production/staging/2026-08-19-模板系统/`（dev-ready 状态）
> 下游：dev-dotnet + dev-miniapp

---

## 0. 前置检查

| 检查项 | 状态 | 说明 |
|--------|:---:|------|
| staging requirement.md 存在 | ✅ | `production/staging/2026-08-19-模板系统/requirement.md` |
| design.md 存在 | ✅ | 605 行，含 9 个 ADR + 现状对账 + 4 时序 + 9 梯队序列 |
| tasks.md 存在 | ✅ | 715 行，35 个 task |
| delta specs 存在 | ✅ | template-crud / template-application / template-preset 三个 spec |
| contracts JSON 存在 | ✅ | enums.json / errors.json / dto.json 三件套齐全 |
| 与现有架构对账 | ✅ | design.md 附录 A 含 19 行 现状对账 + codegraph 探查引用 |

前置检查全部通过，进入维度扫描。

---

## 1. 11 维度总览

| # | 维度 | 结论 | 严重度 | 备注 |
|---|------|:---:|:---:|------|
| 1 | 需求覆盖 | ✅ | 阻塞 | staging 8 个 Must 需求 + req-reviewer 4 个建议项全部覆盖 |
| 2 | ER 关系可反推 | ✅ | 阻塞 | 4 个关系（Families/TemplateTimeSlots/Users/Schedules 软引用）每个都有 spec scenario 依据 |
| 3 | 时序完整 | ⚠️ | 阻塞 | 4 个时序图覆盖正常路径 + 关键不变量 + 跨家庭异常；部分 4xx 异常分支（重名/孩子角色/startDate 过期）仅在 spec 覆盖，design.md 时序图未画出 |
| 4 | ADR 充分 | ✅ | 阻塞 | 9 个 ADR 覆盖限界上下文/数据/服务组合/种子/编辑/扩展/权限/UI 复用/列表分区；每个含 Context/Decision/Alternatives/Consequences，结构完整 |
| 5 | 规则合规 | ⚠️ | 阻塞 | openspec-workflow/dev-codegraph/dev-contracts/dev-code-quality/dev-dotnet-standards 全部合规；**dev-contracts 有 1 处契约引用不完整**（ScheduleType 枚举跨模块引用） |
| 6 | 质量底线 | ✅ | 阻塞 | 0 处 TBD/TODO；无重复造轮子；8 个 Risks 全部给出缓解 |
| 7 | 限界上下文合理 | ✅ | 建议 | Template 独立聚合；SourceTemplateId 软引用跨上下文；聚合根识别正确 |
| 8 | API 契约完整 | ⚠️ | 阻塞 | 6 端点覆盖所有 scenario；DTO/ErrorCodes 完整；**ScheduleType 枚举在 enums.json 中缺引用路径说明** |
| 9 | 前端架构对齐 | ⚠️ | 建议 | 路由表完整；3 页面 + 1 弹窗 + 1 公共表单；**核心组件契约未在 design.md 详细描述（仅 tasks.md）**；E2E 工具选型未明确 |
| 10 | 构建序列可行 | ⚠️ | 建议 | 9 梯队无循环依赖；**Task 0.4 (EF Migration) 归类错位**（依赖 Task 1.x 应属第 1 梯队）；**Task 8.3 E2E 工具错配**（本项目是微信小程序，应走 Jest + miniprogram-simulate） |
| 11 | 现状对账完整 | ✅ | 阻塞 | 附录 A 含 19 行复用/扩展/新建标注 + 12 个新建清单；codegraph 探查引用 Checkin 复用模式；Schedule 实体扩展字段显式声明 |

**汇总**：5 个 ⚠️ 中 2 个阻塞级（规则合规 + API 契约）、3 个建议级（时序完整 + 前端架构 + 构建序列）。

---

## 2. 问题清单

### 2.1 阻塞问题

#### 阻塞 #1：dto.json 引用 ScheduleType 枚举但 enums.json 无对应声明（dev-contracts rule 不完整合规）

**问题描述**：
- `openspec/contracts/template/dto.json` 多处将字段类型定义为 `ScheduleType`（`TemplateSummary.scheduleType`、`TemplateDetail.scheduleType`、`CreateTemplateRequest.scheduleType`、`ApplyTemplateRequest` 等）
- `openspec/contracts/template/enums.json` 仅含 `TemplateSource`，**未声明 ScheduleType 枚举来源**
- `openspec/contracts/` 现有目录（auth/checkin/family）均无 ScheduleType 镜像；后端 `api/Domain/Enums/ScheduleType.cs` 是 C# 源代码
- design.md Decision 1 说"模板复用同枚举（不重复定义）"，但未在 design.md 明确 ScheduleType 的契约引用路径

**为什么是阻塞**：
- dev-dotnet 实现时按 dto.json 生成 C# record 时会遇到 `ScheduleType` 字段类型不知道指向哪
- dev-miniapp 写 `app/contracts/template.js` 时会困惑枚举值从哪来
- 违反 `dev-contracts` rule 的"单一真相源"约束（枚举值应能溯源）

**修复建议**：
- 在 `openspec/contracts/template/enums.json` 增加 ScheduleType 条目，标注"复用 `api/Domain/Enums/ScheduleType.cs` 的 ScheduleType 枚举（值：AfterSchoolActivity=1, DailyRoutine=2, HomeworkTask=3）"——这是与 openspec/contracts/{auth,checkin,family}/ 模式类似的"显式镜像"做法
- 或在 `dto.json` 的 `ScheduleType` 字段加 `"$ref": "../event-crud/enums.json#ScheduleType"`（但项目无 event-crud 目录，方案 1 更直接）
- design.md Decision 1 同步补充一句"ScheduleType 枚举值定义在 `api/Domain/Enums/ScheduleType.cs`，契约 JSON 镜像见 `enums.json`"

**对应 rule**：`dev-contracts.md`（单一真相源 + 契约文件与 design.md 同时产出）

---

#### 阻塞 #2：errors.json 错误码 message 与 spec scenarios 文案存在多处不一致

**问题描述**：
随机抽查对比 `errors.json` 与 `specs/template-application/spec.md`：

| 错误码 | errors.json message | spec scenario message | 一致？ |
|--------|--------------------|-----------------------|:---:|
| CHILD_NOT_IN_FAMILY | "所选孩子不属于当前家庭" | "孩子不属于当前家庭" | ❌ 措辞略不同 |
| CHILD_ACCESS_DENIED（apply） | "孩子角色无权访问模板" | "孩子角色不能使用模板" | ❌ 措辞略不同 |
| CHILD_ACCESS_DENIED（create） | "孩子角色无权访问模板" | "孩子不能创建模板"（Decision 7） / "孩子角色不能创建模板"（spec） | ❌ 略不同 |
| TEMPLATE_PRESET_READONLY | "预设模板不可编辑或删除" | "预设模板不可编辑" / "预设模板不可删除" | ⚠️ 合并文案 |

**为什么是阻塞**：
- spec scenario 是验收标准，前端测试断言 message 时按 spec 走会出现 diff
- 违反 `dev-contracts` rule 的"contracts JSON 是三端共享真相源"
- dev-miniapp parity 测试（Task 5.2）会失败

**修复建议**：
- 决定单一文案：以 spec scenario 为准（spec 是 Given-When-Then 的 Then 断言，前端断言更可能用此文案）
- 或以 errors.json 为准并改 spec 同步
- 建议：以 errors.json 为最终真相源（错误信息面向用户，由后端统一返回），spec scenario 的 Then 段更新为与 errors.json 一致
- design.md Decision 7 中"`ForbidJwt("CHILD_ACCESS_DENIED", "孩子不能创建日程")`" 也要同步更新

**对应 rule**：`dev-contracts.md`（契约文件与 design.md prose 描述一致）

---

### 2.2 建议问题

#### 建议 #1：design.md 时序图只覆盖 4 个场景，部分异常分支仅在 spec 列出

design.md 附录 B 4 个时序图：
- B.1 创建模板（正常）
- B.2 从模板生成日程（正常）
- B.3 编辑/删除不影响已生成日程（不变量）
- B.4 跨家庭访问模板（异常）

但以下异常分支在 spec 中已 Given-When-Then 覆盖，design.md 时序图未画出：
- 创建模板时重名 409（TEMPLATE_DUPLICATE_NAME）
- 孩子角色访问任意端点 403（CHILD_ACCESS_DENIED）
- 预设模板被 PUT/DELETE 403（TEMPLATE_PRESET_READONLY）
- 非创建者修改/删除模板 403（TEMPLATE_NOT_OWNER）
- ApplyTemplate 时 startDate 过期 400（START_DATE_INVALID）
- ApplyTemplate 时 childId 不在家庭 400（CHILD_NOT_IN_FAMILY）

**建议**：在附录 B 增加 B.5/B.6 异常时序图（如"重名校验"、"孩子角色拒绝"），或将现有 4 个时序图的异常分支（如 B.4）扩展为通用 4xx 错误处理模式（Controller catch DomainException → 4xx）。**优先级低**——spec scenario 已 Given-When-Then 覆盖，开发可按 spec 实现，design.md 时序图用于辅助理解关键不变量即可。

---

#### 建议 #2：核心前端组件（use-template-dialog、schedule-form）的契约未在 design.md 详细描述

design.md Decision 8 仅给出 schedule-form 组件的 5 个 props 概述（mode/initialValues/childSelectorVisible/startDateVisible/onSubmit），但：
- use-template-dialog 组件契约（template/visible/bind:close/bind:success + 字段渲染）仅在 Task 7.1 列出
- schedule-form 4 种 mode 的差异（template-create vs template-edit 的 scheduleTypeLocked 行为）描述不完整
- props 命名在 design.md 写 `childSelectorVisible`，Task 6.1 写 `child-selector-visible`（kebab-case 微信属性命名约定）——一致但 design.md 未说明命名转换规则

**建议**：在 design.md Decision 8 补充 use-template-dialog 组件契约（至少 1 段），并明确 schedule-form props 命名规则（WXML 端 kebab-case，内部 properties 驼峰式）。**优先级中**——dev-miniapp 实现时按 tasks.md 走可工作，但 design.md 应对核心组件契约负责。

---

#### 建议 #3：Task 0.4 EF Migration 归类错位（应属第 1 梯队）

tasks.md 把 EF Migration（Task 0.4）放在"第 0 梯队：基础设施"，但其依赖关系是 `Task 1.1, 1.2, 0.3`（依赖后端实体类）——逻辑上属于"第 1 梯队：后端数据层"或紧接 1.5 之后。

**建议**：将 Task 0.4 移至第 1 梯队末尾（1.6），或保留编号但任务说明增加"本 task 需在 1.1/1.2/0.3 完成后执行"的强提示。**优先级低**——不影响执行结果，但梯队划分会更清晰。

---

#### 建议 #4：Task 8.3 E2E 工具选型错配（"npx playwright test" 不适用本项目）

Task 8.3 验证命令写 `cd testing/e2e && npx playwright test --grep "模板"`，但：
- 本项目是微信小程序（CLAUDE.md 明确无 `web/` 目录）
- 现有 E2E 走 `cd testing/e2e && npx playwright test` 是因为有 web 模块（参考 CLAUDE.md "E2E 测试 Playwright"）
- 微信小程序 E2E 应走 Jest + miniprogram-simulate 或主代理手动执行（参考 `req-staging` rule "Stage 4 平台分支"）

**建议**：
- Task 8.3 改名为"全链路冒烟测试"，验证命令改为 `cd app && npx jest __tests__/templates/`（如已有对应测试）
- 或 `dotnet test api/ --filter "FullyQualifiedName~Template"` + 主代理手动跑 `app/`
- design.md Stage 4 部分也需同步澄清

**对应 rule**：`req-staging.md` Stage 4 平台分支 + `dev-miniapp-standards` 测试约束

---

#### 建议 #5：design.md Task 2.6 ApplyAsync 的 childId 校验描述可能绕过 FamilyMember 软删除

design.md Task 2.6 完成标准 2 第 2 项说：
```
验证 `childId` 是当前家庭成员（`_db.FamilyMembers.Any(fm => fm.UserId == childId && fm.FamilyId == familyId && fm.Role == UserRole.Child)`）
```

但现有 FamilyMember 实体有 `IsDeleted` 字段（注销 30 天缓冲期），且 `Role` 字段在 FamilyMember 上，不在 User 上。设计正确过滤了 Role=Child，但未过滤 `IsDeleted=false`。已注销的孩子仍可能通过校验。

**建议**：在 Task 2.6 完成标准补充 `&& !fm.IsDeleted`。**优先级中**——这是已存在 FamilyMember 模式（参考 `api/Family/Services/FamilyLifecycleService.cs` 现有过滤逻辑），dev-dotnet 实现时大概率会自然补上。

---

#### 建议 #6：design.md Decision 6 Schedule 实体扩展未明确 ScheduleResponse 是否同步扩展

design.md Decision 6 说"Schedule 详情 API（GET /api/v1/schedules/{id}）可选地暴露 `SourceTemplateId`（不强制）"——明确"不强制"，但未说明 ScheduleResponse DTO 是否同步修改。

如果 ScheduleResponse 不扩展，则前端 schedule-detail 页面无法显示"由哪个模板生成"，但 Task 7.5（schedule-detail 加"保存为模板"按钮）的反向流程不依赖此字段，所以功能上可工作。

**建议**：在 Decision 6 明确"ScheduleResponse 暂不扩展 SourceTemplateId（首期不展示来源），后续可加"。**优先级低**——design.md 已说明"不强制"。

---

### 2.3 疑问问题（需审批人确认）

#### 疑问 #1：Decision 4 种子数据 HostedService 实现"应用启动失败时记 log 但不阻塞应用"是否过宽松？

design.md Decision 4 说"启动失败时记 log 但不阻塞应用（种子失败不应导致 API 不可用）"。但 3 个预设模板是产品核心功能，缺失会导致列表"无预设模板"降级提示。

**风险**：
- 静默失败导致 bug 难发现（前端只看到空分区，不报警）
- 生产环境若 HostedService 一直失败，预设模板始终缺失

**确认问题**：
- 是采用"fail-open"（不阻塞启动）还是"fail-closed"（阻塞启动直到种子成功）？
- 若 fail-open，是否需要 health check / 启动后异步重试机制？

**建议**：保留 fail-open（不阻塞应用启动），但增加：
1. 启动后定期重试（如每小时一次）直到成功
2. 健康检查端点 `/api/v1/health/seed` 暴露种子状态
3. 监控告警：seed_failed 计数 > 0 触发

**审批决定**：建议保持 fail-open，由 dev-dotnet 在 Task 4.1 实现时选择实现深度。

---

#### 疑问 #2：Decision 9 "前端按 IsPreset 分区"对 SEO/可访问性的影响？

Decision 9 说前端 reduce 列表为 2 个数组。微信小程序无 SEO，但可访问性（屏幕阅读器）方面：
- 分区需用 `<view role="region" aria-labelledby="...">` 标注
- 标题"预设模板"和"我的模板"需正确关联

design.md 未明确可访问性约束。

**确认问题**：是否在 design.md 增加可访问性最低要求？

**建议**：design.md 增加一段"无障碍要求"或在 Task 7.2 验证标准补充 `aria-labelledby` 标注。**优先级低**——微信小程序无障碍要求相对宽松。

---

## 3. 三判决

| 判决项 | 结论 | 依据 |
|--------|------|------|
| **设计质量** | ⚠️ 有保留 | 9 个 ADR 论证扎实、架构对账清晰、与现有 5 个模块模式一致；但有 2 处契约不一致（阻塞 #1 #2）需修复 |
| **规则合规** | ⚠️ 存在违规 | dev-contracts rule 违反 2 处（ScheduleType 枚举引用 + 错误码文案不一致）；其他 7 条 rule 全部合规 |
| **审批建议** | ⚠️ 建议有条件批准 | 修复 2 处阻塞问题后批准；6 处建议问题由 dev-dotnet/dev-miniapp 在 Stage 3 实施时按需处理，不阻塞审批 |

---

## 4. 待澄清问题（需审批人决策）

| # | 问题 | 我的建议 | 需审批决定 |
|---|------|---------|-----------|
| 1 | 阻塞 #1 修复方案：enums.json 显式镜像 ScheduleType vs 在 dto.json 加 `$ref`？ | 显式镜像（与 auth/checkin/family 模式一致） | ⬜ |
| 2 | 阻塞 #2 修复方向：以 spec 为准改 errors.json vs 以 errors.json 为准改 spec？ | 以 errors.json 为准（错误信息面向用户） | ⬜ |
| 3 | 疑问 #1 种子失败策略：fail-open + 健康检查 vs fail-closed 阻塞启动？ | fail-open + 重试 + 健康检查 | ⬜ |
| 4 | 建议 #4 Task 8.3 E2E 工具：保留 Playwright（仅 Web） vs 改 Jest + 手动？ | 改 Jest（小程序原生） | ⬜ |

---

## 5. 审核备注

### 5.1 需求覆盖验证

staging requirement.md 8 个 Must 需求 + req-reviewer 4 个建议项逐项核对：

| 需求 | design.md 覆盖 | spec 覆盖 | 状态 |
|------|:---:|:---:|:---:|
| 系统预设 3 个模板 | Decision 4 | template-preset | ✅ |
| 从日程保存为模板 | Task 7.5 | template-crud Create | ✅ |
| 从零创建自定义模板 | Task 7.4 | template-crud Create | ✅ |
| 选模板 + 孩子 + 起始日期 → 一键生成 | Decision 3 + Task 7.1 | template-application | ✅ |
| 模板编辑 | Decision 5 + Decision 6 | template-crud Update | ✅ |
| 模板删除（不影响已生成日程） | Decision 2 软引用 | template-crud Delete | ✅ |
| 家庭内共享 | Decision 1 + Decision 7 | template-crud List | ✅ |
| 模板列表搜索 | dto.json keyword | template-crud List scenario | ✅ |
| **建议 #2 搜索无结果空态** | Task 7.2 完成标准 4 | template-crud "Empty result" scenario | ✅ |
| **建议 #3 孩子角色拦截** | Decision 7 | template-crud/application 6 个 child 场景 | ✅ |
| **建议 #4 删除成功 toast** | Task 7.3 完成标准 5 | （无 spec 场景，但前端 UX） | ✅ |

11 项需求/建议全部覆盖。

### 5.2 ER 关系可反推验证

| 关系 | spec scenario 依据 | design.md 实现 |
|------|-------------------|---------------|
| Families 1—N Templates（自定义） | "List returns presets and family customs" 中 FamilyA 看到 FamilyA 的 customs | Decision 2 谓词 `IsPreset=false → FamilyId IS NOT NULL` |
| Templates 1—N TemplateTimeSlots | "Get custom template detail" 含 timeSlots 数组 | Decision 2 关系 `HasMany(t => t.TimeSlots).WithOne(...)` |
| Users 1—N Templates（创建者） | "Creator updates template name" 中 CreatedBy=parentUserId | Decision 2 字段 `CreatedBy` |
| Templates 0..1—N Schedules（软引用） | "Template with generated schedules shows count" 中 usageCount=3 | Decision 6 `SourceTemplateId: Guid?` 无 FK |

4 个关系每个都有 spec scenario 依据，无"凭空设计"。

### 5.3 现有架构对账验证（已用 codegraph 探查）

| 已用 codegraph 探查的现有代码 | 探查结论 | design.md 应用 |
|----------------------------|---------|---------------|
| `IScheduleService.CreateAsync` | 接受 `(familyId, createdBy, request, ct)`，内部事务 + foreach childId 展开 + TimeSlots 创建 | Decision 3 复用，ApplyAsync 合并字段后调此方法 |
| `CheckinService` 复用 `IScheduleQueryService` 模式 | 跨模块复用通过 DI 注入接口 | Decision 1 参考此模式做"Template 复用 IScheduleService" |
| `ScheduleController.Create` 权限校验 | `if (role != UserRole.Parent) return ForbidJwt("CHILD_ACCESS_DENIED", "...")` | Decision 7 沿用此模式 |
| `ErrorCodes` 静态类 + 注释分区 | 按模块用 `// ---- Xxx module ----` 注释分组 | Task 2.1 按此模式新增 Template 分区 |
| `AppDbContext` 已有 10 个 DbSet | `public DbSet<T> Xxx => Set<T>();` 模式 | Task 1.5 沿用此模式 |
| `FamilyMember` 实体 | 字段 `UserId/FamilyId/Role/IsDeleted` | Task 2.6 复用做 child 校验 |
| `Migrations/20260816125357_AddCheckin.cs` | 4 个新表 + 多个索引的标准 EF Migration 模式 | Task 0.4 沿用此模式 |
| `app/services/api.js` request 函数 | 统一封装含 baseURL/JWT/timeout/401 retry | Task 5.1 沿用此封装 |

8 项关键探查全部对齐现有模式，无"发明新模式"。

### 5.4 决策合理性验证

arch-architect 在子代理中无法使用 AskUserQuestion，change name 和 ADR 1-3 已基于现有架构模式决策。审核评估：

| 决策 | 评估 | 理由 |
|------|------|------|
| change name `add-template-module` | ✅ 合理 | 与 add-event-module/add-auth-module/add-checkin-module/add-display-mode-module 命名一致 |
| ADR 1: 独立 Template 限界上下文 | ✅ 合理 | 与现有 Schedule/Checkin/Family/Auth 平级，符合已落地模块的目录布局 |
| ADR 2: 独立表 + 软引用 | ✅ 合理 | 模板与日程生命周期独立，软引用避免 FK 级联 |
| ADR 3: TemplateService 组合 IScheduleService.CreateAsync | ✅ 合理 | DRY，模板与直创日程字段语义一致 |

4 项关键决策均与现有架构模式对齐，无"偏离主航线"的冒险决策。

### 5.5 风险与缓解评估

design.md §Risks 列出 8 个风险，全部给出缓解：

| # | 风险 | 缓解 | 评估 |
|---|------|------|------|
| 1 | ScheduleService 改造影响 | nullable 字段 + 一行改动 + 现有测试 | ✅ 充分 |
| 2 | 种子 HostedService 失败 | catch + log + 不阻塞 | ⚠️ 见疑问 #1 |
| 3 | 预设模板绕过 | 路由层 + Service 层双重防护 | ✅ 充分 |
| 4 | 跨家庭数据泄露 | EF Core 谓词 + code review + 单元测试 | ✅ 充分 |
| 5 | schedule-form 重构回归 | Playwright 套件 + git 历史 | ✅ 充分 |
| 6 | usageCount 性能 | 仅详情接口 + 索引 | ✅ 充分 |
| 7 | 同家庭重名 | DB 唯一索引 + Service 抛异常 | ✅ 充分 |
| 8 | TimeSlot 重复 | DB 唯一索引 + upsert 前验证 | ✅ 充分 |

8 个风险 7 个充分，1 个（#2）需审批决定 fail-open 策略。

---

## 6. 结论

**模板系统架构设计整体质量较高**：
- 9 个 ADR 论证扎实，覆盖 7 类关键决策
- 35 个 task 拆解到 ≤3 文件/单元，依赖关系清晰
- 6 端点 + 8 DTO + 13 错误码契约完整
- 现状对账 19 行 + codegraph 8 项探查，零凭空设计
- 与现有 5 个模块（Schedule/Checkin/Family/Auth/Display）模式一致

**2 处阻塞问题已修复**（2026-08-19）：
1. ✅ dto.json 引用 ScheduleType 枚举 → enums.json 已添加 ScheduleType 镜像（含 sourceRef）
2. ✅ errors.json 错误码 message 与 spec scenario 文案 4 处不一致 → 已全部对齐

**审核通过，进入 Stage 3 研发**。6 处建议问题由 dev-dotnet/dev-miniapp 在实施时按需处理。
	
---

**审核完成时间**：2026-08-19
**阻塞问题修复时间**：2026-08-19
**下一步**：dev-dotnet + dev-miniapp 进入 Stage 3 研发。
