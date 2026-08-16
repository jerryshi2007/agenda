// testing/e2e/specs/checkin-settlement.spec.js
// TC-CHK-SET-001 ~ TC-CHK-SET-012: 每日结算任务 SettlementJob（手动触发）
//
// 触发：POST /api/v1/test/checkin/settle（Development-only 测试端点，test-plan.md §3.5 方案 1，
// dev-dotnet 落地；Gate 0-6 就绪检查）。触发后经 helpers/checkin-db.js 直连 DB 断言写库结果。
//
// 关键约束（test-plan.md §3.5）：
//   - 「昨天」一律指北京时间昨天，用 beijingYesterday()，禁止本地时区 dateOffset(-1)。
//   - 结算 spec 独立文件 + 串行（workers:1 全局串行），每个用例独立 seed + 清理。
//   - 触发端点 MUST 同步 await SettlementJob.ExecuteAsync（否则 DB 断言与 Job 竞态）。
//
// 每用例前 truncate 三张 checkin 表，保证 streak/结算断言确定性（避免跨用例累加污染）。
//
// TIME-SKEW 风险（test-runner 分类用）：各用例在 seed 前计算 beijingYesterday()，但 SettlementJob
// 触发瞬间内部重算「昨天」。若 seed 与 trigger 之间跨北京时间 00:00，则 seed 的 yesterday 与 Job 的
// yesterday 不一致，日程不会被结算 → 用例确定性失败。这是毫秒级固有竞态，无法通过代码守卫完全消除；
// 触发时若命中午夜窗口，test-runner 应将失败归类为 TIME-SKEW 而非真实回归。

const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { healthCheck, getCheckinWindow, cancelInstance, triggerSettlement } = require('../helpers/api-client');
const { AUTH } = require('../helpers/data-factory');
const { CheckinStatus, CheckinReason } = require('../helpers/contracts');
const { beijingToday, beijingYesterday } = require('../helpers/checkin-time');
const checkinDb = require('../helpers/checkin-db');
const { FIXTURES, seedFixture, cleanupFixture } = require('../helpers/checkin-fixtures');

const apiIds = [];
const dbIds = [];

test.beforeAll(async ({ request }) => {
  await healthCheck(request);
  await checkinDb.truncateCheckinTables();
});

test.beforeEach(async () => {
  await checkinDb.truncateCheckinTables();
});

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

async function seedHomework(name = 'E2E-结算-作业-逾期') {
  const id = crypto.randomUUID();
  await checkinDb.insertHomeworkSchedule({ id, name, dueDate: beijingYesterday() });
  dbIds.push(id);
  return id;
}

async function trigger(request) {
  const res = await triggerSettlement(request, AUTH.PARENT_A);
  expect(res.ok()).toBe(true);
}

test.describe('2.D 结算任务', () => {

  test('[TC-CHK-SET-001] 三种类型结算写库', async ({ request }) => {
    const yesterday = beijingYesterday();
    const activityId = await seed(request, FIXTURES.activityYesterday('E2E-结算-活动'));
    const routineId = await seed(request, FIXTURES.routineYesterday('E2E-结算-作息'));
    const homeworkId = await seedHomework('E2E-结算-作业');

    await trigger(request);

    // 写库终态：活动→Ended(4)、作息→Incomplete(1)、作业→Overdue(5)。
    const activitySettlement = await checkinDb.getSettlement(activityId, yesterday);
    expect(activitySettlement).not.toBeNull();
    expect(activitySettlement.status).toBe(checkinDb.ScheduleStatus.Ended);

    const routineSettlement = await checkinDb.getSettlement(routineId, yesterday);
    expect(routineSettlement).not.toBeNull();
    expect(routineSettlement.status).toBe(checkinDb.ScheduleStatus.Incomplete);

    const homeworkSettlement = await checkinDb.getSettlement(homeworkId, yesterday);
    expect(homeworkSettlement).not.toBeNull();
    expect(homeworkSettlement.status).toBe(checkinDb.ScheduleStatus.Overdue);

    // GET window 对应昨天返回终态。
    const activityWindow = await getCheckinWindow(request, AUTH.PARENT_A, activityId, yesterday);
    expect((await activityWindow.json()).status).toBe(CheckinStatus.ended);
    const routineWindow = await getCheckinWindow(request, AUTH.PARENT_A, routineId, yesterday);
    const routineBody = await routineWindow.json();
    expect(routineBody.status).toBe(CheckinStatus.incomplete);
    expect(routineBody.canCheckin).toBe(false);
    expect(routineBody.reason).toBe(CheckinReason.TERMINAL_STATE);
    const homeworkWindow = await getCheckinWindow(request, AUTH.PARENT_A, homeworkId, yesterday);
    expect((await homeworkWindow.json()).status).toBe(CheckinStatus.overdue);
  });

  test('[TC-CHK-SET-002] 已打卡实例不结算', async ({ request }) => {
    const yesterday = beijingYesterday();
    const routineId = await seed(request, FIXTURES.routineYesterday('E2E-结算-已打卡'));
    await checkinDb.insertCheckin({ scheduleId: routineId, date: yesterday });

    await trigger(request);

    expect(await checkinDb.getSettlement(routineId, yesterday)).toBeNull();
    const streak = await checkinDb.getStreak(checkinDb.StreakScope.Schedule, routineId);
    expect(streak).not.toBeNull();
    expect(streak.currentStreak).toBe(1);
  });

  test('[TC-CHK-SET-003] 已取消实例不结算', async ({ request }) => {
    const yesterday = beijingYesterday();
    const routineId = await seed(request, FIXTURES.routineYesterday('E2E-结算-已取消'));
    const cancel = await cancelInstance(request, AUTH.PARENT_A, routineId, { date: yesterday });
    expect(cancel.status()).toBe(200);

    await trigger(request);

    expect(await checkinDb.getSettlement(routineId, yesterday)).toBeNull();
    expect(await checkinDb.getStreak(checkinDb.StreakScope.Schedule, routineId)).toBeNull();
  });

  test('[TC-CHK-SET-004] 结算幂等（重复触发）', async ({ request }) => {
    const yesterday = beijingYesterday();
    // 未打卡作息 → 触发写结算行（幂等锚点：结算行数不变）。
    const uncheckedId = await seed(request, FIXTURES.routineYesterday('E2E-结算-幂等-未打卡'));
    // 已打卡作息 → 触发 streak 累加（幂等锚点：LastSettledDate 不重复累加）。
    // 两条作息同日同子，时间槽需错开（15:00–15:30 vs 默认 14:00–14:30），否则 Schedule API 返回 409。
    const checkedId = await seed(request, FIXTURES.routineYesterday('E2E-结算-幂等-已打卡', { startTime: '15:00:00', endTime: '15:30:00' }));
    await checkinDb.insertCheckin({ scheduleId: checkedId, date: yesterday });

    await trigger(request);
    await trigger(request);

    expect(await checkinDb.countSettlements(uncheckedId)).toBe(1);
    const streak = await checkinDb.getStreak(checkinDb.StreakScope.Schedule, checkedId);
    expect(streak.currentStreak).toBe(1);
  });

  test('[TC-CHK-SET-005] 撤销 vs 结算竞态（最终未完成，BE-20）', async ({ request }) => {
    const yesterday = beijingYesterday();
    const routineId = await seed(request, FIXTURES.routineYesterday('E2E-结算-竞态'));
    // 模拟：昨日已打卡 → 23:59:50 撤销（DB-DELETE）→ 00:05 结算时无打卡记录。
    await checkinDb.insertCheckin({ scheduleId: routineId, date: yesterday });
    await checkinDb.deleteCheckin(routineId, yesterday);

    await trigger(request);

    const settlement = await checkinDb.getSettlement(routineId, yesterday);
    expect(settlement).not.toBeNull();
    expect(settlement.status).toBe(checkinDb.ScheduleStatus.Incomplete);
    expect(await checkinDb.countCheckins(routineId, yesterday)).toBe(0);

    const window = await getCheckinWindow(request, AUTH.PARENT_A, routineId, yesterday);
    const body = await window.json();
    expect(body.status).toBe(CheckinStatus.incomplete);
    expect(body.canCheckin).toBe(false);
    expect(body.reason).toBe(CheckinReason.TERMINAL_STATE);
  });

  test('[TC-CHK-SET-006] 单日程 streak 打卡累加', async ({ request }) => {
    const yesterday = beijingYesterday();
    const routineId = await seed(request, FIXTURES.routineYesterday('E2E-结算-streak-累加'));
    await checkinDb.insertCheckin({ scheduleId: routineId, date: yesterday });

    await trigger(request);

    const streak = await checkinDb.getStreak(checkinDb.StreakScope.Schedule, routineId);
    expect(streak).not.toBeNull();
    expect(streak.currentStreak).toBe(1);
  });

  test('[TC-CHK-SET-007] 单日程 streak 未打卡归零', async ({ request }) => {
    const yesterday = beijingYesterday();
    const routineId = await seed(request, FIXTURES.routineYesterday('E2E-结算-streak-归零'));
    await checkinDb.insertStreak({
      scope: checkinDb.StreakScope.Schedule,
      subjectId: routineId,
      currentStreak: 1,
    });

    await trigger(request);

    const streak = await checkinDb.getStreak(checkinDb.StreakScope.Schedule, routineId);
    expect(streak.currentStreak).toBe(0);
  });

  test('[TC-CHK-SET-008] 取消不中断单日程 streak', async ({ request }) => {
    const yesterday = beijingYesterday();
    const routineId = await seed(request, FIXTURES.routineYesterday('E2E-结算-streak-取消'));
    const cancel = await cancelInstance(request, AUTH.PARENT_A, routineId, { date: yesterday });
    expect(cancel.status()).toBe(200);
    await checkinDb.insertStreak({
      scope: checkinDb.StreakScope.Schedule,
      subjectId: routineId,
      currentStreak: 5,
    });

    await trigger(request);

    const streak = await checkinDb.getStreak(checkinDb.StreakScope.Schedule, routineId);
    expect(streak.currentStreak).toBe(5);
  });

  test('[TC-CHK-SET-009] 孩子整体 streak 累加', async ({ request }) => {
    const yesterday = beijingYesterday();
    const routineId = await seed(request, FIXTURES.routineYesterday('E2E-结算-孩子-streak-累加'));
    await checkinDb.insertCheckin({ scheduleId: routineId, date: yesterday });

    await trigger(request);

    const streak = await checkinDb.getStreak(checkinDb.StreakScope.Child, checkinDb.TEST_IDS.CHILD_1);
    expect(streak).not.toBeNull();
    expect(streak.currentStreak).toBe(1);
  });

  test('[TC-CHK-SET-010] 孩子整体 streak 归零', async ({ request }) => {
    const yesterday = beijingYesterday();
    const routineId = await seed(request, FIXTURES.routineYesterday('E2E-结算-孩子-streak-归零')); // 未打卡
    await checkinDb.insertStreak({
      scope: checkinDb.StreakScope.Child,
      subjectId: checkinDb.TEST_IDS.CHILD_1,
      currentStreak: 3,
    });

    await trigger(request);

    const streak = await checkinDb.getStreak(checkinDb.StreakScope.Child, checkinDb.TEST_IDS.CHILD_1);
    expect(streak.currentStreak).toBe(0);
  });

  test('[TC-CHK-SET-011] 全部取消整体 streak 不变', async ({ request }) => {
    const yesterday = beijingYesterday();
    const routineId = await seed(request, FIXTURES.routineYesterday('E2E-结算-孩子-streak-全取消'));
    const cancel = await cancelInstance(request, AUTH.PARENT_A, routineId, { date: yesterday });
    expect(cancel.status()).toBe(200);
    await checkinDb.insertStreak({
      scope: checkinDb.StreakScope.Child,
      subjectId: checkinDb.TEST_IDS.CHILD_1,
      currentStreak: 5,
    });

    await trigger(request);

    const streak = await checkinDb.getStreak(checkinDb.StreakScope.Child, checkinDb.TEST_IDS.CHILD_1);
    expect(streak.currentStreak).toBe(5);
  });

  test('[TC-CHK-SET-012] 结算不触碰今天实例（BE-18）', async ({ request }) => {
    const today = beijingToday();
    const routineId = await seed(request, FIXTURES.routineTodayEndedEarly('E2E-结算-今日不结算'));

    await trigger(request);

    expect(await checkinDb.getSettlement(routineId, today)).toBeNull();
    // 「今天」实例完全未被纳入昨日结算（BE-18：结算范围严格限定北京时间昨天）。
    expect(await checkinDb.getSettlement(routineId, beijingYesterday())).toBeNull();
    const window = await getCheckinWindow(request, AUTH.PARENT_A, routineId, today);
    expect((await window.json()).canCheckin).toBe(true);
  });

});
