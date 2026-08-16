// testing/e2e/specs/checkin-window.spec.js
// TC-CHK-WIN-001 ~ TC-CHK-WIN-012: 打卡窗口查询 GET /api/v1/checkin/window/{scheduleId}/{date}
// 契约/枚举引用 openspec/contracts/checkin/（dev-contracts rule），时间基准北京时间（test-plan.md §3.1）。

const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { healthCheck, getCheckinWindow, checkin, cancelInstance } = require('../helpers/api-client');
const { AUTH, afterschoolActivity } = require('../helpers/data-factory');
const { checkinErrors, errors, CheckinStatus, assertError } = require('../helpers/contracts');
const { beijingToday, beijingYesterday, beijingTomorrow, beijingDayOfWeek, beijingHour } = require('../helpers/checkin-time');
const checkinDb = require('../helpers/checkin-db');
const {
  FIXTURES, CheckinReason, STATUS_LABELS, seedFixture, cleanupFixture,
} = require('../helpers/checkin-fixtures');

const apiIds = [];
const dbIds = [];

test.beforeAll(async ({ request }) => { await healthCheck(request); });

test.afterEach(async ({ request }) => {
  for (const id of apiIds) { await cleanupFixture(request, AUTH.PARENT_A, id); }
  for (const id of dbIds) {
    await checkinDb.cleanupCheckinSchedule(id);
    await checkinDb.deleteSchedule(id);
  }
  apiIds.length = 0;
  dbIds.length = 0;
});

async function seed(request, payload) {
  const id = await seedFixture(request, AUTH.PARENT_A, payload);
  apiIds.push(id);
  return id;
}

async function seedHomework() {
  const id = crypto.randomUUID();
  await checkinDb.insertHomeworkSchedule({ id, name: 'E2E-打卡-作业-逾期', dueDate: beijingYesterday() });
  dbIds.push(id);
  return id;
}

test.describe('2.A 打卡窗口查询', () => {

  test('[TC-CHK-WIN-001] 开放窗口查询返回 incomplete 可打卡', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await getCheckinWindow(request, AUTH.PARENT_A, id, beijingToday());

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.canCheckin).toBe(true);
    expect(body.canUndo).toBe(false);
    expect(body.reason).toBeNull();
    expect(body.status).toBe(CheckinStatus.incomplete);
    expect(body.statusLabel).toBe(STATUS_LABELS[CheckinStatus.incomplete]);
    // serverTime 为北京时间 ISO 8601（DateTimeOffset，如 "...+08:00"）。toISOString() 恒输出
    // UTC Z 格式，与原始偏移串永不相等，故改为断言可解析 + 偏移存在（§3.1 不断言精确秒）。
    expect(Number.isNaN(new Date(body.serverTime).getTime())).toBe(false);
    expect(body.serverTime).toMatch(/\+\d{2}:\d{2}$/);
  });

  test('[TC-CHK-WIN-002] 提前窗口未开放返回 EARLY + 剩余秒数', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityFutureEarly());
    const res = await getCheckinWindow(request, AUTH.PARENT_A, id, beijingTomorrow());

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.canCheckin).toBe(false);
    expect(body.reason).toBe(CheckinReason.EARLY);
    expect(body.remainingSeconds).toBeGreaterThan(0);
    expect(body.status).toBe(CheckinStatus.incomplete);
  });

  test('[TC-CHK-WIN-003] 已完成查询返回 completed 且可撤销', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const post = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() });
    expect(post.status()).toBe(200);

    const res = await getCheckinWindow(request, AUTH.PARENT_A, id, beijingToday());
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.canCheckin).toBe(false);
    expect(body.canUndo).toBe(true);
    expect(body.status).toBe(CheckinStatus.completed);
    expect(body.statusLabel).toBe(STATUS_LABELS[CheckinStatus.completed]);
  });

  test('[TC-CHK-WIN-004] 已取消查询返回 cancelled', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const cancel = await cancelInstance(request, AUTH.PARENT_A, id, { date: beijingToday() });
    expect(cancel.status()).toBe(200);

    const res = await getCheckinWindow(request, AUTH.PARENT_A, id, beijingToday());
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.canCheckin).toBe(false);
    expect(body.canUndo).toBe(false);
    expect(body.status).toBe(CheckinStatus.cancelled);
    expect(body.reason).toBe(CheckinReason.TERMINAL_STATE);
  });

  test('[TC-CHK-WIN-005] 课后活动逾期（date<today）返回 ended', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityYesterday());
    const res = await getCheckinWindow(request, AUTH.PARENT_A, id, beijingYesterday());

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(CheckinStatus.ended);
    expect(body.canCheckin).toBe(false);
    expect(body.reason).toBe(CheckinReason.TERMINAL_STATE);
    expect(body.statusLabel).toBe(STATUS_LABELS[CheckinStatus.ended]);
  });

  test('[TC-CHK-WIN-006] 课后活动即时逾期（今天 endTime+2h 已过）返回 ended', async ({ request }) => {
    // 需 now>02:00 CST（§6 R5）：endTime 00:00 → endTime+2h = 02:00，早于 02:00 运行时翻转。
    if (beijingHour() < 2) {
      test.skip(true, '需北京时间 >= 02:00（endTime 00:00 的逾期线），当前时段实例未逾期');
    }
    const id = await seed(request, afterschoolActivity({
      name: 'E2E-打卡-活动-今日即时逾期',
      timeSlots: [
        { dayOfWeek: beijingDayOfWeek(beijingToday()), startTime: '00:00:00', endTime: '00:00:00' },
      ],
    }));

    const res = await getCheckinWindow(request, AUTH.PARENT_A, id, beijingToday());
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(CheckinStatus.ended);
    expect(body.canCheckin).toBe(false);
  });

  test('[TC-CHK-WIN-007] 日常作息过期（date<today）返回 incomplete 终态', async ({ request }) => {
    const id = await seed(request, FIXTURES.routineYesterday());
    const res = await getCheckinWindow(request, AUTH.PARENT_A, id, beijingYesterday());

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(CheckinStatus.incomplete);
    expect(body.canCheckin).toBe(false);
    expect(body.reason).toBe(CheckinReason.TERMINAL_STATE);
  });

  test('[TC-CHK-WIN-008] 作业任务逾期（dueDate<today）返回 overdue', async ({ request }) => {
    const id = await seedHomework();
    const res = await getCheckinWindow(request, AUTH.PARENT_A, id, beijingYesterday());

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(CheckinStatus.overdue);
    expect(body.canCheckin).toBe(false);
    expect(body.reason).toBe(CheckinReason.TERMINAL_STATE);
    expect(body.statusLabel).toBe(STATUS_LABELS[CheckinStatus.overdue]);
  });

  test('[TC-CHK-WIN-009] 窗口查询日程不存在返回 404', async ({ request }) => {
    const res = await getCheckinWindow(request, AUTH.PARENT_A, crypto.randomUUID(), beijingToday());
    await assertError(res, checkinErrors.SCHEDULE_NOT_FOUND, checkinErrors);
  });

  test('[TC-CHK-WIN-010] 窗口查询非家庭成员返回 403', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await getCheckinWindow(request, AUTH.OUTSIDER, id, beijingToday());
    await assertError(res, checkinErrors.NOT_FAMILY_MEMBER, checkinErrors);
  });

  test('[TC-CHK-WIN-011] 窗口查询未鉴权返回 401', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await getCheckinWindow(request, null, id, beijingToday());
    await assertError(res, errors.TOKEN_INVALID);
  });

  test('[TC-CHK-WIN-012] 日常作息当天 24:00 前仍可打卡（无 endTime+2h 限制）', async ({ request }) => {
    const id = await seed(request, FIXTURES.routineTodayEndedEarly());
    const res = await getCheckinWindow(request, AUTH.PARENT_A, id, beijingToday());

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.canCheckin).toBe(true);
  });

});
