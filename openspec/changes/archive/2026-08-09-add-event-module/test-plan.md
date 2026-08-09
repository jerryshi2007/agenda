# Test Plan: 日程管理模块 (add-event-module)

> Change: `add-event-module` | Stage: Stage 3 (测试) | Date: 2026-08-09
>
> 下游：test-writer | 覆盖范围：E2E（前后端集成）

---

## 1. 测试策略

### 1.1 范围

| 维度 | 包含 | 排除（非本期） |
|------|------|--------------|
| **Story** | EVT-ST-01（创建）/ EVT-ST-02（视图）/ EVT-ST-03（详情+操作） | 模板创建 US-EVT-04（Should，可降级） |
| **用户角色** | 家长（全部权限）、孩子（只读+打卡） | 高年级孩子自主添加日程（二期） |
| **日程类型** | 课后活动（AfterSchoolActivity）、日常作息（DailyRoutine）、作业任务（HomeworkTask） | -- |
| **操作** | CRUD + 仅本次/全部编辑 + 仅本次/本次及之后删除 + 取消/恢复 + 打卡/撤销 | 拖拽调整时间（二期） |
| **视图** | 月/周/日三视图 + 筛选 + 滑动 + 日期导航 | 跨天时间槽 UI 优化（Could） |
| **后端** | 全部 8 个 API 端点 + 冲突检测 + 乐观锁 | 模板对接 API |
| **异常** | 网络中断、401/403/404/409、并发冲突、输入校验 | -- |

### 1.2 方法

- **等价类划分**：对输入/状态划分合法类+非法类，每类选代表用例。
- **边界值**：针对字段长度、数量阈值、日期边界取 min-1/min/min+1。
- **错误路径**：覆盖网络失败、鉴权失败、并发冲突、资源不存在、领域规则拒绝。
- **去冗余**：合并等价用例；不重复覆盖同一输入类的变体。
- **优先级**：P0 = 阻塞性，P1 = 核心路径，P2 = 边界/降级，P3 = 低频/边缘。

### 1.3 优先级定义

| 级别 | 含义 | 举例 |
|:--:|------|------|
| P0 | 阻塞性——失败则核心流程不可用 | 创建日程成功、日历加载成功 |
| P1 | 核心路径——影响主要用户体验 | 编辑/删除/打卡操作、三视图切换 |
| P2 | 边界/降级——异常路径、边界条件 | 输入超长、空状态展示、并发冲突 |
| P3 | 低频/边缘——极少触发或可降级 | 跨天时间槽、20+日程日视图、Should 功能 |

---

## 2. 测试矩阵

### 2.A 日程创建 (EVT-ST-01: POST /api/v1/schedules)

| ID | 场景 | 前置条件 | 操作步骤 | 期望结果 | 优先级 |
|:--|------|---------|---------|---------|:--:|
| **TC-CREATE-001** | 创建课后活动（单孩子） | 家长登录，家庭有至少 1 个孩子 | 选 1 孩子 -> 选"课后活动" -> 填名称"钢琴课" -> 选周二 16:00-17:00 -> 填地点、备注 -> 确认创建 | 201 Created，返回 Schedule 含 TimeSlot，日历可见新日程 | P0 |
| **TC-CREATE-002** | 创建课后活动（多孩子，展开为 N 条） | 家长登录，家庭有 2+ 孩子 | 选 2 个孩子 -> 同上流程 -> 确认创建 | 201 Created，GroupKey 相同，返回 2 条 Schedule 记录，分别关联不同孩子 | P0 |
| **TC-CREATE-003** | 创建日常作息（逐天微调） | 家长登录 | 选"日常作息" -> 填"练琴" -> 快速填充周一至周五 16:00-16:30 -> 逐天微调周三为 17:00-17:30 -> 确认创建 | 201 Created，TimeSlot 中周三时间为 17:00-17:30，其余为 16:00-16:30 | P1 |
| **TC-CREATE-004** | 创建作业任务（含截止日期+建议时段） | 家长登录 | 选"作业任务" -> 填"数学练习册 P32-35" -> 选截止日期明天 -> 选建议时段 15:00-16:00 -> 确认创建 | 201 Created，无 TimeSlot 记录，DueDate=明天，SuggestedStartTime/SuggestedEndTime 已设置 | P1 |
| **TC-CREATE-005** | 创建作业任务（仅必填字段） | 家长登录 | 选"作业任务" -> 填"背诵课文" -> 选截止日期 -> 不填建议时段和备注 -> 确认创建 | 201 Created，SuggestedStartTime/EndTime/Notes 为 null | P1 |
| **TC-CREATE-006** | 冲突检测——同孩子同时段重叠 | 已有日程"钢琴课"周二 16:00-17:00 | 创建新日程，同孩子，时间 16:00-17:00 周二 | 返回 409 + hasConflict=true + 冲突日程名称和时间，弹窗"是否继续创建？" | P0 |
| **TC-CREATE-007** | 冲突后选择"继续创建" | TC-CREATE-006 触发冲突弹窗 | 点击"继续创建"，ignoreConflict=true | 201 Created，两条重叠日程均存在 | P1 |
| **TC-CREATE-008** | 冲突后选择"返回修改" | TC-CREATE-006 触发冲突弹窗 | 点击"返回修改" | 弹窗关闭，回到表单，数据不丢失，日程未创建 | P2 |
| **TC-CREATE-009** | 不同孩子同时段——不触发冲突 | 已有日程"钢琴课"小明 周二 16:00-17:00 | 为小红创建周二 16:00-17:00 的日程 | 201 Created，无冲突提示 | P1 |
| **TC-CREATE-010** | 未选孩子——阻止进入下一步 | 家长在选孩子步骤 | 不选任何孩子，点击"下一步" | 提示"请至少选择一个孩子"，停留在选孩子步骤 | P0 |
| **TC-CREATE-011** | 名称为空——阻止提交 | 家长填完所有字段但名称为空 | 点击"创建" | 400 SCHEDULE_NAME_EMPTY，提示"请输入日程名称" | P0 |
| **TC-CREATE-012** | 名称为纯空格——阻止提交 | 名称输入仅空白字符 | 点击"创建" | 400 SCHEDULE_NAME_EMPTY（trim 后为空），提示"请输入有效名称" | P2 |
| **TC-CREATE-013** | 名称恰好 50 字符——正常创建 | 输入 50 个中文字符 | 点击"创建" | 201 Created | P2 |
| **TC-CREATE-014** | 名称超过 50 字符——阻止 | 前端输入 51 字符（或后端直接发 51 字符请求） | 提交 | 前端限制 ≤50 字符；后端校验 400 SCHEDULE_NAME_TOO_LONG | P2 |
| **TC-CREATE-015** | 备注恰好 500 字符——正常创建 | 输入 500 字符备注 | 点击"创建" | 201 Created | P2 |
| **TC-CREATE-016** | 备注超过 500 字符——阻止 | 输入 501 字符备注 | 提交 | 400 NOTES_TOO_LONG | P2 |
| **TC-CREATE-017** | 地点超过 100 字符——阻止 | 输入 101 字符地点 | 提交 | 400 LOCATION_TOO_LONG | P2 |
| **TC-CREATE-018** | 时间槽开始 > 结束——阻止 | 设置 18:00 - 16:00 | 提交 | 400 TIME_SLOT_INVALID，提示"开始时间不能晚于结束时间" | P1 |
| **TC-CREATE-019** | 时间槽开始 = 结束——阻止 | 设置 16:00 - 16:00 | 提交 | 400 TIME_SLOT_INVALID | P2 |
| **TC-CREATE-020** | 7 天全部未选——阻止 | 所有天设为"无安排" | 提交 | 400 NO_DAY_SELECTED，提示"请至少选择一天" | P1 |
| **TC-CREATE-021** | 仅选 1 天——正常创建 | 只选周三 | 点击"创建" | 201 Created，仅 1 条 TimeSlot | P1 |
| **TC-CREATE-022** | 选满 7 天——正常创建 | 每天都有安排 | 点击"创建" | 201 Created，7 条 TimeSlot | P2 |
| **TC-CREATE-023** | 重复结束日期早于今天——阻止 | 设 repeatEndDate = 昨天 | 提交 | 400 REPEAT_END_DATE_INVALID / 前端提示"结束日期不能早于今天" | P2 |
| **TC-CREATE-024** | 重复结束日期 = 今天——正常创建 | 设 repeatEndDate = 今天 | 点击"创建" | 201 Created，今天为最后一天 | P2 |
| **TC-CREATE-025** | 无重复结束日期——无限重复 | 不设 repeatEndDate（null） | 点击"创建" | 201 Created，RepeatEndDate=null | P1 |
| **TC-CREATE-026** | 作业任务截止日期 = 今天——阻止或警告 | 选"作业任务"，设 dueDate=今天 | 提交 | 前端提示"截止日期不能早于今天"（至少今天）需确认设计意图；若允许今天，则正常创建 | P2 |
| **TC-CREATE-027** | 作业任务截止日期 = 昨天——阻止 | 选"作业任务"，设 dueDate=昨天 | 提交 | 400 DUE_DATE_INVALID 或前端阻止选择 | P2 |
| **TC-CREATE-028** | 家庭无孩子——显示空状态 | 家长登录，家庭成员中无孩子 | 进入创建页，选孩子步骤 | 显示"请先添加孩子" + 跳转家庭管理入口 | P2 |
| **TC-CREATE-029** | 创建时网络中断 | 家长填写完整后网络断开 | 点击"创建" | 显示"网络异常，请检查网络后重试"，表单内容保留，提供"重试"按钮 | P1 |
| **TC-CREATE-030** | 孩子端试图创建日程 | 孩子角色登录 | 直接调 POST /api/v1/schedules | 403 CHILD_ACCESS_DENIED，"孩子不能创建日程" | P2 |
| **TC-CREATE-031** | 未登录调用创建 API | 无 JWT | POST /api/v1/schedules | 401 TOKEN_INVALID | P2 |
| **TC-CREATE-032** | 4 步向导前进/后退——数据保留 | 家长在步骤 3 填写字段 | 点击"上一步"回步骤 2，再点"下一步"回步骤 3 | 步骤 3 已填写字段保留不丢失 | P2 |
| **TC-CREATE-033** | 步骤 4 预览确认信息正确 | 前 3 步完成 | 观察第 4 步预览卡片 | 显示：孩子名单、类型、名称、时间槽、地点、备注、截止日期等（按类型不同） | P1 |

### 2.B 日历视图 (EVT-ST-02: GET /api/v1/calendar)

| ID | 场景 | 前置条件 | 操作步骤 | 期望结果 | 优先级 |
|:--|------|---------|---------|---------|:--:|
| **TC-CAL-001** | 月视图——有日程的日期显示色点 | 10 月有课后活动（蓝色）、日常作息（绿色）、作业任务（橙色） | 切换到月视图，查看 10 月 | 有日程的日期格显示对应色点，最多 3 个色点 | P0 |
| **TC-CAL-002** | 月视图——>3 个日程显示"+N" | 某天有 4 个不同类型日程 | 查看该天 | 显示 3 个色点 + "+1"（moreCount=1） | P1 |
| **TC-CAL-003** | 月视图——今天高亮 | 当前日期在当月内 | 查看月视图 | 今天日期格有高亮样式（cal-cell-today） | P1 |
| **TC-CAL-004** | 月视图——非当月日期灰色 | 查看当月，月初/月末有上月/下月日期 | 查看这些日期格 | 灰色显示（cal-cell-other-month） | P1 |
| **TC-CAL-005** | 月视图——点击日期跳日视图 | 在月视图中 | 点击某日期格 | 切换到该日期的日视图 | P1 |
| **TC-CAL-006** | 月视图——点击非当月日期切换月份 | 月视图中有上月灰色日期 | 点击上月灰色日期 | 日历切换到上月，并展示该日日视图 | P2 |
| **TC-CAL-007** | 月视图——某日无日程 | 当天无任何日程 | 查看该日期格 | 仅显示日期数字，无色点 | P2 |
| **TC-CAL-008** | 月视图——无任何日程（全局空态） | 家庭无任何日程 | 查看月视图（或日历首页） | 显示空状态插画 + "还没有日程，点击创建第一个日程吧" + "创建日程"按钮 | P1 |
| **TC-CAL-009** | 周视图——显示日程卡片 | 当前周有日程 | 切换到周视图 | 每个日程显示：颜色条 + 时间 + 名称 + 孩子头像 + 状态图标 | P0 |
| **TC-CAL-010** | 周视图——某天空列 | 该天无日程 | 查看该天列 | 显示空列，无日程卡片 | P2 |
| **TC-CAL-011** | 周视图——点击卡片进详情 | 在周视图中 | 点击日程卡片 | 跳转日程详情页（带 scheduleId + date） | P1 |
| **TC-CAL-012** | 日视图——完整信息卡片 | 当天有课后活动日程（含地点+备注） | 切换到日视图 | 显示：颜色条 + 时间 + 名称 + 孩子头像+名 + 状态图标+文字 + 类型标签 + 地点 + 备注 | P1 |
| **TC-CAL-013** | 日视图——当天无日程（空态） | 当天无日程 | 查看日视图 | 显示"今天没有日程安排" + "创建日程"快捷入口按钮 | P1 |
| **TC-CAL-014** | 日视图——>20 条日程可滚动 | 当天有 21 条日程 | 查看日视图 | 时间线支持纵向滚动，不截断；显示"已加载 N 条日程" | P3 |
| **TC-CAL-015** | 视图切换——月/周/日切换 | 在日历首页 | 点击视图切换器 [月 | 周 | 日] 各一次 | 每次切换正确渲染对应视图，≤500ms | P0 |
| **TC-CAL-016** | 视图切换——筛选条件保持 | 当前筛选 孩子="小明" | 月 -> 周 -> 日 依次切换 | 每个视图均只显示小明的日程 | P1 |
| **TC-CAL-017** | 筛选——按孩子 | 家庭有多个孩子，各有日程 | 筛选栏选"小明" | 日历仅显示小明的日程 | P1 |
| **TC-CAL-018** | 筛选——按类型 | 有课后活动+日常作息 | 筛选栏选"课后活动" | 日历仅显示蓝色日程 | P1 |
| **TC-CAL-019** | 筛选——按孩子+类型组合 | 多个孩子多个类型 | 同时选"小明"+"日常作息" | 仅显示小明的绿色日程 | P2 |
| **TC-CAL-020** | 筛选——无匹配结果 | 筛选"小明"+"课后活动"，但小明无课后活动 | 应用筛选 | 显示"该筛选条件下无日程" | P1 |
| **TC-CAL-021** | 筛选——重置为"全部" | 当前筛选了孩子和类型 | 分别重置为"全部孩子"+"全部类型" | 恢复显示所有日程 | P2 |
| **TC-CAL-022** | 日期导航——上一月/下一月 | 当前 10 月 | 点击左箭头 | 切换到 9 月月视图 | P1 |
| **TC-CAL-023** | 日期导航——"今天"按钮 | 当前在 9 月视图 | 点击"今天"按钮 | 跳回当天所在月/周/日视图 | P1 |
| **TC-CAL-024** | 日期导航——标题显示正确 | 10 月 | 查看标题 | 月视图显示"2026年10月"，周视图显示"10月26日-11月1日" | P1 |
| **TC-CAL-025** | 滑动——左滑下一周 | 在周视图 | 向左滑动 | 导航到下一周，数据正确 | P1 |
| **TC-CAL-026** | 滑动——右滑上一周 | 在周视图 | 向右滑动 | 导航到上一周，数据正确 | P1 |
| **TC-CAL-027** | 滑动——快速连续滑动防抖 | 在周视图 | <300ms 内连续滑动 2 次 | 仅响应一次导航（防抖 300ms） | P2 |
| **TC-CAL-028** | 日历数据加载失败 | Mock 网络异常 | 打开日历首页 | 显示"加载失败，下拉重试"，可能展示上次缓存数据 + "数据可能不是最新" | P1 |
| **TC-CAL-029** | 日历数据加载成功 | 正常网络 | 打开日历首页 | 默认视图（家长周视图/孩子日视图）正确渲染 | P0 |
| **TC-CAL-030** | 孩子端日历——仅看到自己的日程 | 孩子登录，家庭有 2 个孩子各有日程 | 查看日历 | 仅显示该孩子自己的日程 | P1 |
| **TC-CAL-031** | 跨天时间槽——23:00-01:00 周五 | 有跨天日程 | 在周五查看 | 日程在周五展示，卡片标注次日结束时间 | P3 |
| **TC-CAL-032** | 日期范围过大——阻止查询 | -- | GET /calendar?startDate=2026-01-01&endDate=2026-12-31 | 400 DATE_RANGE_TOO_LARGE（>90 天） | P2 |
| **TC-CAL-033** | 无效视图类型 | -- | GET /calendar?view=year | 400 INVALID_VIEW | P2 |

### 2.C 编辑日程 (EVT-ST-03: PUT /api/v1/schedules/{id})

| ID | 场景 | 前置条件 | 操作步骤 | 期望结果 | 优先级 |
|:--|------|---------|---------|---------|:--:|
| **TC-EDIT-001** | 编辑"仅本次"——修改名称 | 重复日程（钢琴课，周二），当天实例存在 | 编辑页 -> 默认"仅本次" -> 改名为"钢琴课补课" -> 保存 | 200 OK，仅当天实例名称变更；其他日期实例不变。创建衍生 Schedule（SourceScheduleId 指向原 Schedule，RepeatEndDate=null） | P0 |
| **TC-EDIT-002** | 编辑"仅本次"——修改时间 | 重复日程"钢琴课"周二 16:00-17:00 | "仅本次" -> 改时间为 17:00-18:00 -> 保存 | 200 OK，仅当天实例时间变更 | P1 |
| **TC-EDIT-003** | 编辑"全部日程"——修改时间槽 | 重复日程周四 16:00-17:00 | 切换到"全部日程" -> 改周四为 17:00-18:00 -> 保存 | 200 OK，当前及所有未来周四实例均变为 17:00-18:00；历史实例不变 | P0 |
| **TC-EDIT-004** | 编辑"全部日程"——修改名称 | 重复日程 | "全部日程" -> 改名称 -> 保存 | 200 OK，当前及所有未来实例名称更新 | P1 |
| **TC-EDIT-005** | 切换编辑范围——数据保留 | 在"仅本次"模式填了部分字段 | 切换到"全部日程" | 已填写的内容不丢失 | P2 |
| **TC-EDIT-006** | "全部日程"无未来实例 | 重复结束日期已过，无未来实例 | 切换到"全部日程"并保存 | 系统提示"该日程无未来实例"，实际执行"仅本次"修改 | P2 |
| **TC-EDIT-007** | 编辑已打卡实例——非关键字段 | 今天实例已被打卡（已完成），家长点击编辑 | 修改地点、备注 -> 保存 | 编辑成功，打卡记录保持（不重置） | P1 |
| **TC-EDIT-008** | 编辑已打卡实例——修改类型字段 | 今天实例已被打卡，类型为"课后活动" | "仅本次" -> 改为"日常作息" -> 保存 | 编辑成功，打卡记录保持有效但打卡语义变更（确认到场->完成打卡） | P2 |
| **TC-EDIT-009** | 编辑作业任务——不显示范围开关 | 作业任务详情页 | 进入编辑页 | 不显示"仅本次/全部日程"分段开关 | P1 |
| **TC-EDIT-010** | 编辑作业任务——修改截止日期 | 作业任务，截止日期 11 月 1 日 | 修改截止日期为 11 月 5 日 -> 保存 | 200 OK，截止日期更新为 11 月 5 日，日历上移动到新日期 | P1 |
| **TC-EDIT-011** | 并发编辑冲突 | 家长 A 打开编辑页 (rowVersion=v1)，家长 B 也打开 (rowVersion=v1) | 家长 A 先提交成功 (v2)，家长 B 再提交 (v1) | 409 CONCURRENT_EDIT_CONFLICT，提示"该日程已被其他用户修改，请刷新后重新编辑" | P1 |
| **TC-EDIT-012** | 编辑时输入校验 | 日程编辑页 | 清空名称 -> 保存 | 400 SCHEDULE_NAME_EMPTY | P1 |
| **TC-EDIT-013** | 编辑时孩子已不在家庭中 | 日程关联的小明已被移出家庭 | 打开编辑页 -> 修改 -> 保存 | 400 CHILD_NOT_IN_FAMILY，"关联孩子小明已不在当前家庭" | P2 |
| **TC-EDIT-014** | 编辑不存在的日程 | scheduleId 无效 | PUT /api/v1/schedules/{invalidGuid} | 404 SCHEDULE_NOT_FOUND | P2 |
| **TC-EDIT-015** | 孩子端试图编辑 | 孩子登录 | PUT /api/v1/schedules/{id} | 403 CHILD_ACCESS_DENIED | P2 |
| **TC-EDIT-016** | 非家庭成员试图编辑 | 用户不属于该日程的家庭 | PUT /api/v1/schedules/{id} | 403 NOT_FAMILY_MEMBER | P2 |
| **TC-EDIT-017** | 编辑时网络中断 | 修改完成，网络断开 | 点击"保存" | 显示"网络异常，请检查网络后重试"，修改内容保留，提供重试 | P1 |

### 2.D 删除日程 (EVT-ST-03: DELETE /api/v1/schedules/{id})

| ID | 场景 | 前置条件 | 操作步骤 | 期望结果 | 优先级 |
|:--|------|---------|---------|---------|:--:|
| **TC-DEL-001** | 删除"仅本次"——创建 Exclusion 记录 | 重复日程（钢琴课，周二），当天实例存在 | 详情页 -> 点击"删除" -> 弹窗选择"仅删除本次" -> 确认 | 200 OK，method="exclusion"。INSERT ScheduleDateExclusion(ScheduleId, ExcludedDate)。当天实例消失，其他实例不变。历史打卡记录保留 | P0 |
| **TC-DEL-002** | 删除"仅本次"——取消操作 | 同上 | 点击"删除" -> 弹窗出现 -> 点击"取消" | 弹窗关闭，日程不受影响 | P1 |
| **TC-DEL-003** | 删除"本次及之后所有"——截断 RepeatEndDate | 重复日程，RepeatEndDate=12 月 31 日，当前为 10 月 27 日 | 选择"删除此日期及之后所有" -> 确认 | 200 OK，method="truncate"。RepeatEndDate 更新为 10 月 26 日（前一天）。当天及未来实例消失。历史实例和打卡记录保留 | P0 |
| **TC-DEL-004** | "本次及之后"删除——仅剩最后一个未来实例 | 重复日程，当前是最后一个未来实例 | 选择"删除此日期及之后所有" -> 确认 | 仅删除当前实例（等价"仅本次"），不产生"删除 0 个未来实例"的歧义 | P2 |
| **TC-DEL-005** | 删除作业任务——简单确认弹窗 | 作业任务详情页 | 点击"删除" -> 弹出简单确认（无范围选择）-> 确认 | 200 OK，软删除（IsDeleted=true）。打卡记录保留 | P1 |
| **TC-DEL-006** | 删除作业任务——取消 | 同上 | 确认弹窗 -> 点击"取消" | 弹窗关闭，任务不变，停留详情页 | P2 |
| **TC-DEL-007** | 删除确认弹窗——默认选中"仅本次" | 重复日程详情页 | 点击"删除" | 弹窗默认选中"仅删除本次" | P2 |
| **TC-DEL-008** | 删除不存在的日程 | scheduleId 无效 | DELETE | 404 SCHEDULE_NOT_FOUND | P2 |
| **TC-DEL-009** | 孩子端试图删除 | 孩子登录 | DELETE | 403 CHILD_ACCESS_DENIED | P2 |

### 2.E 取消与恢复 (EVT-ST-03: POST /cancel & /restore)

| ID | 场景 | 前置条件 | 操作步骤 | 期望结果 | 优先级 |
|:--|------|---------|---------|---------|:--:|
| **TC-CANCEL-001** | 取消本次实例 | 重复日程（非作业），当天实例"未完成"，未取消 | 详情页 -> 点击"取消本次" -> 弹窗 -> "确认取消" | 200 OK。INSERT Cancellation(ScheduleId, CancelDate)。实例状态变为"已取消"，灰色+删除线+标注"已取消" | P0 |
| **TC-CANCEL-002** | 取消——取消操作 | 同上 | 点击"取消本次" -> 弹窗 -> 点击"返回" | 弹窗关闭，实例状态不变 | P2 |
| **TC-CANCEL-003** | 恢复已取消实例 | 实例已被取消 | 详情页 -> "取消本次"按钮变为"恢复本次" -> 点击 | 200 OK。DELETE Cancellation 记录。实例立即恢复为"未完成"，删除线消失。无需二次确认 | P0 |
| **TC-CANCEL-004** | 作业任务不显示取消按钮 | 作业任务详情页 | 查看详情 | 不显示"取消本次"按钮 | P1 |
| **TC-CANCEL-005** | 作业任务调 cancel API | 作业任务 scheduleId | POST /cancel | 400 HOMEWORK_NO_CANCEL | P2 |
| **TC-CANCEL-006** | 重复取消同一实例 | 实例已取消 | POST /cancel 同一天 | 400 SCHEDULE_ALREADY_CANCELLED | P2 |
| **TC-CANCEL-007** | 恢复未取消/未排除的实例 | 实例正常 | POST /restore | 400 NOT_CANCELLED_OR_EXCLUDED | P2 |
| **TC-CANCEL-008** | 访问已删除日程，不显示恢复按钮 | 日程已被整体删除 | 通过历史链接访问详情 | 返回 404，"该日程已被删除"，不显示"恢复本次"按钮 | P2 |
| **TC-CANCEL-009** | 恢复"仅本次"删除的实例（撤销 Exclusion） | 实例已通过"仅本次"删除（有 ScheduleDateExclusion） | POST /restore | 200 OK，restoredFrom="exclusion"。DELETE Exclusion 记录。实例恢复显示 | P1 |
| **TC-CANCEL-010** | 已取消实例在月视图中显示灰色 | 实例已取消 | 查看月视图该日期 | 色点变为灰色或该日程不计入色点计数 | P2 |
| **TC-CANCEL-011** | 孩子端试图取消 | 孩子登录 | POST /cancel | 403 CHILD_ACCESS_DENIED | P2 |

### 2.F 打卡交互 (EVT-ST-03: 与 checkin-module 联调)

| ID | 场景 | 前置条件 | 操作步骤 | 期望结果 | 优先级 |
|:--|------|---------|---------|---------|:--:|
| **TC-CHECKIN-001** | 详情页打卡——课后活动 | 家长/孩子，课后活动实例"未完成"，打卡窗口开启 | 点击"打卡确认"（课后活动标签） | 实例状态变为"已完成"，绿色勾号。记录打卡人 ID 和打卡时间 | P0 |
| **TC-CHECKIN-002** | 详情页打卡——日常作息 | 日常作息实例"未完成" | 点击"完成打卡"（日常作息标签） | 实例状态变为"已完成" | P1 |
| **TC-CHECKIN-003** | 详情页打卡——作业任务 | 作业任务实例"未完成" | 点击"标记完成"（作业任务标签） | 实例状态变为"已完成" | P1 |
| **TC-CHECKIN-004** | 撤销打卡 | 实例"已完成" | 点击"撤销打卡" | 打卡记录物理删除，实例恢复为"未完成" | P0 |
| **TC-CHECKIN-005** | 重复打卡（幂等） | 实例已是"已完成" | 再次提交打卡请求 | 200 OK，alreadyCheckedIn=true，不创建重复记录 | P1 |
| **TC-CHECKIN-006** | 已取消实例不显示打卡按钮 | 实例已取消 | 查看详情 | 不显示打卡按钮 | P1 |
| **TC-CHECKIN-007** | 已逾期实例不显示打卡按钮 | 作业任务已逾期 | 查看详情 | 不显示打卡按钮；若显示则置灰不可点击 | P1 |
| **TC-CHECKIN-008** | 已结束实例不显示打卡按钮 | 课后活动已结束（时间窗口已过） | 查看详情 | 不显示打卡按钮 | P1 |
| **TC-CHECKIN-009** | 快捷打卡——日/周视图卡片 | 日视图/周视图，未完成实例 | 点击卡片上的勾号图标 | 状态立即变为"已完成"，无需进详情页 | P1 |
| **TC-CHECKIN-010** | 月视图不显示快捷打卡 | 在月视图中 | 查看日期格 | 无色点上的打卡交互（仅色点展示，无打卡入口） | P2 |
| **TC-CHECKIN-011** | 打卡时网络失败 | 网络中断 | 点击打卡按钮 | 提示"打卡失败，请重试"，打卡按钮保持可点击（不假显示"已完成"） | P1 |
| **TC-CHECKIN-012** | 打卡时日程已被另一家长删除 | 家长 A 删除日程 | 家长 B 同时打卡 | 返回"日程不存在或已删除"，前端刷新移除该日程 | P2 |
| **TC-CHECKIN-013** | 孩子端打卡 | 孩子登录，自己的日程 | 点击打卡按钮 | 打卡成功，记录打卡人为孩子 | P1 |
| **TC-CHECKIN-014** | 孩子端不可见编辑/删除/取消按钮 | 孩子登录，查看自己的日程 | 查看详情页 | 不显示编辑、删除、取消按钮；打卡按钮正常显示 | P1 |
| **TC-CHECKIN-015** | 家长端可见所有孩子打卡记录 | 家长登录 | 查看详情页 | 显示所有关联孩子的打卡状态行 | P1 |
| **TC-CHECKIN-016** | 详情页从服务端拉最新数据 | 在日历页缓存后进入详情 | 进入详情页 | 发起 GET /schedules/{id} 请求（非使用缓存数据） | P2 |

### 2.G 日程详情页展示 (EVT-ST-03: GET /api/v1/schedules/{id})

| ID | 场景 | 前置条件 | 操作步骤 | 期望结果 | 优先级 |
|:--|------|---------|---------|---------|:--:|
| **TC-DETAIL-001** | 课后活动详情——正常态（未完成） | 重复课后活动，未打卡未取消 | 进入详情页 | 显示：类型标签、基本信息（日期/时间/地点/孩子/备注）、重复信息（"每周二、周四"）、打卡记录区（未完成）、操作按钮（打卡/编辑/取消本次/删除） | P0 |
| **TC-DETAIL-002** | 课后活动详情——已完成态 | 实例已打卡 | 进入详情页 | 状态显示绿色"已完成"，打卡按钮变为"撤销打卡" | P1 |
| **TC-DETAIL-003** | 课后活动详情——已取消态 | 实例已取消 | 进入详情页 | 状态显示灰色"已取消"+删除线，"取消本次"变为"恢复本次"，打卡按钮不显示 | P1 |
| **TC-DETAIL-004** | 作业任务详情——正常态 | 作业任务，截止日期在未来 | 进入详情页 | 显示截止日期、建议时段、备注；不显示取消按钮；显示编辑、删除按钮 | P1 |
| **TC-DETAIL-005** | 作业任务详情——已逾期 | 作业任务过期未打卡 | 进入详情页 | 状态显示"逾期未完成"（红色），不显示打卡按钮 | P1 |
| **TC-DETAIL-006** | 日程不存在 | 访问已删除日程 | GET /schedules/{id} | 404 SCHEDULE_NOT_FOUND，前端显示"该日程已被删除" | P2 |
| **TC-DETAIL-007** | 非家庭成员访问 | 用户不属于该日程家庭 | GET /schedules/{id} | 403 NOT_FAMILY_MEMBER | P2 |
| **TC-DETAIL-008** | 详情页加载失败 | 模拟网络异常 | 进入详情页 | 显示重试按钮，"加载失败"提示 | P2 |

### 2.H 实例状态推导 (event-instance spec)

| ID | 场景 | 前置条件 | 操作步骤 | 期望结果 | 优先级 |
|:--|------|---------|---------|---------|:--:|
| **TC-STATUS-001** | 有打卡记录 -> completed | 实例有 Checkin 记录 | 查询实例状态 | 返回"已完成"，无论是否还有 Cancellation 记录 | P1 |
| **TC-STATUS-002** | 有取消记录无打卡 -> cancelled | 实例有 Cancellation，无 Checkin | 查询实例状态 | 返回"已取消" | P1 |
| **TC-STATUS-003** | 有一对一 Exclusion -> 实例不出现 | 实例有 ScheduleDateExclusion | 日历查询 | 该日不生成实例（被排除） | P1 |
| **TC-STATUS-004** | 课后活动过窗口 -> ended | 课后活动，当前时间 > 结束时间+2h，无 Checkin 无 Cancellation | 查询实例状态 | 返回"已结束" | P1 |
| **TC-STATUS-005** | 日常作息昨日无打卡 -> incomplete（终态） | 日常作息，昨天，无 Checkin | 查询实例状态 | 返回"未完成"（终态，不可再打卡） | P1 |
| **TC-STATUS-006** | 作业任务过期无打卡 -> overdue | 作业任务，dueDate < 今天，无 Checkin | 查询实例状态 | 返回"逾期未完成" | P1 |
| **TC-STATUS-007** | 当天实例无任何记录 -> incomplete | 当天实例，时间未过，无 Checkin/Cancellation | 查询实例状态 | 返回"未完成"（可打卡） | P0 |
| **TC-STATUS-008** | RepeatEndDate 限制实例范围 | 日程 RepeatEndDate=12/31，查询范围到次年 1/31 | 日历查询 | 仅返回 12/31 及以前的实例 | P2 |

### 2.I 跨模块与集成

| ID | 场景 | 前置条件 | 操作步骤 | 期望结果 | 优先级 |
|:--|------|---------|---------|---------|:--:|
| **TC-INTEG-001** | 创建 -> 日历可见（端到端） | 家长登录，空日历 | 完整创建课后活动 -> 返回首页 | 日历上新建日程立即可见 | P0 |
| **TC-INTEG-002** | 创建 -> 详情 -> 打卡（全流程） | 同上 | 创建日程 -> 日历点击卡片进详情 -> 打卡 | 详情页正确展示，打卡成功，状态变更 | P0 |
| **TC-INTEG-003** | 编辑 -> 日历更新 | 有重复日程 | 编辑"全部日程"修改时间 -> 返回日历 | 日历上所有未来实例时间已更新 | P1 |
| **TC-INTEG-004** | 删除 -> 日历移除 | 有重复日程 | 删除"仅本次" -> 返回日历 | 当天实例消失，其他日期实例仍在 | P1 |
| **TC-INTEG-005** | 取消 -> 日历视觉变化 | 有实例 | 取消本次 -> 返回日历 | 日历视图上该实例显示灰色/删除线 | P1 |
| **TC-INTEG-006** | 恢复 -> 日历恢复正常 | 实例已取消 | 恢复本次 -> 返回日历 | 日历视图上实例恢复彩色正常显示 | P2 |
| **TC-INTEG-007** | IScheduleQueryService 正确返回 schedule 基础信息 | checkin-module 调用 | checkin-module 调 GetScheduleTypeAsync / GetTimeSlotAsync / GetDueDateAsync / GetCancellationStatus / IsDateExcluded | 各项返回正确值 | P1 |
| **TC-INTEG-008** | 孩子移出家庭后日程保留但打卡禁用 | 孩子被移出家庭 | 家长查看关联该孩子的日程详情 | 日程信息正常显示，打卡记录中该孩子显示"已离开家庭"+灰色，打卡按钮不可用 | P2 |
| **TC-INTEG-009** | 孩子移出后编辑日程 | 关联孩子已移出 | 家长编辑该日程 | 400 CHILD_NOT_IN_FAMILY | P2 |

---

## 3. 测试数据需求

### 3.1 基础种子数据

| 数据 | 内容 | 用途 |
|------|------|------|
| 家长用户 A | userId=parentA, role=Parent, familyId=fam1 | 主要操作用户 |
| 家长用户 B | userId=parentB, role=Parent, familyId=fam1 | 并发冲突测试 |
| 孩子用户 1 | userId=child1, role=Child, familyId=fam1, name="小明" | 日程关联对象 |
| 孩子用户 2 | userId=child2, role=Child, familyId=fam1, name="小红" | 多孩子/筛选测试 |
| 孩子用户 3 | userId=child3, role=Child, familyId=fam1, name="小刚" | 边界测试 |
| 家庭 fam1 | familyId=fam1, 含 parentA, parentB, child1, child2, child3 | 数据隔离验证 |
| 家庭 fam2 | familyId=fam2, 含其他用户 | 跨家庭隔离测试 |

### 3.2 日程种子数据

| 日程 | 类型 | 关联孩子 | 时间配置 | RepeatEndDate | 用途 |
|------|------|---------|---------|:--:|------|
| 钢琴课 | AfterSchoolActivity | child1 | 周二 16:00-17:00, 周四 16:00-17:00 | 2026-12-31 | 基础 CRUD + 编辑 + 冲突检测 |
| 练琴 | DailyRoutine | child1 | 周一至周五 16:00-16:30, 周三 17:00-17:30 | null | 逐天微调测试 |
| 数学练习册 | HomeworkTask | child1 | 无 TimeSlot, dueDate=下周五, suggestedTime 15:00-16:00 | N/A | 作业任务测试 |
| 英语课（冲突） | AfterSchoolActivity | child1 | 周二 16:30-17:30 | 2026-12-31 | TC-CREATE-006 冲突测试 |
| 游泳课 | AfterSchoolActivity | child2 | 周三 15:00-16:00 | 2026-12-31 | 多孩子筛选 |

### 3.3 日期策略

- **测试基准日期**：使用当前系统日期作为"今天"（不硬编码），所有日期相关断言动态计算。
- **过期日期模拟**：可通过直接插入过期日程数据或修改系统时间（若环境允许）来测试已结束/逾期状态。

### 3.4 打卡/取消/排除种子数据

| 数据 | 关联 | 用途 |
|------|------|------|
| Checkin(child1, schedulePiano, date=today) | 钢琴课今天实例 | 已完成状态测试 |
| Cancellation(child1, schedulePiano, date=tomorrow) | 钢琴课明天实例 | 已取消状态测试 |
| ScheduleDateExclusion(child1, schedulePiano, date=yesterday) | 钢琴课昨天实例 | Exclusion 过滤测试 |

---

## 4. data-id 前缀清单与缺失标记

### 4.1 已实现的 data-id 清单

#### 日历首页 (pages/index)

| data-id | 元素 | 位置 |
|---------|------|------|
| `calendar-date-prev` | 上一周期箭头 | index.wxml |
| `calendar-date-title` | 日期范围标题 | index.wxml |
| `calendar-date-next` | 下一周期箭头 | index.wxml |
| `calendar-today-btn` | "今天"按钮 | index.wxml |
| `calendar-view-switch-month` | 月视图切换 | index.wxml |
| `calendar-view-switch-week` | 周视图切换 | index.wxml |
| `calendar-view-switch-day` | 日视图切换 | index.wxml |
| `calendar-filter-child` | 孩子筛选 | index.wxml |
| `calendar-filter-type` | 类型筛选 | index.wxml |
| `calendar-retry-btn` | 加载失败重试 | index.wxml |
| `calendar-empty-create-btn` | 空态创建日程 | index.wxml |

#### 月视图 (components/month-view)

| data-id | 元素 | 位置 |
|---------|------|------|
| `calendar-month-cell-{{item.date}}` | 月视图日期格 | month-view/index.wxml |

#### 周视图 (components/week-view)

| data-id | 元素 | 位置 |
|---------|------|------|
| `calendar-schedule-card-{{schedule.scheduleId}}` | 日程卡片（自定义组件标签） | week-view/index.wxml |

#### 日视图 (components/day-view)

| data-id | 元素 | 位置 |
|---------|------|------|
| `calendar-day-create-btn` | 空态创建日程按钮 | day-view/index.wxml |
| `calendar-schedule-card-{{schedule.scheduleId}}` | 日程卡片（自定义组件标签） | day-view/index.wxml |

#### 日程卡片 (components/schedule-card)

| data-id | 元素 | 位置 |
|---------|------|------|
| `calendar-schedule-card-{{schedule.scheduleId}}` | 卡片根节点 | schedule-card/index.wxml |
| `calendar-schedule-card-checkin-btn-{{schedule.scheduleId}}` | 快捷打卡按钮 | schedule-card/index.wxml |

#### 筛选栏 (components/filter-bar)

| data-id | 元素 | 位置 |
|---------|------|------|
| `calendar-filter-child` | 孩子筛选入口 | filter-bar/index.wxml |
| `calendar-filter-type` | 类型筛选入口 | filter-bar/index.wxml |

#### 创建日程页 (pages/schedule-create)

| data-id | 元素 | 位置 |
|---------|------|------|
| `schedule-create-child-{{item.userId}}` | 孩子选择项 | schedule-create/index.wxml |
| `schedule-create-type-afterschool` | 课后活动类型卡片 | schedule-create/index.wxml |
| `schedule-create-type-daily` | 日常作息类型卡片 | schedule-create/index.wxml |
| `schedule-create-type-homework` | 作业任务类型卡片 | schedule-create/index.wxml |
| `schedule-create-name-input` | 名称输入框 | schedule-create/index.wxml |
| `schedule-create-timeslot` | 时间槽选择器容器 | schedule-create/index.wxml |
| `schedule-create-repeat-end` | 重复结束日期选择器 | schedule-create/index.wxml |
| `schedule-create-location-input` | 地点输入框 | schedule-create/index.wxml |
| `schedule-create-due-date` | 截止日期选择器 | schedule-create/index.wxml |
| `schedule-create-suggest-start` | 建议时段开始 | schedule-create/index.wxml |
| `schedule-create-suggest-end` | 建议时段结束 | schedule-create/index.wxml |
| `schedule-create-notes-input` | 备注输入框 | schedule-create/index.wxml |
| `schedule-create-prev-btn` | 上一步按钮 | schedule-create/index.wxml |
| `schedule-create-next-btn` | 下一步按钮 | schedule-create/index.wxml |
| `schedule-create-submit-btn` | 确认创建按钮 | schedule-create/index.wxml |
| `schedule-create-conflict-dialog` | 冲突弹窗 | schedule-create/index.wxml |
| `schedule-create-conflict-back` | 冲突弹窗-返回修改 | schedule-create/index.wxml |
| `schedule-create-conflict-continue` | 冲突弹窗-继续创建 | schedule-create/index.wxml |

#### 时间槽选择器 (components/time-slot-picker)

| data-id | 元素 | 位置 |
|---------|------|------|
| `schedule-create-timeslot-tune-{{item.dayLabel}}` | 逐天选择按钮 | time-slot-picker/index.wxml |
| `schedule-create-timeslot-start` | 默认开始时间 | time-slot-picker/index.wxml |
| `schedule-create-timeslot-end` | 默认结束时间 | time-slot-picker/index.wxml |

#### 编辑日程页 (pages/schedule-edit)

| data-id | 元素 | 位置 |
|---------|------|------|
| `schedule-edit-scope` | 编辑范围容器 | schedule-edit/index.wxml |
| `schedule-edit-name-input` | 名称输入框 | schedule-edit/index.wxml |
| `schedule-edit-repeat-end` | 重复结束日期选择器 | schedule-edit/index.wxml |
| `schedule-edit-location-input` | 地点输入框 | schedule-edit/index.wxml |
| `schedule-edit-due-date` | 截止日期选择器 | schedule-edit/index.wxml |
| `schedule-edit-notes-input` | 备注输入框 | schedule-edit/index.wxml |
| `schedule-edit-save-btn` | 保存按钮 | schedule-edit/index.wxml |

#### 编辑范围开关 (components/edit-scope-switch)

| data-id | 元素 | 位置 |
|---------|------|------|
| `schedule-edit-scope-this-only` | "仅本次"选项 | edit-scope-switch/index.wxml |
| `schedule-edit-scope-all` | "全部日程"选项 | edit-scope-switch/index.wxml |

#### 日程详情页 (pages/schedule-detail)

| data-id | 元素 | 位置 |
|---------|------|------|
| `schedule-detail-retry-btn` | 加载失败重试按钮 | schedule-detail/index.wxml |
| `schedule-detail-checkin-btn` | 打卡确认按钮 | schedule-detail/index.wxml |
| `schedule-detail-checkin-btn-disabled` | 打卡按钮（禁用态） | schedule-detail/index.wxml |
| `schedule-detail-undo-btn` | 撤销打卡按钮 | schedule-detail/index.wxml |
| `schedule-detail-edit-btn` | 编辑按钮 | schedule-detail/index.wxml |
| `schedule-detail-cancel-btn` | 取消本次按钮 | schedule-detail/index.wxml |
| `schedule-detail-restore-btn` | 恢复本次按钮 | schedule-detail/index.wxml |
| `schedule-detail-delete-btn` | 删除按钮 | schedule-detail/index.wxml |
| `schedule-detail-delete-dialog` | 删除确认弹窗 | schedule-detail/index.wxml |
| `schedule-detail-delete-this-only` | 删除-仅本次选项 | schedule-detail/index.wxml |
| `schedule-detail-delete-all` | 删除-全部选项 | schedule-detail/index.wxml |
| `schedule-detail-delete-cancel` | 删除-取消按钮 | schedule-detail/index.wxml |
| `schedule-detail-delete-confirm` | 删除-确认按钮 | schedule-detail/index.wxml |
| `schedule-detail-cancel-dialog` | 取消本次弹窗 | schedule-detail/index.wxml |
| `schedule-detail-cancel-cancel` | 取消弹窗-返回按钮 | schedule-detail/index.wxml |
| `schedule-detail-cancel-confirm` | 取消弹窗-确认按钮 | schedule-detail/index.wxml |

### 4.2 缺失 data-id 标记（修复状态）

以下元素为可交互元素但缺少 `data-id`，按 `dev-miniapp-standards` 的可测试性契约，已在测试执行前补充：

| # | 缺失元素 | 所在文件 | data-id | 优先级 | 状态 |
|:--|---------|---------|------|:--:|:--:|
| M1 | 时间槽选择器"逐天微调时间"展开/收起按钮 | `components/time-slot-picker/index.wxml:38` | `schedule-create-timeslot-tune-toggle` | P1 | ✅ 已修复 |
| M2 | 逐天微调面板中每天的独立时间选择器 | `components/time-slot-picker/index.wxml:47` | `schedule-create-timeslot-tune-time-{{item.dayLabel}}` | P2 | ✅ 已修复 |
| M3 | 周视图星期头——日期点击（跳转日视图） | `components/week-view/index.wxml:6` | `calendar-week-header-cell-{{item.date}}` | P2 | ✅ 已修复 |
| M4 | 月视图"+N"展开提示 | `components/month-view/index.wxml:29` | `calendar-month-cell-more-{{item.date}}` | P3 | ✅ 已修复 |
| M5 | 创建页步骤指示器（当前步骤 N/4） | `pages/schedule-create/index.wxml:8` | `schedule-create-step-indicator` | P2 | ✅ 已修复 |
| M6 | 创建页第 4 步预览摘要卡片 | `pages/schedule-create/index.wxml:173` | `schedule-create-preview-summary` | P2 | ✅ 已修复 |
| M7 | 详情页打卡记录列表中的各行 | `pages/schedule-detail/index.wxml:98` | `schedule-detail-checkin-record-{{childId}}` | P2 | ✅ 已修复 |
| M8 | 筛选栏下拉选项列表项（孩子列表/类型列表） | `pages/index/index.js:218/245` | N/A — 使用 `wx.showActionSheet` 原生 API，选项由微信原生渲染，无法添加 data-id | P1 | ⚠️ 不可修复（原生 API） |
| M9 | 日历日期导航标题点击弹出的日期选择器 | `pages/index/index.js:157` | N/A — 当前为 `wx.showModal` 占位实现，弹出层由微信原生渲染 | P2 | ⚠️ 不可修复（原生 API） |
| M10 | 编辑页时间槽 picker（父容器标识） | `pages/schedule-edit/index.wxml:27` | `schedule-edit-timeslot` | P2 | ✅ 已修复 |

> **M8/M9 测试替代方案**：筛选和日期选择使用微信原生 API（`wx.showActionSheet` / `wx.showModal`），E2E 测试中通过 `wx` 自动化 API 的 `mockWxMethod` 或 miniprogram-automator 的 `evaluate` 来模拟用户选择。筛选触发后直接验证 API 请求参数中 `childId` / `eventTypes` 是否正确。

### 4.3 设计文档 data-id 与实际代码差异

设计文档（`design.md` 的 3.5 节）中列出的部分 `data-id` 与实际代码不一致：

| 设计文档 data-id | 实际代码 data-id | 影响 |
|------|------|------|
| `schedule-create-timeslot-quick` | `schedule-create-timeslot` | 测试定位名不同，测试代码需与实际对齐 |
| `schedule-create-timeslot-tune-{{day}}` | `schedule-create-timeslot-tune-{{item.dayLabel}}` | 插值变量名不同（`day` vs `item.dayLabel`） |

**建议**：测试代码以实际代码中的 data-id 为准。若设计文档中的 data-id 更优，需先修改源码再写测试。

---

## 5. 风险点与假设

### 5.1 测试风险

| # | 风险 | 影响 | 缓解措施 |
|:--|------|------|------|
| R1 | checkin-module 未完成，打卡窗口判定不可用 | TC-CHECKIN 系列测试无法完整执行 | 优先测试 Schedule 模块自身职责（IScheduleQueryService 返回值校验）；打卡窗口判定可用 Mock checkin 接口或手动修改数据库 checkin 记录验证 Schedule 模块的响应 |
| R2 | Family 模块骨架未就绪，familyContext 鉴权不可用 | 跨家庭隔离测试（TC-EDIT-016 等）需 FamilyMember 表 | 可通过直接插数据库 FamilyMember 记录 + 修改 JWT claims 绕过；或与 family-module 联调 |
| R3 | Auth 模块登录态机制未集成 | 所有需 JWT 的测试无法进行 | 测试环境使用固定 JWT（含 userId+familyId+role claims） |
| R4 | 日历视图前端使用原生 `<picker>` 和 `<scroll-view>` | 微信原生组件在自动化测试框架中可能难以操控 | 优先验证 API 层和 data 绑定逻辑；UI 交互优先做手工验证或用微信小程序自动化测试 SDK（miniprogram-automator） |
| R5 | "仅本次"编辑产生的衍生 Schedule 记录 | 多次编辑后衍生记录数量不确定，测试清理困难 | 每个测试用例使用独立 seed 数据；测试后统一清理 |
| R6 | 虚拟实例展开性能在大量数据下未知 | 月视图 500 条/月的性能承诺需验证 | 专项性能测试用例：插入 500 条日程 -> 测量 GET /calendar 响应时间 |

### 5.2 测试假设

| # | 假设 | 影响范围 |
|:--|------|------|
| A1 | 测试环境有可用的 PostgreSQL 数据库，可随意增删改 | 全部后端测试 |
| A2 | JWT 可在测试中手动构造，无需走完整微信登录流程（wx.login -> code -> openid -> JWT） | 全部鉴权相关测试 |
| A3 | 系统时钟为服务器时间（非客户端时间），实例状态推导以服务器时间为准 | TC-STATUS 系列 |
| A4 | "孩子端"和"家长端"通过 JWT 中的 role claim 区分（`Parent` / `Child`），前后端均依赖此 claim | TC-CREATE-030, TC-EDIT-015, TC-DEL-009, TC-CANCEL-011, TC-CHECKIN-013/014 |
| A5 | 打卡窗口判定逻辑由 checkin-module 负责，Schedule 模块仅负责提供基础数据（通过 IScheduleQueryService 接口） | TC-CHECKIN 系列中打卡按钮状态的正确性依赖 checkin-module |
| A6 | 冲突检测仅针对同一孩子检测，不同孩子同时段不触发 | TC-CREATE-006/009 |
| A7 | 前端 4 步向导的步骤间数据保留为前端逻辑，不涉及后端 | TC-CREATE-032 |
| A8 | 日历数据分页策略按设计文档 ADR-019 执行：月视图拉取当月 + 前后各一周（约 6 周） | TC-CAL-032 |
| A9 | 删除范围弹窗中"本次及之后所有"的上一选项为 RepeatEndDate 的截断（truncate），不创建 Exclusion 记录 | TC-DEL-003 |
| A10 | 作业任务不支持临时取消（HOMEWORK_NO_CANCEL 错误码），只有"删除"操作 | TC-CANCEL-004/005 |

### 5.3 测试环境依赖

| 组件 | 版本/配置 | 用途 |
|------|------|------|
| .NET 10 Web API | 本地或测试服务器 | 后端 API 测试 |
| PostgreSQL | 测试库 | 数据持久化 |
| 微信小程序开发者工具 | 最新稳定版 | 前端交互测试 |
| 微信小程序自动化 SDK | miniprogram-automator | E2E 自动化测试 |
| 测试框架（后端） | xUnit + Moq + Testcontainers (PostgreSQL) | 后端 API 测试 |
| 测试框架（前端） | miniprogram-simulate 或 jest + miniprogram-automator | 前端组件测试 + E2E |

---

## 6. 用例统计

| 模块 | P0 | P1 | P2 | P3 | 小计 |
|------|:--:|:--:|:--:|:--:|:--:|
| 2.A 日程创建 | 5 | 11 | 16 | 0 | **32** |
| 2.B 日历视图 | 3 | 19 | 9 | 2 | **33** |
| 2.C 日程编辑 | 2 | 8 | 7 | 0 | **17** |
| 2.D 日程删除 | 2 | 3 | 4 | 0 | **9** |
| 2.E 取消与恢复 | 2 | 3 | 6 | 0 | **11** |
| 2.F 打卡交互 | 2 | 10 | 4 | 0 | **16** |
| 2.G 详情页展示 | 1 | 3 | 4 | 0 | **8** |
| 2.H 实例状态推导 | 1 | 6 | 1 | 0 | **8** |
| 2.I 跨模块集成 | 2 | 5 | 2 | 0 | **9** |
| **合计** | **20** | **68** | **53** | **2** | **143** |

- **Must（P0+P1）覆盖**：88 条，覆盖 18 个 Must 用户故事 + 关键边界异常
- **Should（P2）覆盖**：53 条，覆盖 Should 功能 + 附加边界
- **Could（P3）覆盖**：2 条，低频边缘场景

---

## 7. 交付物与下游指引

### 7.1 给 test-writer 的编写顺序建议

1. **P0 用例**（20 条）-- 先确保核心流程通过
2. **P1 用例**（68 条）-- 扩展覆盖主要用户路径
3. **P2 用例**（53 条）-- 边界与异常覆盖
4. **P3 用例**（2 条）-- 最后处理或不处理

### 7.2 测试文件组织建议

```
testing/
├── e2e/
│   ├── schedule-create.test.js      # TC-CREATE-xxx
│   ├── calendar-view.test.js        # TC-CAL-xxx
│   ├── schedule-edit.test.js        # TC-EDIT-xxx
│   ├── schedule-delete.test.js      # TC-DEL-xxx
│   ├── schedule-cancel.test.js      # TC-CANCEL-xxx
│   ├── schedule-checkin.test.js     # TC-CHECKIN-xxx
│   ├── schedule-detail.test.js      # TC-DETAIL-xxx
│   ├── instance-status.test.js      # TC-STATUS-xxx
│   └── integration.test.js          # TC-INTEG-xxx
├── fixtures/
│   ├── seed-schedules.sql           # 日程种子数据
│   ├── seed-users.sql               # 用户种子数据
│   └── auth-tokens.json             # 固定 JWT tokens
└── helpers/
    ├── api-client.js                # 封装 HTTP 请求
    └── data-factory.js              # 测试数据工厂
```

### 7.3 定位元素方式

所有测试代码定位元素时 **MUST** 使用 `data-id` 属性选择器（如 `[data-id="schedule-create-name-input"]`），**禁止**使用：
- CSS 类名（`.form-input`）
- WXML 标签嵌套路径（`view > view > input`）
- 文本内容（`text="钢琴课"`）
- 原生 `id` 属性

详见 `dev-miniapp-standards` 中的 `data-id` 契约和 `test-standards` 中的稳定标识符规范。
