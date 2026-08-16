// testing/e2e/specs/checkin-cross.spec.js
// TC-CHK-X-001: 横切——统一错误信封（test-plan.md §2.E）
// 触发任意 checkin 错误，验证响应体 {error, message, traceId} 信封结构且与 contracts 一致。

const { test, expect } = require('@playwright/test');
const { healthCheck, checkin } = require('../helpers/api-client');
const { AUTH } = require('../helpers/data-factory');
const { checkinErrors, errorKey } = require('../helpers/contracts');
const { beijingYesterday } = require('../helpers/checkin-time');
const { FIXTURES, seedFixture, cleanupFixture } = require('../helpers/checkin-fixtures');

const apiIds = [];

test.beforeAll(async ({ request }) => { await healthCheck(request); });

test.afterEach(async ({ request }) => {
  for (const id of apiIds) { await cleanupFixture(request, AUTH.PARENT_A, id); }
  apiIds.length = 0;
});

test.describe('2.E 横切', () => {

  test('[TC-CHK-X-001] 统一错误信封', async ({ request }) => {
    // 触发终态拒绝（POST 昨天作息 → TERMINAL_STATE）。
    const id = await seedFixture(request, AUTH.PARENT_A, FIXTURES.routineYesterday('E2E-横切-错误信封'));
    apiIds.push(id);

    const res = await checkin(request, AUTH.PARENT_A, { scheduleId: id, date: beijingYesterday() });

    // 信封结构：error + message 与 errors.json 一致，HTTP 状态码同源。
    expect(res.status()).toBe(checkinErrors.TERMINAL_STATE.httpStatus);
    const body = await res.json();
    expect(body.error).toBe(errorKey(checkinErrors.TERMINAL_STATE, checkinErrors));
    expect(body.message).toBe(checkinErrors.TERMINAL_STATE.message);
    // traceId 为全局异常中间件附加的追踪标识，可缺省/null（dto.json ErrorResponse.traceId required:false）。
    expect(body.traceId === undefined || body.traceId === null || typeof body.traceId === 'string').toBe(true);
  });

});
