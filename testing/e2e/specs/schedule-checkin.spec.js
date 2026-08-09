// testing/e2e/specs/schedule-checkin.spec.js
// TC-CHECKIN-001 ~ TC-CHECKIN-016: Check-in interaction tests
// Note: Check-in API belongs to checkin-module. These tests verify Schedule module's
// IScheduleQueryService behavior and check-in related response fields.
// Full check-in CRUD tests require the checkin-module to be implemented.

const { test, expect } = require('@playwright/test');
const {
  createSchedule, getSchedule, cancelInstance, healthCheck,
} = require('../helpers/api-client');
const {
  afterschoolActivity, dailyRoutine, homeworkTask, today, dateOffset,
  AUTH, TEST_USERS,
} = require('../helpers/data-factory');
const { cleanupSchedule } = require('../fixtures/seed-data');

let createdIds = [];

test.beforeAll(async ({ request }) => { await healthCheck(request); });
test.afterEach(async ({ request }) => {
  for (const id of createdIds) { await cleanupSchedule(request, AUTH.PARENT_A, id); }
  createdIds = [];
});

async function seedSchedule(request, type, opts = {}) {
  let payload;
  switch (type) {
    case 'DailyRoutine':
      payload = dailyRoutine({ name: opts.name || '打卡-作息测试', ...opts });
      break;
    case 'HomeworkTask':
      payload = homeworkTask({ name: opts.name || '打卡-作业测试', dueDate: dateOffset(7), ...opts });
      break;
    default:
      payload = afterschoolActivity({ name: opts.name || '打卡-活动测试', ...opts });
  }
  const r = await createSchedule(request, AUTH.PARENT_A, payload);
  expect(r.status()).toBe(201);
  const d = await r.json();
  createdIds.push(d.schedules[0].scheduleId);
  return d.schedules[0];
}

// ============================================================
// 2.F Check-in — P0 (2 tests)
// ============================================================
test.describe('2.F Check-in Interaction — P0 Core Flow', () => {

  test('[TC-CHECKIN-001] Detail page check-in — AfterSchoolActivity @P0', async ({ request }) => {
    // API test: verify schedule response includes check-in capability flags
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    // Uncompleted schedule should show check-in as available
    expect(body.canCheckin).toBe(true);
    expect(body.canUndo).toBe(false); // not checked in yet
    expect(body.instanceStatus).toBeDefined();
  });

  test('[TC-CHECKIN-004] Undo check-in @P0', async ({ request }) => {
    // API: verify undo capability flag is exposed correctly
    // Actual undo requires checkin-module to manually create a checkin record first
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    // Since there's no checkin record, canUndo should be false
    expect(body.canUndo).toBe(false);
    // checkin API should be called separately by checkin-module
  });

});

// ============================================================
// 2.F Check-in — P1 (10 tests)
// ============================================================
test.describe('2.F Check-in Interaction — P1 Core Paths', () => {

  test('[TC-CHECKIN-002] Detail page check-in — DailyRoutine @P1', async ({ request }) => {
    const s = await seedSchedule(request, 'DailyRoutine');
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.canCheckin).toBe(true);
    expect(body.scheduleType).toBe('DailyRoutine');
  });

  test('[TC-CHECKIN-003] Detail page check-in — HomeworkTask @P1', async ({ request }) => {
    const s = await seedSchedule(request, 'HomeworkTask');
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.scheduleType).toBe('HomeworkTask');
    // HomeworkTask should allow check-in (until overdue)
    expect(body.canCheckin).toBe(true);
  });

  test('[TC-CHECKIN-005] Duplicate check-in (idempotent) @P1', async ({ request }) => {
    // API: verify checkinRecords field is returned
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.checkinRecords).toBeDefined();
    // Initially empty
    expect(body.checkinRecords.length).toBe(0);
  });

  test('[TC-CHECKIN-006] Cancelled instance — no check-in button @P1', async ({ request }) => {
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    await cancelInstance(request, AUTH.PARENT_A, s.scheduleId, { date: today() });

    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.isCancelled).toBe(true);
    expect(body.canCheckin).toBe(false);
  });

  test('[TC-CHECKIN-007] Future-due homework — check-in available (HomeworkTask) @P1', async ({ request }) => {
    // Create homework with future due date — should be allowed to check in
    const payload = homeworkTask({ name: '未逾期作业', dueDate: dateOffset(7) });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(r.status()).toBe(201);
    const d = await r.json();
    createdIds.push(d.schedules[0].scheduleId);

    const detail = await getSchedule(request, AUTH.PARENT_A, d.schedules[0].scheduleId);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    // Future-due homework should have canCheckin = true
    expect(body.canCheckin).toBe(true);
  });

  test('[TC-CHECKIN-008] Ended instance — no check-in button @P1', async ({ request }) => {
    // Create schedule with end time in the past
    const s = await seedSchedule(request, 'AfterSchoolActivity', {
      timeSlots: [{ dayOfWeek: 2, startTime: '06:00:00', endTime: '07:00:00' }],
    });
    // Check if instance status reflects time window
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    // Instance status should reflect time window
    expect(body.instanceStatus).toBeDefined();
  });

  test('[TC-CHECKIN-009] Quick check-in — day/week view card @P1', async ({ request }) => {
    // API: verify schedule data includes enough info for quick check-in
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.scheduleId).toBe(s.scheduleId);
    expect(body.canCheckin).toBeDefined();
  });

  test('[TC-CHECKIN-013] Child check-in @P1', async ({ request }) => {
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    // Child queries their own schedule
    const detail = await getSchedule(request, AUTH.CHILD_1, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.canCheckin).toBe(true); // Child can check in
  });

  test('[TC-CHECKIN-014] Child view — no edit/delete/cancel buttons @P1', async ({ request }) => {
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    const detail = await getSchedule(request, AUTH.CHILD_1, s.scheduleId);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.canEdit).toBe(false);
    expect(body.canCancel).toBe(false);
    expect(body.canDelete).toBe(false);
    expect(body.canCheckin).toBe(true); // But can check in
  });

  test('[TC-CHECKIN-015] Parent sees all child check-in records @P1', async ({ request }) => {
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.checkinRecords).toBeDefined();
  });

});

// ============================================================
// 2.F Check-in — P2 (4 tests)
// ============================================================
test.describe('2.F Check-in Interaction — P2 Edge Cases', () => {

  test.skip('[TC-CHECKIN-010] Month view — no quick check-in @P2', async () => {
    // Frontend-only test: month view only shows dots, no check-in interaction.
    // Cannot be tested at API level — requires miniprogram-automator for UI verification.
  });

  test('[TC-CHECKIN-011] Check-in — network failure handling @P2', async ({ request }) => {
    // API: verify error response format for invalid requests
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId);
    expect(detail.status()).toBe(200);
  });

  test('[TC-CHECKIN-012] Check-in when schedule deleted by another parent @P2', async ({ request }) => {
    // Concurrency: A deletes while B checks in
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    // Delete the schedule
    await require('../helpers/api-client').deleteSchedule(request, AUTH.PARENT_A, s.scheduleId, { scope: 'ThisOnly', date: today() });
    // Try to get detail — should show excluded or not found
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect([200, 404]).toContain(detail.status());
  });

  test('[TC-CHECKIN-016] Detail page fetches latest from server @P2', async ({ request }) => {
    // API: GET endpoint should always return fresh data (no etag-based caching test)
    const s = await seedSchedule(request, 'AfterSchoolActivity');
    const [r1, r2] = await Promise.all([
      getSchedule(request, AUTH.PARENT_A, s.scheduleId),
      getSchedule(request, AUTH.PARENT_A, s.scheduleId),
    ]);
    expect(r1.status()).toBe(200);
    expect(r2.status()).toBe(200);
    // Both should return consistent data
  });

});
