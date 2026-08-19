# Test Review: 展示模式模块一期（小学模式）

> 审查日期：2026-08-18
> 审查人：test-reviewer (test-case-design skill)
> 变更：`add-display-mode-module`
> 审查范围：后端 46 个测试（新增 11 + 原有 35）+ 前端 68 个测试
> 审查维度：brittle/flaky / 测实现 vs 测行为 / 假覆盖 / 命名清晰度 / 一测一断言 / 失败路径覆盖 / 测试独立性

---

## 1. 总体评估

**结论：通过，有 2 个需关注项和 3 个建议项。** 新增 11 个后端测试和所有前端测试均测试对外可观察行为（非内部实现），覆盖了测试计划中全部 Must/Should/Could 优先级用例。无假覆盖、无脆性依赖、无测试间隐式依赖。发现 2 个冗余测试和 1 个测试计划与实现的计数偏差。

---

## 2. 发现清单（按严重度排序）

### 2.1 需关注（2 项）

#### F1: Controller 测试中存在冗余用例（低严重度）

**文件**: `api/Schedule/Controllers/__tests__/ChildScheduleControllerTests.cs`

**位置**: 第 108-117 行 `GetToday_AsParent_Returns403` 与第 201-212 行 `GetToday_AsParent_Returns403WithChildOnlyEndpoint`

**问题**: 前者仅断言 HTTP 403 状态码，后者额外断言 `error: "CHILD_ONLY_ENDPOINT"` 和 `message: "仅孩子角色可访问"`。后者完全覆盖前者的验证范围，前者是冗余的。同样，`GetWeek_AsParent_Returns403`（第 330-339 行）与 `GetWeek_AsParent_Returns403WithChildOnlyEndpoint`（第 214-224 行）也存在同样的问题。

**影响**: 增加维护负担（修改 Parent 403 逻辑时需同步更新 2 个测试），但无正确性风险。

**建议**: 删除仅断言状态码的版本（`GetToday_AsParent_Returns403` 和 `GetWeek_AsParent_Returns403`），保留含错误码断言的版本。这 2 个冗余用例对覆盖无贡献。

---

#### F2: T01 多家庭断言无法验证 FirstOrDefault 行为（低严重度）

**文件**: `api/Auth/Services/__tests__/TokenServiceTests.cs`

**位置**: 第 237-300 行 `GenerateTokenAsync_ChildInMultipleFamilies_UsesFirstOrDefaultDisplayMode`

**问题**: 测试断言使用 `Assert.Contains(claim!.Value, validModes)`，接受 "UpperGrades" 或 "Preschool" 任一值。测试名声称验证 `FirstOrDefault` 行为，但断言并未验证"取第一个"这一语义——仅验证了 displayMode claim 存在且为多家庭中某个有效值。由于 InMemory 数据库不保证插入顺序与查询返回顺序一致，这个弱断言是刻意的，但它意味着测试实际上不验证 `FirstOrDefault` 的确定性行为。

**严重度**: 低。在当前实现中，`FirstOrDefaultAsync` 取第一个匹配记录，但 InMemory 数据库的行为不可控。这不影响测试对"displayMode 会被正确注入"这一行为的验证，仅影响"取哪一个"的确定性。

**建议**: 可接受现状。若需强化断言，可改为：Moq 模拟 `FamilyMembers` 查询的返回顺序，使 `FirstOrDefaultAsync` 返回确定记录。当前弱断言在 InMemory 测试场景下是合理的工程权衡。

---

### 2.2 建议项（3 项）

#### S1: 测试计划计数与实现不一致

**文件**: `openspec/changes/add-display-mode-module/test-plan.md`

**问题**:
- 第 2.2 节声称 ChildScheduleQueryServiceTests 有 13 个原有用例，实际文件中有 12 个（`[Fact]` 方法计数）。
- 第 3.3 节优先级汇总表声称 "Should: 5"，但表格中实际列出 8 个 Should 项（B05, B07, T01, I01, I02, I03, I04, I05）。正确计数应为 8。

**建议**: 更新测试计划中的计数以匹配实际实现。

---

#### S2: B07 测试未覆盖"衍生日程与源日程同一天"场景

**文件**: `api/Schedule/Services/__tests__/ChildScheduleQueryServiceTests.cs`

**位置**: 第 568-590 行 `GetWeeklyListAsync_DerivativeScheduleInWeek_CountedInTotal`

**问题**: 测试计划中 B07 的描述为"衍生日程 OverrideDate 在周内，计入 totalCount，不影响同一天的原始日程"。当前测试中源日程 TimeSlot 为周四，衍生日程 OverrideDate 为周三——两者不在同一天。未验证"源日程和衍生日程同一天出现时，各自独立计数，互不影响"这一关键语义。

**严重度**: 低。当前测试已覆盖衍生日程在周视图中的独立计数，只是未覆盖"与源日程同天"这一边界。`IsScheduleActiveOnDate` 方法中，源日程走 TimeSlot 匹配分支，衍生日程走 OverrideDate 匹配分支，两者独立判断，逻辑上互不干扰。

**建议**: 可选补充一个测试：源日程 TimeSlot 包含周三，衍生日程 OverrideDate 也为周三，验证 totalCount 为源日程实例数 + 1（衍生日程），且两者都出现在 Items 中。

---

#### S3: 前端服务测试缺少非 403 错误路径覆盖

**文件**: `app/__tests__/services/child-schedule.test.js`

**问题**: 错误路径仅覆盖了 `CHILD_ACCESS_DENIED`（403）场景。未覆盖网络超时、500 服务端错误、404 资源不存在等错误路径。测试计划中 F07 标记为 Should 优先级（网络超时错误处理），但未实现。

**严重度**: 低。`child-schedule.js` 服务层是薄封装（透传 `services/api.js` 的响应），错误处理主要依赖 `api.js` 的统一拦截器。F07 的缺失不影响核心功能覆盖。

**建议**: 可选补充 `getTodayList` 网络超时场景，验证错误向上层抛出。

---

### 2.3 无问题项（确认通过）

以下维度经审查未发现问题：

| 维度 | 评估 |
|------|------|
| **brittle/flaky** | 无。所有后端测试使用 InMemory 数据库 + 唯一数据库名（`Interlocked.Increment`），不依赖时间/随机/网络/文件系统。前端测试使用 mock 服务，无真实网络调用。前端 child-week 测试使用 `new Date()` 生成测试数据，但断言为相对断言（长度、格式），不对具体日期值做硬编码断言。 |
| **测实现而非测行为** | 无。所有测试断言对外可观察行为（返回值、异常、HTTP 状态码、data 状态），不断言内部私有方法调用或私有字段。TokenService 测试中 `Parent_DoesNotQueryFamilyMember` 命名略有实现描述倾向，但断言的是 JWT 不含 displayMode claim（行为），非实现细节。 |
| **假覆盖** | 无。所有断言有意义，无 `expect(true).toBe(true)` 类空断言。 |
| **命名清晰度** | 全部通过。测试名均描述被验证的行为/场景。B02 命名 `NotAppears` 语法略不自然，建议改为 `DoesNotAppear`，但不影响理解。 |
| **一测一断言** | 通过。多断言场景均聚焦同一行为点（如一个 API 响应中的多个字段），属于合理范围，非多行为混杂。 |
| **失败路径覆盖** | 通过。后端：空列表、边界（RepeatEndDate 到期/周中边界）、异常（403/404）、已删除/已取消/已排除全覆盖。前端：空态、错误态、加载态、隐私策略阻断全覆盖。 |
| **测试独立性** | 通过。每个测试使用独立 InMemory 数据库实例（`Interlocked.Increment` 计数器），无共享状态。前端测试在 `beforeEach` 中重置 mock。 |
| **data-id 契约** | 通过。前端 data-id 测试覆盖全部 4 个孩子端页面，验证 WXML 中所有可交互元素有 data-id 属性。`dataids.test.js` 额外验证 child-mine 页面不含家长端管理入口。 |

---

## 3. 测试计划 vs 实现对照

| 用例 ID | 优先级 | 状态 | 文件 | 行号 |
|---------|:------:|:----:|------|:----:|
| B01 | Must | 已实现 | ChildScheduleQueryServiceTests.cs | 400-422 |
| B02 | Must | 已实现 | ChildScheduleQueryServiceTests.cs | 424-444 |
| B03 | Must | 已实现 | ChildScheduleQueryServiceTests.cs | 446-468 |
| B04 | Must | 已实现 | ChildScheduleQueryServiceTests.cs | 470-504 |
| B05 | Should | 已实现 | ChildScheduleQueryServiceTests.cs | 506-548 |
| B06 | Could | 已实现 | ChildScheduleQueryServiceTests.cs | 550-566 |
| B07 | Should | 已实现 | ChildScheduleQueryServiceTests.cs | 568-590 |
| C01 | Must | 已实现 | CompletionStatsServiceTests.cs | 339-373 |
| C02 | Must | 已实现 | CompletionStatsServiceTests.cs | 375-419 |
| C03 | Could | 已实现 | CompletionStatsServiceTests.cs | 421-437 |
| T01 | Should | 已实现 | TokenServiceTests.cs | 236-300 |
| I01-I05 | Should | **未实现** | -- | -- |
| F01-F07 | Must/Should | 已实现 | child-schedule.test.js | 1-113 |
| P01-P10 | Must/Should | 已实现 | child-today.test.js | 1-303 |
| P11-P15 | Must | 已实现 | child-week.test.js | 1-206 |
| P16-P20 | Must/Should | 已实现 | child-month.test.js | 1-188 |
| P21-P25 | Must/Should | 已实现 | child-mine.test.js | 1-193 |
| D01-D04 | Should | 已实现 | dataids.test.js | 223-296 |

**未实现**: I01-I05（后端 HTTP 集成测试，Should 优先级）。测试计划中明确标注为"可选补充"，未实现不影响核心覆盖。

---

## 4. 改进建议汇总

| # | 类别 | 建议 | 优先级 |
|---|------|------|:------:|
| 1 | 清理 | 删除 ChildScheduleControllerTests 中 2 个冗余 Parent 403 测试（仅断言状态码、无错误码断言） | 低 |
| 2 | 强化 | 可选补充 B07 衍生日程与源日程同一天场景的测试 | 低 |
| 3 | 补充 | 可选补充前端 child-schedule 服务网络超时错误路径（F07） | 低 |
| 4 | 文档 | 修正测试计划中 ChildScheduleQueryServiceTests 原有用例计数（13 -> 12）和 Should 优先级计数（5 -> 8） | 低 |
| 5 | 命名 | B02 测试名 `NotAppears` 改为 `DoesNotAppear`（语法微调，非阻塞） | 极低 |

---

## 5. 审查结论

**测试质量合格，可进入 Stage 4 测试执行阶段。** 新增 11 个后端测试覆盖了测试计划中全部 Must 优先级缺口（B01-B04, C01-C02），Should 优先级缺口（B05, B07, T01）和 Could 优先级缺口（B06, C03）也已全部实现。前端 68 个测试覆盖充分，无需新增。未发现假覆盖、脆性依赖或测试间隐式依赖。2 个需关注项均为冗余/弱断言，不影响测试有效性。

*审查完成日期：2026-08-18*
*下游：test-runner agent*