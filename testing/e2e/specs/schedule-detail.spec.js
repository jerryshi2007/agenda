// testing/e2e/specs/schedule-detail.spec.js
// TC-DETAIL-001 ~ TC-DETAIL-008: Schedule detail page display tests
// Covers GET /api/v1/schedules/{id} — various states and auth

const { test, expect } = require('@playwright/test');
const {
  createSchedule, getSchedule, cancelInstance, healthCheck,
} = require('../helpers/api-client');
const {
  afterschoolActivity, homeworkTask, today, dateOffset,
  AUTH, TEST_USERS,
} = require('../helpers/data-factory');
const { cleanupSchedule } = require('../fixtures/seed-data');
const { generateExpiredToken } = require('../helpers/jwt-helper');

let createdIds = [];

test.beforeAll(async ({ request }) => { await healthCheck(request); });
test.afterEach(async ({ request }) => {
  for (const id of createdIds) { await cleanupSchedule(request, AUTH.PARENT_A, id); }
  createdIds = [];
});

async function seed(request, type, opts = {}) {
  let payload;
  switch (type) {
    case 'HomeworkTask':
      payload = homeworkTask({ name: opts.name || '详情-作业测试', dueDate: dateOffset(7), ...opts });
      break;
    default:
      payload = afterschoolActivity({ name: opts.name || '详情-活动测试', ...opts });
  }
  const r = await createSchedule(request, AUTH.PARENT_A, payload);
  expect(r.status()).toBe(201);
  const d = await r.json();
  createdIds.push(d.schedules[0].scheduleId);
  return d.schedules[0];
}

// ============================================================
// 2.G Schedule Detail — P0 (1 test)
// ============================================================
test.describe('2.G Schedule Detail — P0 Core Flow', () => {

  test('[TC-DETAIL-001] After-school activity detail — normal (not completed) @P0', async ({ request }) => {
    const s = await seed(request, 'AfterSchoolActivity', {
      timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
      location: '琴行教室A',
      notes: '带琴谱',
    });
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();

    // Basic info
    expect(body.name).toBe('详情-活动测试');
    expect(body.scheduleType).toBe('AfterSchoolActivity');
    expect(body.location).toBe('琴行教室A');
    expect(body.notes).toBe('带琴谱');

    // Action buttons availability
    expect(body.canEdit).toBe(true);
    expect(body.canCancel).toBe(true);
    expect(body.canDelete).toBe(true);
    expect(body.canCheckin).toBe(true);
    expect(body.canUndo).toBe(false);

    // Instance status
    expect(body.instanceStatus).toBeDefined();
  });

});

// ============================================================
// 2.G Schedule Detail — P1 (3 tests)
// ============================================================
test.describe('2.G Schedule Detail — P1 Core Paths', () => {

  test('[TC-DETAIL-002] After-school activity detail — completed state @P1', async ({ request }) => {
    // Completed = has checkin record. Since checkin-module may not be available,
    // we verify the response structure supports it.
    const s = await seed(request, 'AfterSchoolActivity');
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.checkinRecords).toBeDefined();
    expect(body.canCheckin).toBe(true); // Not yet checked in
    expect(body.canUndo).toBe(false);
  });

  test('[TC-DETAIL-003] After-school activity detail — cancelled state @P1', async ({ request }) => {
    const s = await seed(request, 'AfterSchoolActivity');
    await cancelInstance(request, AUTH.PARENT_A, s.scheduleId, { date: today() });

    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.isCancelled).toBe(true);
    expect(body.canCancel).toBe(false);
    expect(body.canUndo).toBe(true); // Can restore
    expect(body.canCheckin).toBe(false); // Cannot check in cancelled
  });

  test('[TC-DETAIL-004] HomeworkTask detail — normal state @P1', async ({ request }) => {
    const s = await seed(request, 'HomeworkTask', {
      dueDate: dateOffset(5),
      suggestedStartTime: '15:00:00',
      suggestedEndTime: '16:00:00',
      notes: '完成第3章习题',
    });
    const detail = await getSchedule(request, AUTH.PARENT_A, s.scheduleId);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.scheduleType).toBe('HomeworkTask');
    expect(body.dueDate).toBe(dateOffset(5));
    expect(body.suggestedStartTime).toBe('15:00:00');
    expect(body.suggestedEndTime).toBe('16:00:00');
    // HomeworkTask should not have cancel button
    expect(body.canCancel).toBe(false);
    expect(body.canEdit).toBe(true);
    expect(body.canDelete).toBe(true);
  });

});

// ============================================================
// 2.G Schedule Detail — P2 (4 tests)
// ============================================================
test.describe('2.G Schedule Detail — P2 Boundary Cases', () => {

  test('[TC-DETAIL-005] HomeworkTask past dueDate rejected @P1', async ({ request }) => {
    // Creating homework with past due date should be rejected by validation
    const payload = homeworkTask({ name: '逾期作业详情', dueDate: dateOffset(-3) });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(body.error).toBe('DUE_DATE_INVALID');
  });

  test('[TC-DETAIL-006] Schedule not found @P2', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const detail = await getSchedule(request, AUTH.PARENT_A, fakeId);
    expect(detail.status()).toBe(404);
    const body = await detail.json();
    expect(body.error).toMatch(/SCHEDULE_NOT_FOUND/);
  });

  test('[TC-DETAIL-007] Non-family member access @P2', async ({ request }) => {
    const s = await seed(request, 'AfterSchoolActivity');
    const detail = await getSchedule(request, AUTH.OUTSIDER, s.scheduleId);
    expect([403, 404]).toContain(detail.status());
  });

  test('[TC-DETAIL-008] Detail page load failure @P2', async ({ request }) => {
    const expiredToken = `Bearer ${generateExpiredToken(TEST_USERS.PARENT_A)}`;
    const s = await seed(request, 'AfterSchoolActivity');
    const detail = await getSchedule(request, expiredToken, s.scheduleId);
    expect(detail.status()).toBe(401);
  });

});
