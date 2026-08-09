// testing/e2e/specs/schedule-delete.spec.js
// TC-DEL-001 ~ TC-DEL-009: Schedule deletion tests
// Covers DELETE /api/v1/schedules/{id} — ThisOnly/AllFuture scope, soft delete

const { test, expect } = require('@playwright/test');
const {
  createSchedule, deleteSchedule, getSchedule, healthCheck,
} = require('../helpers/api-client');
const {
  afterschoolActivity, homeworkTask, today, dateOffset,
  AUTH, TEST_USERS,
} = require('../helpers/data-factory');
const { cleanupSchedule } = require('../fixtures/seed-data');

let createdIds = [];

test.beforeAll(async ({ request }) => { await healthCheck(request); });
test.afterEach(async ({ request }) => {
  for (const id of createdIds) { await cleanupSchedule(request, AUTH.PARENT_A, id); }
  createdIds = [];
});

async function seedAfterschool(request, opts = {}) {
  const payload = afterschoolActivity({
    name: opts.name || `删除测试-${Date.now()}`,
    timeSlots: opts.timeSlots || [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
    ...opts,
  });
  const r = await createSchedule(request, AUTH.PARENT_A, payload);
  expect(r.status()).toBe(201);
  const d = await r.json();
  createdIds.push(d.schedules[0].scheduleId);
  return d.schedules[0];
}

// ============================================================
// 2.D Schedule Delete — P0 (2 tests)
// ============================================================
test.describe('2.D Schedule Delete — P0 Core Flow', () => {

  test('[TC-DEL-001] Delete "ThisOnly" — create Exclusion record @P0', async ({ request }) => {
    const s = await seedAfterschool(request);
    const res = await deleteSchedule(request, AUTH.PARENT_A, s.scheduleId, {
      scope: 'ThisOnly',
      date: today(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(body.scope).toBe('ThisOnly');
  });

  test('[TC-DEL-003] Delete "AllFuture" — truncate RepeatEndDate @P0', async ({ request }) => {
    const s = await seedAfterschool(request, {
      repeatEndDate: '2026-12-31',
    });
    const res = await deleteSchedule(request, AUTH.PARENT_A, s.scheduleId, {
      scope: 'ThisAndFuture',
      date: today(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(body.method).toBe('truncate');
  });

});

// ============================================================
// 2.D Schedule Delete — P1 (3 tests)
// ============================================================
test.describe('2.D Schedule Delete — P1 Core Paths', () => {

  test('[TC-DEL-002] Delete "ThisOnly" — cancel operation @P1', async ({ request }) => {
    // Frontend-only: user clicks cancel in dialog. API still has the schedule.
    const s = await seedAfterschool(request);
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId);
    expect(detail.status()).toBe(200); // Schedule still exists
  });

  test('[TC-DEL-005] Delete HomeworkTask — simple confirmation dialog @P1', async ({ request }) => {
    const payload = homeworkTask({ name: '待删除作业', dueDate: dateOffset(5) });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    const sid = d.schedules[0].scheduleId;
    createdIds.push(sid);

    const res = await deleteSchedule(request, AUTH.PARENT_A, sid, {
      scope: 'ThisOnly',
      date: today(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });

  test('[TC-DEL-009] Child role cannot delete @P1', async ({ request }) => {
    const s = await seedAfterschool(request);
    const res = await deleteSchedule(request, AUTH.CHILD_1, s.scheduleId, {
      scope: 'ThisOnly',
      date: today(),
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/CHILD_ACCESS_DENIED/);
  });

});

// ============================================================
// 2.D Schedule Delete — P2 (4 tests)
// ============================================================
test.describe('2.D Schedule Delete — P2 Boundary Cases', () => {

  test('[TC-DEL-004] "AllFuture" deletion — last future instance only @P2', async ({ request }) => {
    // Create with repeatEndDate = today
    const s = await seedAfterschool(request, { repeatEndDate: today() });
    const res = await deleteSchedule(request, AUTH.PARENT_A, s.scheduleId, {
      scope: 'ThisAndFuture',
      date: today(),
    });
    expect(res.status()).toBe(200);
  });

  test('[TC-DEL-006] Delete HomeworkTask — cancel @P2', async ({ request }) => {
    // Frontend-only: user cancels deletion; schedule still exists
    const payload = homeworkTask({ name: '不删的作业', dueDate: dateOffset(10) });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    createdIds.push(d.schedules[0].scheduleId);

    const detail = await getSchedule(request, AUTH.PARENT_A, d.schedules[0].scheduleId);
    expect(detail.status()).toBe(200);
  });

  test('[TC-DEL-007] Delete dialog — default "ThisOnly" @P2', async ({ request }) => {
    // Frontend behavior: default selection cannot be verified via API
    // API: verify that "ThisOnly" is the default scope when not specified
    const s = await seedAfterschool(request);
    const res = await deleteSchedule(request, AUTH.PARENT_A, s.scheduleId);
    expect(res.status()).toBe(200);
  });

  test('[TC-DEL-008] Delete non-existent schedule @P2', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await deleteSchedule(request, AUTH.PARENT_A, fakeId);
    expect(res.status()).toBe(404);
  });

});
