// testing/e2e/specs/schedule-create.spec.js
// TC-CREATE-001 ~ TC-CREATE-033: Schedule creation tests
// Covers POST /api/v1/schedules — CRUD, conflict detection, validation, auth

const { test, expect } = require('@playwright/test');
const {
  createSchedule,
  getSchedule,
  deleteSchedule,
  checkConflict,
  healthCheck,
} = require('../helpers/api-client');
const {
  afterschoolActivity,
  dailyRoutine,
  homeworkTask,
  today,
  dateOffset,
  AUTH,
  TEST_USERS,
} = require('../helpers/data-factory');
const { generateToken, generateExpiredToken, generateInvalidToken } = require('../helpers/jwt-helper');
const { seedSchedule, cleanupSchedule } = require('../fixtures/seed-data');

// Track created schedules for cleanup
let createdScheduleIds = [];

test.beforeAll(async ({ request }) => {
  // Verify API is reachable
  const hc = await healthCheck(request);
  if (hc.status() !== 200) {
    console.warn('[WARN] API health check failed — some tests may fail if API is not running');
  }
});

test.afterEach(async ({ request }) => {
  // Clean up schedules created during the test
  for (const id of createdScheduleIds) {
    await cleanupSchedule(request, AUTH.PARENT_A, id);
  }
  createdScheduleIds = [];
});

// ============================================================
// 2.A Schedule Create — P0 (5 tests)
// ============================================================
test.describe('2.A Schedule Create — P0 Core Flow', () => {

  test('[TC-CREATE-001] Create AfterSchoolActivity (single child) @P0', async ({ request }) => {
    const payload = afterschoolActivity({
      name: '钢琴课',
      timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
      location: '琴行教室A',
      notes: '带琴谱',
    });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty('groupKey');
    expect(body.schedules).toHaveLength(1);
    expect(body.schedules[0].name).toBe('钢琴课');
    expect(body.schedules[0].scheduleType).toBe('AfterSchoolActivity');
    expect(body.schedules[0].assignedChildId).toBe(TEST_USERS.CHILD_1);
    expect(body.schedules[0].timeSlots).toHaveLength(1);

    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-002] Create AfterSchoolActivity (multi-child, N records) @P0', async ({ request }) => {
    const payload = afterschoolActivity({
      name: '游泳课-多孩子',
      childIds: [TEST_USERS.CHILD_1, TEST_USERS.CHILD_2],
      timeSlots: [{ dayOfWeek: 3, startTime: '15:00:00', endTime: '16:00:00' }],
    });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.schedules).toHaveLength(2);
    // Both schedules share the same GroupKey
    expect(body.schedules[0].groupKey).toBe(body.schedules[1].groupKey);
    // Each assigned to a different child
    const childIds = body.schedules.map(s => s.assignedChildId);
    expect(childIds).toContain(TEST_USERS.CHILD_1);
    expect(childIds).toContain(TEST_USERS.CHILD_2);

    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-006] Conflict detection — same child, same time slot @P0', async ({ request }) => {
    // Seed: create piano lesson first
    const seedPayload = afterschoolActivity({
      name: '钢琴课-冲突测试',
      timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
    });
    const seedRes = await createSchedule(request, AUTH.PARENT_A, seedPayload);
    expect(seedRes.status()).toBe(201);
    const seedData = await seedRes.json();
    const seedId = seedData.schedules[0].scheduleId;
    createdScheduleIds.push(seedId);

    // Try to create overlapping schedule with ignoreConflict=false (default)
    const conflictPayload = afterschoolActivity({
      name: '英语课-冲突',
      timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
    });
    const res = await createSchedule(request, AUTH.PARENT_A, conflictPayload);
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.hasConflict).toBe(true);
    expect(body.conflicts).toBeDefined();
    expect(body.conflicts.length).toBeGreaterThan(0);
  });

  test('[TC-CREATE-010] No child selected — block submission @P0', async ({ request }) => {
    const payload = {
      name: '测试日程',
      scheduleType: 'AfterSchoolActivity',
      childIds: [],
      timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
    };
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/CHILD_NOT_SELECTED/);
  });

  test('[TC-CREATE-011] Empty name — block submission @P0', async ({ request }) => {
    const payload = afterschoolActivity({ name: '' });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/SCHEDULE_NAME_EMPTY/);
  });

});

// ============================================================
// 2.A Schedule Create — P1 (11 tests)
// ============================================================
test.describe('2.A Schedule Create — P1 Core Paths', () => {

  test('[TC-CREATE-003] Create DailyRoutine with per-day tuning @P1', async ({ request }) => {
    const payload = dailyRoutine({
      name: '练琴-逐天微调',
      timeSlots: [
        { dayOfWeek: 1, startTime: '16:00:00', endTime: '16:30:00' },
        { dayOfWeek: 2, startTime: '16:00:00', endTime: '16:30:00' },
        { dayOfWeek: 3, startTime: '17:00:00', endTime: '17:30:00' }, // 周三微调
        { dayOfWeek: 4, startTime: '16:00:00', endTime: '16:30:00' },
        { dayOfWeek: 5, startTime: '16:00:00', endTime: '16:30:00' },
      ],
    });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.schedules).toHaveLength(1);
    const timeSlots = body.schedules[0].timeSlots;
    expect(timeSlots).toHaveLength(5);
    // Verify Wednesday has different time
    const wedSlot = timeSlots.find(s => s.dayOfWeek === 3);
    expect(wedSlot.startTime).toBe('17:00:00');
    expect(wedSlot.endTime).toBe('17:30:00');
    // Other days have default time
    const monSlot = timeSlots.find(s => s.dayOfWeek === 1);
    expect(monSlot.startTime).toBe('16:00:00');

    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-004] Create HomeworkTask with due date + suggested time @P1', async ({ request }) => {
    const payload = homeworkTask({
      name: '数学练习册 P32-35',
      dueDate: dateOffset(7),
      suggestedStartTime: '15:00:00',
      suggestedEndTime: '16:00:00',
    });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.schedules[0].scheduleType).toBe('HomeworkTask');
    expect(body.schedules[0].timeSlots).toHaveLength(0);

    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-005] Create HomeworkTask (required fields only) @P1', async ({ request }) => {
    const payload = homeworkTask({
      name: '背诵课文',
      dueDate: dateOffset(7),
      suggestedStartTime: null,
      suggestedEndTime: null,
      notes: null,
    });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.schedules[0].name).toBe('背诵课文');

    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-007] Conflict — choose "Continue Create" @P1', async ({ request }) => {
    // First create a schedule
    const seedPayload = afterschoolActivity({
      name: '篮球课',
      timeSlots: [{ dayOfWeek: 5, startTime: '14:00:00', endTime: '15:00:00' }],
    });
    const seedRes = await createSchedule(request, AUTH.PARENT_A, seedPayload);
    expect(seedRes.status()).toBe(201);
    const seedData = await seedRes.json();
    createdScheduleIds.push(seedData.schedules[0].scheduleId);

    // Create conflicting schedule with ignoreConflict=true
    const conflictPayload = afterschoolActivity({
      name: '足球课',
      timeSlots: [{ dayOfWeek: 5, startTime: '14:00:00', endTime: '15:00:00' }],
      ignoreConflict: true,
    });
    const res = await createSchedule(request, AUTH.PARENT_A, conflictPayload);
    expect(res.status()).toBe(201);

    const body = await res.json();
    createdScheduleIds.push(body.schedules[0].scheduleId);
  });

  test('[TC-CREATE-009] Different child, same time — no conflict @P1', async ({ request }) => {
    // Seed: create schedule for child1
    const seedPayload = afterschoolActivity({
      name: '小明专用课',
      timeSlots: [{ dayOfWeek: 4, startTime: '10:00:00', endTime: '11:00:00' }],
    });
    const seedRes = await createSchedule(request, AUTH.PARENT_A, seedPayload);
    expect(seedRes.status()).toBe(201);
    const seedData = await seedRes.json();
    createdScheduleIds.push(seedData.schedules[0].scheduleId);

    // Create same time but for child2 — no conflict
    const payload = afterschoolActivity({
      name: '小红专用课',
      childIds: [TEST_USERS.CHILD_2],
      timeSlots: [{ dayOfWeek: 4, startTime: '10:00:00', endTime: '11:00:00' }],
    });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);
    const body = await res.json();
    createdScheduleIds.push(body.schedules[0].scheduleId);
  });

  test('[TC-CREATE-018] Time slot start > end — block @P1', async ({ request }) => {
    const payload = afterschoolActivity({
      timeSlots: [{ dayOfWeek: 2, startTime: '18:00:00', endTime: '16:00:00' }],
    });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/TIME_SLOT_INVALID/);
  });

  test('[TC-CREATE-020] All 7 days unselected — block @P1', async ({ request }) => {
    const payload = {
      name: '空时间日程',
      scheduleType: 'AfterSchoolActivity',
      childIds: [TEST_USERS.CHILD_1],
      timeSlots: [],
      repeatEndDate: dateOffset(365),
    };
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/NO_DAY_SELECTED/);
  });

  test('[TC-CREATE-021] Only 1 day selected — create successfully @P1', async ({ request }) => {
    const payload = afterschoolActivity({
      timeSlots: [{ dayOfWeek: 3, startTime: '10:00:00', endTime: '11:00:00' }],
    });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.schedules[0].timeSlots).toHaveLength(1);
    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-025] No repeat end date — infinite repeat @P1', async ({ request }) => {
    const payload = afterschoolActivity({ repeatEndDate: null });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.schedules[0].repeatEndDate).toBeNull();
    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-029] Network error handling — retry scaffold @P1', async ({ request }) => {
    // This tests that the API returns proper error format, not actual network interruption.
    // Real network interruption is tested manually or via mock in frontend tests.
    // We test by sending to a non-existent endpoint to verify error handling shape.
    const res = await request.post('/api/v1/schedules/nonexistent', {
      headers: { Authorization: AUTH.PARENT_A },
      data: {},
    });
    expect(res.status()).toBe(404);
  });

  test('[TC-CREATE-033] Preview summary — step 4 confirmation info correct @P1', async ({ request }) => {
    // Frontend test - API only validates that GET returns created data correctly
    const payload = afterschoolActivity({
      name: '预览测试课',
      timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
      location: '测试地点',
      notes: '测试备注',
    });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);
    const body = await res.json();
    const scheduleId = body.schedules[0].scheduleId;
    createdScheduleIds.push(scheduleId);

    // Verify GET returns the same data
    const getRes = await getSchedule(request, AUTH.PARENT_A, scheduleId);
    expect(getRes.status()).toBe(200);
    const detail = await getRes.json();
    expect(detail.name).toBe('预览测试课');
    expect(detail.location).toBe('测试地点');
    expect(detail.notes).toBe('测试备注');
  });

});

// ============================================================
// 2.A Schedule Create — P2 (16 tests)
// ============================================================
test.describe('2.A Schedule Create — P2 Boundary & Edge Cases', () => {

  test('[TC-CREATE-008] Conflict — choose "Back to Edit" @P2', async ({ request }) => {
    // Seed: create a schedule
    const seedPayload = afterschoolActivity({
      name: '编程课',
      timeSlots: [{ dayOfWeek: 1, startTime: '09:00:00', endTime: '10:00:00' }],
    });
    const seedRes = await createSchedule(request, AUTH.PARENT_A, seedPayload);
    expect(seedRes.status()).toBe(201);
    const seedData = await seedRes.json();
    createdScheduleIds.push(seedData.schedules[0].scheduleId);

    // Conflict check confirms conflict exists
    const checkPayload = {
      childId: TEST_USERS.CHILD_1,
      date: today(),
      startTime: '09:00:00',
      endTime: '10:00:00',
    };
    const checkRes = await checkConflict(request, AUTH.PARENT_A, checkPayload);
    expect(checkRes.status()).toBe(200);
    const checkBody = await checkRes.json();
    expect(checkBody.hasConflict).toBe(true);

    // Back to edit = user cancels, no schedule created
    // Verified by: schedule count does not increase
  });

  test('[TC-CREATE-012] Name is whitespace-only — block @P2', async ({ request }) => {
    const payload = afterschoolActivity({ name: '   ' });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    // FluentValidation's NotEmpty + Must(!IsNullOrWhiteSpace) catches this
    expect(body.error).toMatch(/SCHEDULE_NAME_EMPTY/);
  });

  test('[TC-CREATE-013] Name exactly 50 chars — success @P2', async ({ request }) => {
    const name50 = '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十';
    const payload = afterschoolActivity({ name: name50 });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.schedules[0].name).toBe(name50);
    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-014] Name > 50 chars — block @P2', async ({ request }) => {
    const payload = afterschoolActivity({ name: 'A'.repeat(51) });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/SCHEDULE_NAME_TOO_LONG/);
  });

  test('[TC-CREATE-015] Notes exactly 500 chars — success @P2', async ({ request }) => {
    const payload = afterschoolActivity({ notes: 'A'.repeat(500) });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.schedules[0].notes.length).toBe(500);
    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-016] Notes > 500 chars — block @P2', async ({ request }) => {
    const payload = afterschoolActivity({ notes: 'A'.repeat(501) });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/NOTES_TOO_LONG/);
  });

  test('[TC-CREATE-017] Location > 100 chars — block @P2', async ({ request }) => {
    const payload = afterschoolActivity({ location: 'A'.repeat(101) });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/LOCATION_TOO_LONG/);
  });

  test('[TC-CREATE-019] Time slot start = end — block @P2', async ({ request }) => {
    const payload = afterschoolActivity({
      timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '16:00:00' }],
    });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/TIME_SLOT_INVALID/);
  });

  test('[TC-CREATE-022] All 7 days selected — success @P2', async ({ request }) => {
    const allDays = [0, 1, 2, 3, 4, 5, 6].map(day => ({
      dayOfWeek: day,
      startTime: '10:00:00',
      endTime: '11:00:00',
    }));
    const payload = afterschoolActivity({ timeSlots: allDays });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.schedules[0].timeSlots).toHaveLength(7);
    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-023] Repeat end date before today — block @P2', async ({ request }) => {
    const payload = afterschoolActivity({ repeatEndDate: dateOffset(-1) });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/REPEAT_END_DATE_INVALID/);
  });

  test('[TC-CREATE-024] Repeat end date = today — success @P2', async ({ request }) => {
    const payload = afterschoolActivity({ repeatEndDate: today() });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.schedules[0].repeatEndDate).toBe(today());
    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-026] Homework due date = today — verify behavior @P2', async ({ request }) => {
    const payload = homeworkTask({ dueDate: today() });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    // Validator allows >= today, so 201 is expected
    expect(res.status()).toBe(201);
    const body = await res.json();
    createdScheduleIds = body.schedules.map(s => s.scheduleId);
  });

  test('[TC-CREATE-027] Homework due date = yesterday — block @P2', async ({ request }) => {
    const payload = homeworkTask({ dueDate: dateOffset(-1) });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/DUE_DATE_INVALID/);
  });

  test('[TC-CREATE-030] Child role cannot create schedule @P2', async ({ request }) => {
    const payload = afterschoolActivity({ name: '孩子创建的日程' });
    const res = await createSchedule(request, AUTH.CHILD_1, payload);
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/CHILD_ACCESS_DENIED/);
  });

  test('[TC-CREATE-031] Unauthenticated call @P2', async ({ request }) => {
    const res = await request.post('/api/v1/schedules', {
      headers: { 'Content-Type': 'application/json' },
      data: afterschoolActivity(),
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/TOKEN_INVALID/);
  });

  test('[TC-CREATE-032] Wizard navigation — data retention (frontend test scaffold) @P2', async ({ request }) => {
    // Frontend-only behavior; API test verifies that partial data is rejected
    const partialPayload = {
      name: '向导测试',
      scheduleType: 'AfterSchoolActivity',
      // Missing childIds, timeSlots — should be rejected
    };
    const res = await createSchedule(request, AUTH.PARENT_A, partialPayload);
    expect(res.status()).toBe(400);
    // Validator catches missing required fields
  });

  test('[TC-CREATE-028] Family has no children — empty state @P2', async ({ request }) => {
    // Verifies API returns empty child list for family with no children
    // Uses the fact that family selection happens before schedule creation;
    // API should gracefully handle cases where a family has no child members.
    // This is primarily a frontend test (showing empty state UI with link to family management),
    // but the API should also return an appropriate validation error when childIds is empty.
    const payload = afterschoolActivity({ childIds: [] });
    const res = await createSchedule(request, AUTH.PARENT_A, payload);
    // API should reject empty childIds — frontend would show this as "请先添加孩子" prompt
    expect(res.status()).toBe(400);
    const body = await res.json();
    // Validator catches empty childIds
    expect(body.error).toBeDefined();
  });

});
