// testing/e2e/specs/checkin-undo.spec.js
// TC-CHK-UNDO-001 ~ TC-CHK-UNDO-010: 撤销打卡 DELETE /api/v1/checkin/{scheduleId}/{date}
// 三种拒绝（未打卡 / 终态结算 / 终态过期 / 课后活动 WINDOW_CLOSED）+ 互撤 + 鉴权。

const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { healthCheck, checkin, undoCheckin } = require('../helpers/api-client');
const { AUTH, afterschoolActivity } = require('../helpers/data-factory');
const { checkinErrors, errors, CheckinStatus, assertError } = require('../helpers/contracts');
const { beijingToday, beijingYesterday, beijingDayOfWeek, beijingHour } = require('../helpers/checkin-time');
const checkinDb = require('../helpers/checkin-db');
const { FIXTURES, seedFixture, cleanupFixture } = require('../helpers/checkin-fixtures');

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

test.describe('2.C 撤销打卡', () => {

  test('[TC-CHK-UNDO-001] 正常撤销', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const post = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() });
    expect(post.status()).toBe(200);

    const res = await undoCheckin(request, AUTH.PARENT_A, id, beijingToday());
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.undone).toBe(true);
    expect(body.status).toBe(CheckinStatus.incomplete);

    // DB CheckinRecords 该行删除。
    expect(await checkinDb.countCheckins(id, beijingToday())).toBe(0);
  });

  test('[TC-CHK-UNDO-002] 撤销后窗口内可重新打卡', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const first = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() });
    const firstBody = await first.json();
    const undo = await undoCheckin(request, AUTH.PARENT_A, id, beijingToday());
    expect(undo.status()).toBe(200);

    const second = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() });
    expect(second.status()).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.checkinId).not.toBe(firstBody.checkinId);
  });

  test('[TC-CHK-UNDO-003] 未打卡撤销拒绝', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await undoCheckin(request, AUTH.PARENT_A, id, beijingToday());
    await assertError(res, checkinErrors.NOT_CHECKED_IN, checkinErrors);
  });

  test('[TC-CHK-UNDO-004] 终态撤销拒绝（结算记录存在）', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    // DB-SEED：今天已打卡 + 今天已结算 → Undo 走「结算记录存在」分支。
    await checkinDb.insertCheckin({ scheduleId: id, date: beijingToday() });
    await checkinDb.insertSettlement({
      scheduleId: id,
      date: beijingToday(),
      status: checkinDb.ScheduleStatus.Incomplete,
    });

    const res = await undoCheckin(request, AUTH.PARENT_A, id, beijingToday());
    await assertError(res, checkinErrors.TERMINAL_STATE, checkinErrors);
  });

  test('[TC-CHK-UNDO-005] 终态撤销拒绝（date<today）', async ({ request }) => {
    const id = await seed(request, FIXTURES.routineYesterday());
    // DB-SEED：昨天已打卡 → Undo 走「date<today」终态分支（无结算记录）。
    await checkinDb.insertCheckin({ scheduleId: id, date: beijingYesterday() });

    const res = await undoCheckin(request, AUTH.PARENT_A, id, beijingYesterday());
    await assertError(res, checkinErrors.TERMINAL_STATE, checkinErrors);
  });

  test('[TC-CHK-UNDO-006] 课后活动逾期撤销拒绝（WINDOW_CLOSED）', async ({ request }) => {
    // 需 now>02:00 CST（§6 R5）：endTime 00:00:01 → endTime+2h = 02:00:01。
    // endTime 取 00:00:01 而非 00:00:00 是为满足 TIME_SLOT_INVALID（endTime>startTime），逾期线实质仍为 02:00。
    if (beijingHour() < 2) {
      test.skip(true, '需北京时间 >= 02:00（endTime 00:00:01 的逾期线），当前时段实例未逾期');
    }
    const id = await seed(request, afterschoolActivity({
      name: 'E2E-打卡-活动-撤销逾期',
      timeSlots: [
        { dayOfWeek: beijingDayOfWeek(beijingToday()), startTime: '00:00:00', endTime: '00:00:01' },
      ],
    }));
    // DB-SEED 已打卡（若 now>02:00 该实例即时逾期，POST 会被拒，故直连 DB 造打卡记录）。
    await checkinDb.insertCheckin({ scheduleId: id, date: beijingToday() });

    const res = await undoCheckin(request, AUTH.PARENT_A, id, beijingToday());
    await assertError(res, checkinErrors.WINDOW_CLOSED, checkinErrors);
  });

  test('[TC-CHK-UNDO-007] 撤销日程不存在', async ({ request }) => {
    const res = await undoCheckin(request, AUTH.PARENT_A, crypto.randomUUID(), beijingToday());
    await assertError(res, checkinErrors.SCHEDULE_NOT_FOUND, checkinErrors);
  });

  test('[TC-CHK-UNDO-008] 撤销非家庭成员', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await undoCheckin(request, AUTH.OUTSIDER, id, beijingToday());
    await assertError(res, checkinErrors.NOT_FAMILY_MEMBER, checkinErrors);
  });

  test('[TC-CHK-UNDO-009] 家长撤销孩子打卡', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const post = await checkin(request, AUTH.CHILD_1, { scheduleId: id, date: beijingToday() });
    expect(post.status()).toBe(200);

    const res = await undoCheckin(request, AUTH.PARENT_A, id, beijingToday());
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.undone).toBe(true);
  });

  test('[TC-CHK-UNDO-010] 撤销未鉴权', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await undoCheckin(request, null, id, beijingToday());
    await assertError(res, errors.TOKEN_INVALID);
  });

});
