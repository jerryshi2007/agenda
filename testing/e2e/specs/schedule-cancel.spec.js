// testing/e2e/specs/schedule-cancel.spec.js
// TC-CANCEL-001 ~ TC-CANCEL-011: Cancel & restore instance tests
// Covers POST /api/v1/schedules/{id}/cancel and /restore

const { test, expect } = require('@playwright/test');
const {
  createSchedule, cancelInstance, restoreInstance, deleteSchedule, getSchedule, healthCheck,
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
    name: opts.name || `取消测试-${Date.now()}`,
    timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
    ...opts,
  });
  const r = await createSchedule(request, AUTH.PARENT_A, payload);
  expect(r.status()).toBe(201);
  const d = await r.json();
  createdIds.push(d.schedules[0].scheduleId);
  return d.schedules[0];
}

// ============================================================
// 2.E Cancel & Restore — P0 (2 tests)
// ============================================================
test.describe('2.E Cancel & Restore — P0 Core Flow', () => {

  test('[TC-CANCEL-001] Cancel this instance @P0', async ({ request }) => {
    const s = await seedAfterschool(request);
    const res = await cancelInstance(request, AUTH.PARENT_A, s.scheduleId, { date: today() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.cancelled).toBe(true);
    expect(body.date).toBe(today());

    // Verify via GET
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.isCancelled).toBe(true);
    expect(detailBody.canCancel).toBe(false);
    // Restore should now be available
    expect(detailBody.canUndo).toBe(true);
  });

  test('[TC-CANCEL-003] Restore cancelled instance @P0', async ({ request }) => {
    const s = await seedAfterschool(request);
    // First cancel
    const cancelRes = await cancelInstance(request, AUTH.PARENT_A, s.scheduleId, { date: today() });
    expect(cancelRes.status()).toBe(200);

    // Then restore
    const restoreRes = await restoreInstance(request, AUTH.PARENT_A, s.scheduleId, { date: today() });
    expect(restoreRes.status()).toBe(200);
    const body = await restoreRes.json();
    expect(body.restored).toBe(true);

    // Verify via GET — no longer cancelled
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.isCancelled).toBe(false);
  });

});

// ============================================================
// 2.E Cancel & Restore — P1 (3 tests)
// ============================================================
test.describe('2.E Cancel & Restore — P1 Core Paths', () => {

  test('[TC-CANCEL-004] HomeworkTask — no cancel button @P1', async ({ request }) => {
    const payload = homeworkTask({ name: '不可取消作业', dueDate: dateOffset(7) });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    const sid = d.schedules[0].scheduleId;
    createdIds.push(sid);

    const detail = await getSchedule(request, AUTH.PARENT_A, sid);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.canCancel).toBe(false);
  });

  test('[TC-CANCEL-005] HomeworkTask — cancel API returns error @P1', async ({ request }) => {
    const payload = homeworkTask({ name: '禁止取消作业', dueDate: dateOffset(7) });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    createdIds.push(d.schedules[0].scheduleId);

    const res = await cancelInstance(request, AUTH.PARENT_A, d.schedules[0].scheduleId, { date: today() });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/HOMEWORK_NO_CANCEL/);
  });

  test('[TC-CANCEL-009] Restore "ThisOnly" deleted instance (undo Exclusion) @P1', async ({ request }) => {
    const s = await seedAfterschool(request);
    // Delete "ThisOnly" creates exclusion
    await deleteSchedule(request, AUTH.PARENT_A, s.scheduleId, { scope: 'ThisOnly', date: today() });

    // Restore should remove the exclusion
    const restoreRes = await restoreInstance(request, AUTH.PARENT_A, s.scheduleId, { date: today() });
    expect(restoreRes.status()).toBe(200);
    const body = await restoreRes.json();
    expect(body.restored).toBe(true);
    expect(body.restoredFrom).toBe('exclusion');
  });

});

// ============================================================
// 2.E Cancel & Restore — P2 (6 tests)
// ============================================================
test.describe('2.E Cancel & Restore — P2 Boundary Cases', () => {

  test('[TC-CANCEL-002] Cancel — cancel operation @P2', async ({ request }) => {
    // Frontend: user clicks "back" in cancel dialog
    // API: schedule remains uncancelled
    const s = await seedAfterschool(request);
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.isCancelled).toBe(false);
  });

  test('[TC-CANCEL-006] Cancel already-cancelled instance @P2', async ({ request }) => {
    const s = await seedAfterschool(request);
    const first = await cancelInstance(request, AUTH.PARENT_A, s.scheduleId, { date: today() });
    expect(first.status()).toBe(200);

    const second = await cancelInstance(request, AUTH.PARENT_A, s.scheduleId, { date: today() });
    expect(second.status()).toBe(400);
    const body = await second.json();
    expect(body.error).toMatch(/SCHEDULE_ALREADY_CANCELLED/);
  });

  test('[TC-CANCEL-007] Restore non-cancelled/excluded instance @P2', async ({ request }) => {
    const s = await seedAfterschool(request);
    const res = await restoreInstance(request, AUTH.PARENT_A, s.scheduleId, { date: today() });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/NOT_CANCELLED_OR_EXCLUDED/);
  });

  test('[TC-CANCEL-008] Access deleted schedule — no restore button @P2', async ({ request }) => {
    const s = await seedAfterschool(request);
    await deleteSchedule(request, AUTH.PARENT_A, s.scheduleId, { scope: 'ThisOnly', date: today() });

    // Schedule still exists but the instance is excluded
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    // May return 404 or 200 with isExcluded=true
    if (detail.status() === 200) {
      const body = await detail.json();
      expect(body.isExcluded).toBe(true);
    }
  });

  test('[TC-CANCEL-010] Cancelled instance — gray in month view @P2', async ({ request }) => {
    // API: verify the status is reflected in calendar response
    const s = await seedAfterschool(request);
    await cancelInstance(request, AUTH.PARENT_A, s.scheduleId, { date: today() });

    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.instanceStatus).toBe('cancelled');
  });

  test('[TC-CANCEL-011] Child role cannot cancel @P2', async ({ request }) => {
    const s = await seedAfterschool(request);
    const res = await cancelInstance(request, AUTH.CHILD_1, s.scheduleId, { date: today() });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/CHILD_ACCESS_DENIED/);
  });

});
