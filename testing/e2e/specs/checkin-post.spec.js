// testing/e2e/specs/checkin-post.spec.js
// TC-CHK-POST-001 ~ TC-CHK-POST-015: 打卡执行 POST /api/v1/checkin
// 幂等 / 窗口关闭 / 取消 / 终态拒绝 / 校验失败 / 鉴权（test-plan.md §2.B）。

const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { healthCheck, checkin, cancelInstance } = require('../helpers/api-client');
const { AUTH } = require('../helpers/data-factory');
const { checkinErrors, errors, CheckinSource, assertError } = require('../helpers/contracts');
const { beijingToday, beijingYesterday, beijingTomorrow, beijingHour } = require('../helpers/checkin-time');
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

async function seedHomework() {
  const id = crypto.randomUUID();
  await checkinDb.insertHomeworkSchedule({ id, name: 'E2E-打卡-作业-逾期', dueDate: beijingYesterday() });
  dbIds.push(id);
  return id;
}

test.describe('2.B 打卡执行', () => {

  test('[TC-CHK-POST-001] 正常打卡成功', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.checkinId).toBe('number');
    expect(body.checkinId).toBeGreaterThan(0);
    expect(body.scheduleId).toBe(id);
    expect(body.date).toBe(beijingToday());
    // checkinAt 为服务器 ISO 8601 时间（DateTimeOffset，含 +08:00 偏移）。toISOString() 恒输出
    // UTC Z 格式，与原始偏移串永不相等，故改为断言可解析 + 偏移存在（§3.1 只验证可解析）。
    expect(Number.isNaN(new Date(body.checkinAt).getTime())).toBe(false);
    expect(body.checkinAt).toMatch(/\+\d{2}:\d{2}$/);
    expect(body.source).toBe(CheckinSource.Parent);
    // 正常成功响应缺省 alreadyCheckedIn（dto.json「可缺省」）。
    expect(body.alreadyCheckedIn).toBeUndefined();

    // DB CheckinRecords 新增 1 行。
    expect(await checkinDb.countCheckins(id, beijingToday())).toBe(1);
  });

  test('[TC-CHK-POST-002] 孩子自打 source=Child', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await checkin(request, AUTH.CHILD_1, { scheduleId: id, date: beijingToday() });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.source).toBe(CheckinSource.Child);
  });

  test('[TC-CHK-POST-003] 家长代打 source=Parent', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.source).toBe(CheckinSource.Parent);
  });

  test('[TC-CHK-POST-004] 幂等重复打卡', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const first = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();

    const second = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() });
    expect(second.status()).toBe(200);
    const secondBody = await second.json();

    expect(secondBody.alreadyCheckedIn).toBe(true);
    expect(secondBody.checkinId).toBe(firstBody.checkinId);
    // DB 仍 1 行（幂等最后防线）。
    expect(await checkinDb.countCheckins(id, beijingToday())).toBe(1);
  });

  test('[TC-CHK-POST-005] 并发同时打卡仅一条记录（BE-05）', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const [r1, r2] = await Promise.all([
      checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() }),
      checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() }),
    ]);

    // O4：并发两条均 200（一条 fresh + 一条 DB 兜底幂等），不断言哪条走兜底。
    expect(r1.status()).toBe(200);
    expect(r2.status()).toBe(200);
    expect(await checkinDb.countCheckins(id, beijingToday())).toBe(1);
  });

  test('[TC-CHK-POST-006] 提前窗口未开放拒绝', async ({ request }) => {
    // 需 now<23:29 CST（§6 R5）：startTime 23:59 → 提前窗口 23:29。
    // 保守以 >=23:00 整点跳过（而非 23:29），避免测试机与服务器时钟微秒级偏差在边界翻转。
    if (beijingHour() >= 23) {
      test.skip(true, '需北京时间 < 23:29（startTime 23:59 提前窗 23:29），当前已进入窗口开放时段');
    }
    const id = await seed(request, FIXTURES.activityTodayEarly());
    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() });
    await assertError(res, checkinErrors.CHECKIN_WINDOW_CLOSED, checkinErrors);
  });

  test('[TC-CHK-POST-007] 已取消拒绝打卡', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const cancel = await cancelInstance(request, AUTH.PARENT_A, id, { date: beijingToday() });
    expect(cancel.status()).toBe(200);

    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingToday() });
    await assertError(res, checkinErrors.SCHEDULE_CANCELLED, checkinErrors);
  });

  test('[TC-CHK-POST-008] 终态拒绝（日常作息过期）', async ({ request }) => {
    const id = await seed(request, FIXTURES.routineYesterday());
    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingYesterday() });
    await assertError(res, checkinErrors.TERMINAL_STATE, checkinErrors);
  });

  test('[TC-CHK-POST-009] 终态拒绝（课后活动 ended）', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityYesterday());
    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingYesterday() });
    await assertError(res, checkinErrors.TERMINAL_STATE, checkinErrors);
  });

  test('[TC-CHK-POST-010] 终态拒绝（作业逾期）', async ({ request }) => {
    const id = await seedHomework();
    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingYesterday() });
    await assertError(res, checkinErrors.TERMINAL_STATE, checkinErrors);
  });

  test('[TC-CHK-POST-011] 未来日期拒绝', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingTomorrow() });
    // O3：验证器对 date 为未来日期复用 CHECKIN_WINDOW_CLOSED。
    await assertError(res, checkinErrors.CHECKIN_WINDOW_CLOSED, checkinErrors);
  });

  test('[TC-CHK-POST-012] 空 scheduleId 拒绝', async ({ request }) => {
    // scheduleId 传 Guid.Empty（而非 null）：null 会在模型绑定层 JSON 反序列化到非空 Guid 时失败，
    // 产出 400 ValidationProblemDetails，而非 FluentValidation 的统一错误信封。Guid.Empty 才能进入
    // CheckinRequestValidator 的 NotEmpty 规则（§6.3 O3）。
    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: '00000000-0000-0000-0000-000000000000', date: beijingToday() });
    // O3：验证器对 scheduleId 为空复用 CHECKIN_WINDOW_CLOSED。
    await assertError(res, checkinErrors.CHECKIN_WINDOW_CLOSED, checkinErrors);
  });

  test('[TC-CHK-POST-013] 打卡日程不存在', async ({ request }) => {
    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: crypto.randomUUID(), date: beijingToday() });
    await assertError(res, checkinErrors.SCHEDULE_NOT_FOUND, checkinErrors);
  });

  test('[TC-CHK-POST-014] 打卡非家庭成员', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await checkin(request, AUTH.OUTSIDER, { scheduleId: id, date: beijingToday() });
    await assertError(res, checkinErrors.NOT_FAMILY_MEMBER, checkinErrors);
  });

  test('[TC-CHK-POST-015] 打卡未鉴权', async ({ request }) => {
    const id = await seed(request, FIXTURES.activityTodayOpen());
    const res = await checkin(request, null, { scheduleId: id, date: beijingToday() });
    await assertError(res, errors.TOKEN_INVALID);
  });

});
