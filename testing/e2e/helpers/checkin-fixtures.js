// testing/e2e/helpers/checkin-fixtures.js
// FIX_* fixture 工厂（test-plan.md §3.2）——窗口/打卡/撤销/结算用例的确定性锚点。
//
// 课后活动/作息用 API 造数据（dayOfWeek 周重复，非具体日期），作业任务过去 dueDate 走
// checkin-db.js DB-SEED。时间基准一律走 checkin-time.js 的北京时间（§3.1）。

const { afterschoolActivity, dailyRoutine, TEST_USERS } = require('./data-factory');
const { seedSchedule, cleanupSchedule } = require('../fixtures/seed-data');
const { beijingToday, beijingYesterday, beijingTomorrow, beijingDayOfWeek } = require('./checkin-time');
const { CheckinStatus, CheckinSource, StreakScope } = require('./contracts');

// 不可打卡原因（CheckinWindowResponse.reason），镜像 api/Domain/Enums/CheckinReason.cs。
// reason 只认 EARLY / TERMINAL_STATE（test-plan.md §6.3 O1）；CHECKIN_WINDOW_CLOSED 仅作错误码。
const CheckinReason = { EARLY: 'EARLY', TERMINAL_STATE: 'TERMINAL_STATE' };

// 中文状态标签（CheckinWindowResponse.statusLabel），镜像 api/Domain/Enums/CheckinStatus.cs Label。
// 属 display 字段（非契约枚举），集中于此避免散落各处。
const STATUS_LABELS = {
  [CheckinStatus.incomplete]: '未完成',
  [CheckinStatus.completed]: '已完成',
  [CheckinStatus.cancelled]: '已取消',
  [CheckinStatus.ended]: '已结束',
  [CheckinStatus.overdue]: '逾期未完成',
};

/**
 * FIX_* 请求体构造器。返回 data-factory 的请求体，调用方再交给 seedSchedule/seedFixture。
 * dayOfWeek 按对应北京时间日期推导，startTime/endTime 为测试矩阵极值锚点（§3.2）。
 */
const FIXTURES = {
  // FIX_ACTIVITY_TODAY_OPEN —— 今天开放窗口（WIN-001 / POST-001~005 / UNDO-001~003）
  activityTodayOpen(name = 'E2E-打卡-活动-今日开放') {
    return afterschoolActivity({
      name,
      timeSlots: [
        { dayOfWeek: beijingDayOfWeek(beijingToday()), startTime: '00:00:00', endTime: '23:59:00' },
      ],
    });
  },

  // FIX_ACTIVITY_TODAY_EARLY —— 今天 startTime 23:59（POST-006 提前拒绝，需 now<23:29 CST）
  activityTodayEarly(name = 'E2E-打卡-活动-今日未开放') {
    return afterschoolActivity({
      name,
      timeSlots: [
        { dayOfWeek: beijingDayOfWeek(beijingToday()), startTime: '23:59:00', endTime: '23:59:59' },
      ],
    });
  },

  // FIX_ACTIVITY_FUTURE_EARLY —— 明天 startTime 16:00（WIN-002 确定性 EARLY）
  activityFutureEarly(name = 'E2E-打卡-活动-未来未开放') {
    return afterschoolActivity({
      name,
      timeSlots: [
        { dayOfWeek: beijingDayOfWeek(beijingTomorrow()), startTime: '16:00:00', endTime: '17:00:00' },
      ],
    });
  },

  // FIX_ACTIVITY_YESTERDAY —— 昨天课后活动（WIN-005 / POST-009 / SET-001 活动分支）
  activityYesterday(name = 'E2E-打卡-活动-昨日') {
    return afterschoolActivity({
      name,
      timeSlots: [
        { dayOfWeek: beijingDayOfWeek(beijingYesterday()), startTime: '10:00:00', endTime: '11:00:00' },
      ],
    });
  },

  // FIX_ROUTINE_YESTERDAY —— 昨天日常作息（WIN-007 / POST-008 / UNDO-005 / 结算作息分支）
  routineYesterday(name = 'E2E-打卡-作息-昨日') {
    return dailyRoutine({
      name,
      timeSlots: [
        { dayOfWeek: beijingDayOfWeek(beijingYesterday()), startTime: '10:00:00', endTime: '10:30:00' },
      ],
    });
  },

  // FIX_ROUTINE_TODAY_ENDED_EARLY —— 今天 endTime 00:30 已过（WIN-012 作息 24:00 前仍可打卡）
  routineTodayEndedEarly(name = 'E2E-打卡-作息-今日已过') {
    return dailyRoutine({
      name,
      timeSlots: [
        { dayOfWeek: beijingDayOfWeek(beijingToday()), startTime: '00:00:00', endTime: '00:30:00' },
      ],
    });
  },
};

/**
 * 通过 API 创建 fixture 并返回 scheduleId。
 * @returns {Promise<string>} scheduleId
 */
async function seedFixture(request, authToken, payload) {
  const created = await seedSchedule(request, authToken, payload);
  return created.schedules[0].scheduleId;
}

/**
 * 对称清理：删除 CheckinRecords/CheckinSettlements/Streaks(Schedule) + API 删除日程。
 */
async function cleanupFixture(request, authToken, scheduleId) {
  const { cleanupCheckinSchedule } = require('./checkin-db');
  await cleanupCheckinSchedule(scheduleId);
  await cleanupSchedule(request, authToken, scheduleId);
}

module.exports = {
  FIXTURES,
  CheckinReason,
  STATUS_LABELS,
  CheckinStatus,
  CheckinSource,
  StreakScope,
  TEST_USERS,
  seedFixture,
  cleanupFixture,
};
