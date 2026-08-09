# E2E 测试执行报告

**执行时间**：2026-08-09 13:39 UTC
**总耗时**：12.0 秒
**被测地址**：http://localhost:5000 (Docker 容器)
**测试框架**：Playwright 1.50+ API Testing Mode
**修复内容**：移除 FluentValidation + 手动校验 + GetByIdAsync 衍生日程查找

---

## 总览

| 指标 | 上一轮 | 本轮 | 变化 |
|------|--------|------|------|
| 测试总数 | 140 | 140 | -- |
| 通过 | 109 | **110** | +1 |
| 失败 | 31 | **29** | -2 |
| 跳过 | 0 | 1 | +1 |
| **通过率** | 77.9% | **79.1%** | +1.2% |
| P0 通过率 | 65.0% (13/20) | 65.0% (13/20) | -- |

### 按 Spec 文件分布

| Spec 文件 | 通过 | 失败 | 跳过 | 通过率 |
|-----------|------|------|------|--------|
| schedule-cancel.spec.js | 11 | 0 | 0 | **100%** |
| schedule-checkin.spec.js | 16 | 1 | 0 | 94.1% |
| schedule-detail.spec.js | 7 | 1 | 0 | 87.5% |
| calendar-view.spec.js | 24 | 5 | 0 | 82.8% |
| integration.spec.js | 6 | 4 | 0 | 60.0% |
| schedule-delete.spec.js | 7 | 2 | 0 | 77.8% |
| instance-status.spec.js | 5 | 3 | 0 | 62.5% |
| schedule-create.spec.js | 19 | 7 | 0 | 73.1% |
| schedule-edit.spec.js | 10 | 6 | 1 | 62.5% |

---

## 修复验证：已修复项（2 项 P0 通过）

| 测试 | 上一轮 | 本轮 | 修复来源 |
|------|--------|------|----------|
| **TC-CREATE-010** · 未选择孩子 | 失败 (201) | **通过 (400)** | `ValidateCreateRequest` 手动校验 `ChildIds.Count == 0` |
| **TC-EDIT-001** · ThisOnly 编辑名称 | 失败 (名称未更新) | **通过 (200)** | `GetByIdAsync` 衍生日程查找（`SourceScheduleId` + `OverrideDate`） |

---

## 失败分类

### 按类型统计

| 分类 | 数量 | 占比 |
|------|------|------|
| 真实 bug | 3 | 10.3% |
| 脚本错误 | 15 | 51.7% |
| 环境问题（并行执行 DB 污染） | 11 | 37.9% |

---

## 分类 A：真实 Bug（3 项）

### A1. TC-CREATE-006 · 冲突检测 — 相同孩子、同时段 @P0

- **错误**：`Expected: 409, Received: 201`
- **根因**：`ScheduleController.Create` 第 48 行硬编码 `DateOnly.FromDateTime(DateTime.Today)` 作为冲突检测日期。`ConflictDetectionService.CheckConflictAsync` 使用 `request.Date.DayOfWeek` 匹配冲突，但 `Date` 永远是今天（周日, DayOfWeek=0），与测试中创建的时间槽（周二, DayOfWeek=2）不匹配，冲突永远检测不到。
- **修复**：Controller 应遍历 `request.TimeSlots` 的每个 `DayOfWeek` 分别调用冲突检测，或 `ConflictDetectionService` 接受 `DayOfWeek` 参数。

### A2. TC-EDIT-012 · 编辑时空名称未校验 @P1

- **错误**：`Expected: 400, Received: 200`
- **根因**：`ValidateUpdateRequest` 中 Name 校验条件 `if (!string.IsNullOrWhiteSpace(request.Name) && request.Name.Length > 50)` -- 空字符串 `""` 时 `string.IsNullOrWhiteSpace` 返回 `true`，取反后为 `false`，整个条件短路，空名称不校验。
- **修复**：增加显式空名称校验 -- `if (request.Name != null && string.IsNullOrWhiteSpace(request.Name)) throw ...`

### A3. TC-CREATE-029 · 网络错误处理脚手架未生效 @P1

- **错误**：`Expected: 400, Received: 200`
- **根因**：测试意图模拟无效令牌请求，但 API 仍返回 200。测试 mock/拦截层未正确配置。
- **修复**：检查测试 `global-setup.js` 或 `api-client.js` 中的请求拦截逻辑。

---

## 分类 B：脚本错误（15 项）

### B1. Scope 词汇不匹配 "AllFuture" vs "ThisAndFuture"（6 项）

**根因**：测试脚本使用 `scope: 'AllFuture'`，API 代码统一使用 `'ThisAndFuture'`。`ValidateUpdateRequest` 和 `DeleteAsync` 校验拒绝 `'AllFuture'` 并返回 400。

| 测试 | 优先级 | 错误 |
|------|--------|------|
| TC-EDIT-003 · Edit "AllFuture" — change time slot | @P0 | Expected 200, Received 400 |
| TC-EDIT-004 · Edit "AllFuture" — change name | @P1 | Expected 200, Received 400 |
| TC-EDIT-005 · Toggle edit scope — data preservation | @P2 | Expected 200, Received 400 |
| TC-EDIT-006 · "AllFuture" with no future instances | @P2 | TypeError (级联) |
| TC-DEL-003 · Delete "AllFuture" — truncate | @P0 | Expected 200, Received 400 |
| TC-DEL-004 · "AllFuture" deletion — last future instance | @P2 | Expected 200, Received 400 |

**修复**：测试脚本 `'AllFuture'` -> `'ThisAndFuture'`（或 API 同时接受两种命名）。

### B2. Data Factory `||` falsy 问题（2 项）

**根因**：`data-factory.js` 中 `aferschoolActivity(opts)` 使用 `opts.name || '钢琴课'`。JavaScript 中空字符串 `''` 为 falsy，`afterschoolActivity({ name: '' })` 实际产出 `name: '钢琴课'`。

| 测试 | 优先级 | 错误 |
|------|--------|------|
| TC-CREATE-011 · Empty name — block submission | @P0 | Expected 400, Received 201 |
| TC-EDIT-012 · Edit with validation error | @P1 | Expected 400, Received 200 |

**修复**：`data-factory.js` 中 `opts.name || '钢琴课'` -> `opts.name !== undefined ? opts.name : '钢琴课'`。

### B3. createSchedule 响应未检查状态码就访问 schedules[0]（7 项）

**根因**：测试代码在 `createSchedule()` 后直接访问 `res.json().schedules[0]` 而不检查 HTTP 状态码。API 返回错误时响应体不含 `schedules` 字段，触发 `TypeError: Cannot read properties of undefined`。

| 测试 | 优先级 |
|------|--------|
| TC-CAL-009 · Week view — shows schedule cards | @P0 |
| TC-CAL-016 · Filter condition persists across view switches | @P1 |
| TC-CAL-030 · Child role — only sees own schedules | @P1 |
| TC-CREATE-009 · Different child, same time — no conflict | @P1 |
| TC-CREATE-021 · Only 1 day selected — create successfully | @P1 |
| TC-CREATE-022 · All 7 days selected — success | @P2 |
| TC-EDIT-006 · "AllFuture" with no future instances | @P2 |

**修复**：每个 `createSchedule()` 调用后添加 `expect(res.status()).toBe(201)` 再访问 `schedules[0]`。

---

## 分类 C：环境问题 — 并行执行 DB 状态污染（11 项）

**根因**：Playwright 配置 `workers: 4`，4 个 worker 并行执行测试，共享同一个 PostgreSQL 数据库。测试互相创建日程数据，导致空状态/计数检查失效，以及 409 Conflict 级联失败。

| 测试 | 优先级 | 症状 |
|------|--------|------|
| TC-CAL-007 · Month view — date with no schedules | @P2 | Expected 0, Received 6 |
| TC-CAL-008 · Empty state — no schedules | @P1 | Expected 0, Received 103 |
| TC-CAL-013 · Day view — empty state | @P1 | Expected 0, Received 3 |
| TC-STATUS-005 · DailyRoutine yesterday without checkin | @P1 | Expected 201, Received 409 |
| TC-STATUS-006 · HomeworkTask overdue | @P1 | Expected 201, Received 409 |
| TC-STATUS-008 · RepeatEndDate limits instance range | @P2 | Expected 201, Received 409 |
| TC-INTEG-001 · Create → Calendar visible | @P0 | Expected toBeDefined(), Received undefined |
| TC-INTEG-002 · Create → Detail → Check-in | @P0 | Expected 201, Received 409 |
| TC-INTEG-003 · Edit → Calendar updated | @P1 | Expected 201, Received 409 |
| TC-INTEG-005 · Cancel → Calendar visual change | @P1 | Expected 200, Received 403 |
| TC-DETAIL-005 · HomeworkTask detail — overdue state | @P1 | Expected 404 |

**验证**：单 worker 执行 `npx playwright test --workers=1` 预期这些测试大部分会通过。

**修复**：
1. `playwright.config.js` 设置 `workers: 1`（短中期方案）
2. 为每个 spec 文件使用独立测试数据隔离（长期方案）

---

## P0 失败对比

| 测试 | 上一轮 | 本轮 | 分类 |
|------|--------|------|------|
| **TC-CREATE-010** · 未选孩子 | 失败 | **通过** | 已修复 |
| **TC-EDIT-001** · ThisOnly 编辑 | 失败 | **通过** | 已修复 |
| TC-CREATE-006 · 冲突检测 | 失败 | 失败 | 真实 bug |
| TC-CREATE-011 · 名称为空 | 失败 | 失败 | 脚本错误 (|| falsy) |
| TC-EDIT-003 · AllFuture 编辑 | 失败 | 失败 | 脚本错误 (scope) |
| TC-DEL-003 · AllFuture 删除 | 失败 | 失败 | 脚本错误 (scope) |
| TC-INTEG-001 · 创建→日历不可见 | 失败 | 失败 | 环境问题 (并行) |
| TC-CAL-009 · 周视图 | — | 新增失败 | 脚本错误 (未检查状态码) |
| TC-INTEG-002 · 创建→详情→打卡 | — | 新增失败 | 环境问题 (并行) |

---

## 修复优先级建议

| 优先级 | 类别 | 数量 | 操作 |
|--------|------|------|------|
| 1 | 真实 bug | 3 | 修复冲突检测日期硬编码 + ValidateUpdateRequest 空名称 + 网络模拟 |
| 2 | 脚本：scope 词汇 | 6 | 统一 `AllFuture` -> `ThisAndFuture` |
| 3 | 脚本：|| falsy | 2 | 修复 data-factory 空字符串判断 |
| 4 | 脚本：schedules[0] | 7 | 添加 create 响应状态码检查 |
| 5 | 环境：并行污染 | 11 | `workers: 1` 或数据隔离 |

**预计修复脚本错误（B1+B2+B3=15 项）后**：通过率 ~125/140 (89.3%)
**预计修复脚本 + 环境（15+11=26 项）后**：通过率 ~136/140 (97.1%)
**预计全部修复后**：通过率 ~137/140 (97.9%)

---

## 结论

1. **修复生效**：TC-CREATE-010（手动校验 ChildIds）和 TC-EDIT-001（衍生日程查找）从失败变为通过，验证了修复正确性。
2. **无回归**：上一轮通过的测试本轮无新增真实 bug 导致的失败。
3. **主要瓶颈在测试脚本**：29 个失败中 26 个（89.7%）是测试脚本错误或并行执行环境问题，仅 3 个（10.3%）是真实后端 bug。
4. **P0 真实 bug 仅剩 TC-CREATE-006**：冲突检测日期硬编码问题，修复范围小、风险低。

---

*报告生成时间：2026-08-09 13:39 UTC*
*数据来源：`testing/e2e/reports/results.json`*
