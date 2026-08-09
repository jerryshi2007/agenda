## 1. 数据库与实体建模

- [ ] 1.1 定义 ScheduleType、ScheduleStatus、EditScope 枚举。若 checkin-module 已定义 ScheduleType 枚举且命名空间和值完全一致，直接引用，不重复定义。
- [ ] 1.2 创建 Schedule 实体（含 SourceScheduleId、GroupKey、RowVersion 乐观锁）
- [ ] 1.3 创建 TimeSlot 实体（ScheduleId + DayOfWeek + StartTime/EndTime，UNIQUE约束）
- [ ] 1.4 创建 Cancellation 实体（ScheduleId + CancelDate，UNIQUE约束）
- [ ] 1.5 创建 ScheduleDateExclusion 实体（ScheduleId + ExcludedDate，UNIQUE约束），用于"仅本次"删除的日期排除标记
- [ ] 1.6 编写 EF Core Entity Configuration（ScheduleConfiguration / TimeSlotConfiguration / CancellationConfiguration / ScheduleDateExclusionConfiguration）
- [ ] 1.7 扩展 AppDbContext，新增 Schedule / TimeSlot / Cancellation / ScheduleDateExclusion DbSet
- [ ] 1.8 生成 EF Core 迁移脚本并验证

## 2. 日程 CRUD API

- [ ] 2.1 实现 CreateScheduleRequest / ScheduleResponse / UpdateScheduleRequest DTOs
- [ ] 2.2 编写 FluentValidation Validators（名称必填/长度、时间合法性、至少一天、截止日期校验）
- [ ] 2.3 实现 ScheduleService.CreateAsync（多孩子展开模型：N 条 Schedule + TimeSlot，同一事务，GroupKey 关联）。所有异步方法 MUST 含 CancellationToken 参数。
- [ ] 2.4 实现 POST /api/v1/schedules 端点（含 201 Created 返回）
- [ ] 2.5 实现 ScheduleService.GetByIdAsync（含 TimeSlot + Cancellation + ScheduleDateExclusion 查询 + 实例状态推导）
- [ ] 2.6 实现 GET /api/v1/schedules/{scheduleId}?date=... 端点（含 checkin 记录查询，通过 IScheduleQueryService 反向查询 Checkin 模块）
- [ ] 2.7 实现 ConflictDetectionService（同一孩子 + 同一日期 + 时间重叠检测）
- [ ] 2.8 实现 POST /api/v1/schedules/check-conflict 端点（可选调用）

## 3. 日程编辑与删除 API

- [ ] 3.1 实现 ScheduleService.UpdateAsync（ThisOnly: 创建衍生 Schedule；ThisAndFuture: 修改 Schedule 本体 + DELETE 旧 TimeSlot + INSERT 新 TimeSlot）
- [ ] 3.2 实现乐观锁冲突检测（RowVersion 比对，409 CONCURRENT_EDIT_CONFLICT）
- [ ] 3.3 实现 PUT /api/v1/schedules/{scheduleId} 端点（含 scope 参数 + 编辑范围逻辑）
- [ ] 3.4 实现 ScheduleService.DeleteAsync（ThisOnly: 插入 ScheduleDateExclusion 记录，不修改 RepeatEndDate；ThisAndFuture: 修改 RepeatEndDate 截断 + 清理未来 ScheduleDateExclusion）
- [ ] 3.5 实现 DELETE /api/v1/schedules/{scheduleId}?scope=...&date=... 端点
- [ ] 3.6 实现 EditScope 校验（作业任务不显示/不接受范围参数；无未来实例时降级为 ThisOnly）
- [ ] 3.7 处理孩子移出家庭场景（编辑时校验 AssignedChildId 是否仍在家庭中，400 CHILD_NOT_IN_FAMILY）

## 4. 临时取消与恢复 API

- [ ] 4.1 实现 ScheduleService.CancelInstanceAsync（插入 Cancellation 记录，校验不重复取消、作业任务不支持）
- [ ] 4.2 实现 POST /api/v1/schedules/{scheduleId}/cancel 端点
- [ ] 4.3 实现 ScheduleService.RestoreInstanceAsync（物理删除 Cancellation 记录或 ScheduleDateExclusion 记录，校验存在性；根据 restore 参数来源分别处理取消恢复和删除恢复）
- [ ] 4.4 实现 POST /api/v1/schedules/{scheduleId}/restore 端点

## 5. 日历视图查询 API

- [ ] 5.1 实现 CalendarQueryService（核心：按 Schedule + RepeatRule + 日期范围展开虚拟实例算法，展开过程中 JOIN ScheduleDateExclusion 过滤已排除日期）
- [ ] 5.2 实现月视图数据聚合（日期格 + 色点 + scheduleCount，只返回 dots 数组）
- [ ] 5.3 实现周视图数据聚合（日期列 + 日程卡片摘要：name/startTime/endTime/childName/childAvatar/status）
- [ ] 5.4 实现日视图数据聚合（时间线 + 日程卡片全量信息：含 location/notes）
- [ ] 5.5 实现筛选逻辑（按 childId + scheduleTypes 过滤，筛选条件在 API 层处理，前端不二次过滤）
- [ ] 5.6 实现 GET /api/v1/calendar?view=...&startDate=...&endDate=...&filters 端点
- [ ] 5.7 实现实例状态推导（合并 Checkin 记录 + Cancellation 记录 + ScheduleDateExclusion 记录：已完成/已取消/已排除/已逾期/未完成）
- [ ] 5.8 日期范围校验（最大 90 天，超限 400 DATE_RANGE_TOO_LARGE）

## 6. 跨模块接口（供 checkin-module 调用）

- [ ] 6.1 在 checkin-module 目录定义 IScheduleQueryService 接口（GetScheduleAsync / GetTimeSlotAsync / GetCancellationStatusAsync / IsDateExcludedAsync / GetDueDateAsync）。接口由 checkin-module 定义（依赖反转），Schedule 模块实现。
- [ ] 6.2 实现 ScheduleQueryService（IScheduleQueryService 的实现，查询 Schedule + TimeSlot + Cancellation + ScheduleDateExclusion）
- [ ] 6.3 注册 IScheduleQueryService 到 DI 容器（Scoped 生命周期），在 Schedule 模块的 ServiceCollectionExtensions 中注册实现
- [ ] 6.4 确保与 checkin-module 的字段契约对齐（ScheduleModel 字段名、类型、可空性；RepeatRule 通过 TimeSlot.DayOfWeek 聚合推导，通过接口对外暴露）

## 7. 鉴权与安全

- [ ] 7.1 实现 FamilyId 隔离（所有 Schedule 查询按 JWT userId -> FamilyMember -> familyId 过滤）
- [ ] 7.2 实现角色权限控制（POST/PUT/DELETE 仅家长；GET 家长+孩子均可，孩子端只返回自己数据）
- [ ] 7.3 实现 403 NOT_FAMILY_MEMBER / CHILD_ACCESS_DENIED 错误返回
- [ ] 7.4 API 频率限制（创建/编辑接口每用户每分钟最大请求数，防刷）

## 8. 微信小程序前端 — 基础架构

- [ ] 8.1 创建 app/services/schedule.js（日程 CRUD API 封装：create/get/update/delete/cancel/restore）
- [ ] 8.2 创建 app/services/calendar.js（日历查询 API 封装：query/checkConflict）
- [ ] 8.3 创建 app/utils/date-utils.js（日期范围计算、DayOfWeek 映射、RepeatRule 展开仅用于前端展示）
- [ ] 8.4 扩展 app.js globalData（calendarState: currentView/currentDate/filters，onShow 恢复/onHide 保存）
- [ ] 8.5 创建 app/styles/schedule-common.wxss（日程模块公共样式：色条、状态标记、卡片布局）

## 9. 微信小程序前端 — 日历首页（三视图 + 筛选）

- [ ] 9.1 实现 pages/index/index（日历首页，替换 auth-module 占位页：view-switcher + filter-bar + date-navigator）
- [ ] 9.2 实现 components/calendar-view（视图容器：三视图切换逻辑 + 日期范围计算 + 数据获取触发）
- [ ] 9.3 实现 components/month-view（7x6 网格，日期数字 + 最多 3 色点 + "+N"，今天高亮，非当月灰色，tap 跳日视图）
- [ ] 9.4 实现 components/week-view（7 列时间网格，schedule-card 排序，空列处理）
- [ ] 9.5 实现 components/day-view（时间线布局，schedule-card 完整信息，>20 条支持滚动，空态提示）
- [ ] 9.6 实现 components/schedule-card（日程卡片：颜色条 + 时间 + 名称 + 孩子头像/名 + 状态图标/文字 + 类型标签 + 地点 + 备注，按视图信息密度切换）
- [ ] 9.7 实现 components/filter-bar（child-selector 单选/全部 + type-selector 多选/全部，筛选条件跨视图保持）
- [ ] 9.8 实现组件间通信（filter-bar 变更 -> 日历重新 fetch；view-switcher 切换 -> 日历重新 fetch）
- [ ] 9.9 实现左右滑动手势切换（上一/下一周期，300ms 防抖）
- [ ] 9.10 实现空态展示（无日程："还没有日程，点击创建第一个日程吧"；筛选后无结果："该筛选条件下无日程"；加载错误："加载失败，下拉重试"）

## 10. 微信小程序前端 — 创建日程页

- [ ] 10.1 实现 pages/schedule-create/index（4 步向导：step-child-select -> step-type-select -> step-fill-fields -> step-confirm）
- [ ] 10.2 实现 components/child-selector（多选孩子列表，无孩子时显示空态 + 跳转家庭管理入口）
- [ ] 10.3 实现 components/type-selector（三类型卡片：课后活动/日常作息/作业任务 + 底部"从模板创建"入口）
- [ ] 10.4 实现 components/time-slot-picker（快速填充：选星期几 + 设默认时间 -> 可选逐天微调展开面板）
- [ ] 10.5 实现按类型动态表单（课后活动：name + timeSlot + repeatEndDate + location + notes；日常作息：name + timeSlot + repeatEndDate + notes；作业任务：name + dueDate + suggestedTime + notes）
- [ ] 10.6 实现输入校验（名称长度 <= 50 / 非空 / 非纯空格；时间合法性；至少选一天；截止日期 >= 今天；备注 <= 500）
- [ ] 10.7 实现冲突检测交互（提交时检查冲突 -> 有冲突弹窗 -> "继续创建"/"返回修改"）
- [ ] 10.8 实现网络异常处理（创建失败时保留表单内容，支持重试）

## 11. 微信小程序前端 — 编辑日程页

- [ ] 11.1 实现 pages/schedule-edit/index（复用 schedule-create 的 step-fill-fields 区域 + edit-scope-switch）
- [ ] 11.2 实现 components/edit-scope-switch（分段开关：仅本次/全部日程，默认仅本次，切换保留内容）
- [ ] 11.3 实现作业任务编辑（不显示 scope-switch；不显示取消本次按钮）
- [ ] 11.4 实现乐观锁冲突处理（提交 409 -> 弹窗"该日程已被其他用户修改，请刷新后重新编辑"）
- [ ] 11.5 实现编辑后日历刷新（wx.navigateBack 携带 refresh 标记 -> 首页 onShow 重新 fetch）

## 12. 微信小程序前端 — 日程详情页

- [ ] 12.1 实现 pages/schedule-detail/index（header: 返回+标题+类型标签；sections: 打卡状态区 + 基本信息区 + 重复信息区 + 打卡记录区 + 操作按钮区）
- [ ] 12.2 实现基本信息区（日期/时间/地点/孩子/备注，按类型差异展示不同字段）
- [ ] 12.3 实现重复信息区（仅重复日程显示：RepeatRule 描述 + 结束日期）
- [ ] 12.4 实现打卡记录区（每个孩子的打卡状态：已完成/未完成/已离群；打卡人 + 打卡时间）
- [ ] 12.5 实现操作按钮状态机（打卡/撤销/编辑/取消本次/恢复本次/删除，按状态和权限显隐）
- [ ] 12.6 实现删除确认弹窗（重复日程：仅本次/本次及以后 radio；作业任务：简单确认）
- [ ] 12.7 实现取消本次确认弹窗 + 恢复本次（无二次确认）
- [ ] 12.8 实现打卡倒计时（提前窗口未开放时灰色按钮 + remainingSeconds 倒计时；遵循定时器生命周期）

## 13. 微信小程序前端 — 打卡交互集成（与 checkin-module 联调）

- [ ] 13.1 集成 checkin-module API（GET /checkin/window + POST /checkin + DELETE /checkin）。打卡窗口的时间规则判定（提前 30 分钟/课后活动 +2h/日常作息当天 24:00/作业截止当天 24:00）属于 checkin 模块职责。
- [ ] 13.2 实现详情页打卡按钮四种状态（可点击打卡 / 灰色倒计时 / 可撤销 / 不显示）
- [ ] 13.3 实现打卡按钮 click -> POST /checkin -> 成功 -> 刷新窗口 -> 切换为撤销按钮
- [ ] 13.4 实现撤销按钮 click -> DELETE /checkin -> 成功 -> 刷新窗口 -> 切换为打卡按钮
- [ ] 13.5 实现日历快捷打卡入口（日/周视图 schedule-card 上的打卡图标，不进详情页直接打卡）

## 14. 全局异常处理与边界场景

- [ ] 14.1 实现网络异常统一提示（创建/编辑/删除失败时 Toast 提示 + 重试机制）
- [ ] 14.2 实现 401 静默续期（依赖 auth-module services/api.js 拦截器，无需额外处理）
- [ ] 14.3 实现已删除日程详情访问处理（404 -> "该日程已被删除"，不显示操作按钮；已排除日期同理返回 excluded 状态）
- [ ] 14.4 实现跨天时间槽展示（日程在开始日期显示，标注次日结束时间）
- [ ] 14.5 实现已打卡实例编辑（不重置打卡状态；类型变更时打卡语义跟随变更）

## 15. 测试与文档

- [ ] 15.1 后端单元测试（ScheduleService / TimeSlotService / ConflictDetectionService / CalendarQueryService / ScheduleDateExclusion 核心逻辑）
- [ ] 15.2 后端集成测试（API 端点：CRUD + 冲突检测 + 乐观锁 + 鉴权 + ScheduleDateExclusion 排除/恢复流程）
- [ ] 15.3 前端页面测试（日历视图渲染 / 创建流程 / 编辑流程 / 详情页按钮状态机）
- [ ] 15.4 OpenSpec docs 完善（最终状态检查，确保无 TBD/TODO）
