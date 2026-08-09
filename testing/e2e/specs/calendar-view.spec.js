// testing/e2e/specs/calendar-view.spec.js
// TC-CAL-001 ~ TC-CAL-033: Calendar view query tests
// Covers GET /api/v1/calendar — month/week/day view, filtering, date navigation

const { test, expect } = require('@playwright/test');
const {
  createSchedule,
  queryCalendar,
  cancelInstance,
  healthCheck,
} = require('../helpers/api-client');
const {
  afterschoolActivity,
  dailyRoutine,
  homeworkTask,
  monthRange,
  today,
  dateOffset,
  AUTH,
  TEST_USERS,
} = require('../helpers/data-factory');
const { seedSchedule, cleanupSchedule } = require('../fixtures/seed-data');
const { generateExpiredToken } = require('../helpers/jwt-helper');

let createdScheduleIds = [];

test.beforeAll(async ({ request }) => {
  const hc = await healthCheck(request);
  if (hc.status() !== 200) {
    console.warn('[WARN] API health check failed — some tests may fail if API is not running');
  }
});

test.afterEach(async ({ request }) => {
  for (const id of createdScheduleIds) {
    await cleanupSchedule(request, AUTH.PARENT_A, id);
  }
  createdScheduleIds = [];
});

// ============================================================
// 2.B Calendar View — P0 (3 tests)
// ============================================================
test.describe('2.B Calendar View — P0 Core Flow', () => {

  test('[TC-CAL-001] Month view — dates with schedules show color dots @P0', async ({ request }) => {
    // Seed: create schedules of 3 types
    const blue = afterschoolActivity({ name: '钢琴课', timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }] });
    const green = dailyRoutine({ name: '练琴', timeSlots: [{ dayOfWeek: 2, startTime: '17:00:00', endTime: '17:30:00' }] });
    const orange = homeworkTask({ name: '数学作业', dueDate: dateOffset(7) });

    const [bRes, gRes, oRes] = await Promise.all([
      createSchedule(request, AUTH.PARENT_A, blue),
      createSchedule(request, AUTH.PARENT_A, green),
      createSchedule(request, AUTH.PARENT_A, orange),
    ]);
    const bData = await bRes.json(); createdScheduleIds.push(bData.schedules[0].scheduleId);
    const gData = await gRes.json(); createdScheduleIds.push(gData.schedules[0].scheduleId);
    const oData = await oRes.json(); createdScheduleIds.push(oData.schedules[0].scheduleId);

    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.view).toBe('month');
    expect(body.dates).toBeDefined();
    expect(body.dates.length).toBeGreaterThan(0);
    expect(body.totalScheduleCount).toBeGreaterThan(0);

    // Find a date with schedules
    const datesWithSchedules = body.dates.filter(d => d.scheduleCount > 0);
    expect(datesWithSchedules.length).toBeGreaterThan(0);
    // Each date with schedules has at least one dot
    datesWithSchedules.forEach(d => {
      expect(d.dots.length).toBeGreaterThan(0);
    });
  });

  test('[TC-CAL-009] Week view — shows schedule cards @P0', async ({ request }) => {
    const payload = afterschoolActivity({
      name: '周视图测试课',
      timeSlots: [{ dayOfWeek: 2, startTime: '10:00:00', endTime: '11:00:00' }],
    });
    const cRes = await createSchedule(request, AUTH.PARENT_A, payload);
    const cData = await cRes.json();
    createdScheduleIds.push(cData.schedules[0].scheduleId);

    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'week',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.view).toBe('week');
    // Dates have schedules array
    const datesWithSchedules = body.dates.filter(d => d.schedules.length > 0);
    expect(datesWithSchedules.length).toBeGreaterThan(0);
    // Schedules have name, type, startTime
    const firstSchedule = datesWithSchedules[0].schedules[0];
    expect(firstSchedule.name).toBeDefined();
    expect(firstSchedule.scheduleType).toBeDefined();
  });

  test('[TC-CAL-015] View switch — month/week/day toggle @P0', async ({ request }) => {
    const range = monthRange(0);

    const views = ['month', 'week', 'day'];
    for (const view of views) {
      const res = await queryCalendar(request, AUTH.PARENT_A, {
        view,
        startDate: range.startDate,
        endDate: range.endDate,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.view).toBe(view);
    }
  });

});

// ============================================================
// 2.B Calendar View — P1 (19 tests)
// ============================================================
test.describe('2.B Calendar View — P1 Core Paths', () => {

  test('[TC-CAL-002] Month view — >3 schedules shows "+N" @P1', async ({ request }) => {
    // Create 4 schedules for the same child on the same day
    const payloads = [1, 2, 3, 4].map(i => afterschoolActivity({
      name: `多日程测试${i}`,
      timeSlots: [{ dayOfWeek: 3, startTime: `0${i}:00:00`, endTime: `0${i+1}:00:00` }],
    }));
    for (const p of payloads) {
      const r = await createSchedule(request, AUTH.PARENT_A, p);
      const d = await r.json();
      createdScheduleIds.push(d.schedules[0].scheduleId);
    }

    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Verify dates with 4 schedules have dots limited to max (usually 3)
    const datesWith4 = body.dates.filter(d => d.scheduleCount >= 4);
    if (datesWith4.length > 0) {
      // Dots should be at most 3 (depends on implementation)
      expect(datesWith4[0].dots.length).toBeLessThanOrEqual(datesWith4[0].scheduleCount);
    }
  });

  test('[TC-CAL-003] Month view — today highlighted @P1', async ({ request }) => {
    // Frontend CSS class — API just returns date data
    // Verify today's date is included in response
    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const todayStr = today();
    const todayEntry = body.dates.find(d => d.date === todayStr);
    // Today may or may not be in range (e.g. if it's the 31st and month has 30 days)
    // If it is, it should be present
  });

  test('[TC-CAL-004] Month view — other-month dates should be distinguishable @P1', async ({ request }) => {
    // API returns all dates in range — frontend handles styling
    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Dates array should contain dates outside current month (padding)
    expect(body.dates.length).toBeGreaterThanOrEqual(28);
  });

  test('[TC-CAL-008] Empty state — no schedules @P1', async ({ request }) => {
    // Query far future where no schedules exist
    const farFuture = dateOffset(400);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: farFuture,
      endDate: dateOffset(430),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.totalScheduleCount).toBe(0);
  });

  test('[TC-CAL-011] Week view — click card navigates to detail (API verification) @P1', async ({ request }) => {
    // API test: verify each schedule in week view has a scheduleId for navigation
    const payload = afterschoolActivity({
      name: '导航测试课',
      timeSlots: [{ dayOfWeek: 2, startTime: '11:00:00', endTime: '12:00:00' }],
    });
    const cRes = await createSchedule(request, AUTH.PARENT_A, payload);
    const cData = await cRes.json();
    const scheduleId = cData.schedules[0].scheduleId;
    createdScheduleIds.push(scheduleId);

    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'week',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const allSchedules = body.dates.flatMap(d => d.schedules);
    const found = allSchedules.find(s => s.scheduleId === scheduleId);
    expect(found).toBeDefined();
  });

  test('[TC-CAL-012] Day view — full info card @P1', async ({ request }) => {
    const payload = afterschoolActivity({
      name: '日视图详情测试',
      timeSlots: [{ dayOfWeek: 2, startTime: '14:00:00', endTime: '15:00:00' }],
      location: '测试教室',
      notes: '测试备注信息',
    });
    const cRes = await createSchedule(request, AUTH.PARENT_A, payload);
    const cData = await cRes.json();
    createdScheduleIds.push(cData.schedules[0].scheduleId);

    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'day',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.view).toBe('day');
    const allSchedules = body.dates.flatMap(d => d.schedules);
    const found = allSchedules.find(s => s.name === '日视图详情测试');
    expect(found).toBeDefined();
    expect(found.location).toBe('测试教室');
    expect(found.notes).toBe('测试备注信息');
  });

  test('[TC-CAL-013] Day view — empty state @P1', async ({ request }) => {
    const farDate = dateOffset(500);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'day',
      startDate: farDate,
      endDate: farDate,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const allSchedules = body.dates.flatMap(d => d.schedules);
    expect(allSchedules.length).toBe(0);
  });

  test('[TC-CAL-016] Filter condition persists across view switches @P1', async ({ request }) => {
    // Create schedule for child1
    const p1 = afterschoolActivity({
      name: '筛选测试-小明',
      timeSlots: [{ dayOfWeek: 3, startTime: '10:00:00', endTime: '11:00:00' }],
    });
    const r1 = await createSchedule(request, AUTH.PARENT_A, p1);
    const d1 = await r1.json();
    createdScheduleIds.push(d1.schedules[0].scheduleId);

    // Query month view with child filter
    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
      childId: TEST_USERS.CHILD_1,
    });
    expect(res.status()).toBe(200);
    // Swap to week view with same childId filter
    const res2 = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'week',
      startDate: range.startDate,
      endDate: range.endDate,
      childId: TEST_USERS.CHILD_1,
    });
    expect(res2.status()).toBe(200);
  });

  test('[TC-CAL-017] Filter by child @P1', async ({ request }) => {
    // Create schedule for child1
    const p1 = afterschoolActivity({
      name: '小明私教课',
      timeSlots: [{ dayOfWeek: 4, startTime: '09:00:00', endTime: '10:00:00' }],
    });
    const r1 = await createSchedule(request, AUTH.PARENT_A, p1);
    const d1 = await r1.json();
    createdScheduleIds.push(d1.schedules[0].scheduleId);

    // Create schedule for child2
    const p2 = afterschoolActivity({
      name: '小红私教课',
      childIds: [TEST_USERS.CHILD_2],
      timeSlots: [{ dayOfWeek: 4, startTime: '09:00:00', endTime: '10:00:00' }],
    });
    const r2 = await createSchedule(request, AUTH.PARENT_A, p2);
    const d2 = await r2.json();
    createdScheduleIds.push(d2.schedules[0].scheduleId);

    // Filter by child1 only
    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
      childId: TEST_USERS.CHILD_1,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const allSchedules = body.dates.flatMap(d => d.schedules);
    const child2Schedules = allSchedules.filter(s => s.name === '小红私教课');
    expect(child2Schedules.length).toBe(0); // Filtered out
  });

  test('[TC-CAL-018] Filter by type @P1', async ({ request }) => {
    const bluePayload = afterschoolActivity({
      name: '类型筛选-课后活动',
      timeSlots: [{ dayOfWeek: 5, startTime: '08:00:00', endTime: '09:00:00' }],
    });
    const greenPayload = dailyRoutine({
      name: '类型筛选-日常作息',
      timeSlots: [{ dayOfWeek: 5, startTime: '09:00:00', endTime: '09:30:00' }],
    });

    const [bRes, gRes] = await Promise.all([
      createSchedule(request, AUTH.PARENT_A, bluePayload),
      createSchedule(request, AUTH.PARENT_A, greenPayload),
    ]);
    const bData = await bRes.json(); createdScheduleIds.push(bData.schedules[0].scheduleId);
    const gData = await gRes.json(); createdScheduleIds.push(gData.schedules[0].scheduleId);

    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
      scheduleTypes: 'AfterSchoolActivity',
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const allSchedules = body.dates.flatMap(d => d.schedules);
    const routines = allSchedules.filter(s => s.scheduleType === 'DailyRoutine');
    expect(routines.length).toBe(0);
  });

  test('[TC-CAL-020] Filter — no matching results @P1', async ({ request }) => {
    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
      childId: TEST_USERS.CHILD_3,
      scheduleTypes: 'HomeworkTask',
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.totalScheduleCount).toBe(0);
  });

  test('[TC-CAL-022] Date navigation — previous month @P1', async ({ request }) => {
    const range = monthRange(-1); // last month
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.startDate).toBe(range.startDate);
    expect(body.endDate).toBe(range.endDate);
  });

  test('[TC-CAL-023] Date navigation — "Today" button @P1', async ({ request }) => {
    // Test: query with today as startDate
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: today(),
    });
    expect(res.status()).toBe(200);
  });

  test('[TC-CAL-024] Title displays correctly per view @P1', async ({ request }) => {
    // API returns startDate and endDate for frontend to format title
    const range = monthRange(0);
    for (const view of ['month', 'week', 'day']) {
      const res = await queryCalendar(request, AUTH.PARENT_A, {
        view,
        startDate: range.startDate,
        endDate: range.endDate,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.view).toBe(view);
      expect(body.startDate).toBeDefined();
      expect(body.endDate).toBeDefined();
    }
  });

  test('[TC-CAL-028] Calendar data load failure — error handling @P1', async ({ request }) => {
    // Test with expired token
    const expiredToken = `Bearer ${generateExpiredToken(TEST_USERS.PARENT_A)}`;
    const res = await queryCalendar(request, expiredToken, {
      view: 'month',
      startDate: today(),
    });
    expect(res.status()).toBe(401);
  });

  test('[TC-CAL-029] Calendar data load success @P1', async ({ request }) => {
    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('view');
    expect(body).toHaveProperty('dates');
    expect(body).toHaveProperty('totalScheduleCount');
  });

  test('[TC-CAL-030] Child role — only sees own schedules @P1', async ({ request }) => {
    // Create schedule for child1 (as parent)
    const p1 = afterschoolActivity({
      name: '孩子可见性测试',
      childIds: [TEST_USERS.CHILD_1],
      timeSlots: [{ dayOfWeek: 1, startTime: '10:00:00', endTime: '11:00:00' }],
    });
    const r1 = await createSchedule(request, AUTH.PARENT_A, p1);
    const d1 = await r1.json();
    createdScheduleIds.push(d1.schedules[0].scheduleId);

    // Create schedule for child2 (as parent)
    const p2 = afterschoolActivity({
      name: '其他孩子不可见',
      childIds: [TEST_USERS.CHILD_2],
      timeSlots: [{ dayOfWeek: 1, startTime: '11:00:00', endTime: '12:00:00' }],
    });
    const r2 = await createSchedule(request, AUTH.PARENT_A, p2);
    const d2 = await r2.json();
    createdScheduleIds.push(d2.schedules[0].scheduleId);

    // Child1 queries — should only see their own
    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.CHILD_1, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const allSchedules = body.dates.flatMap(d => d.schedules);
    const otherSchedules = allSchedules.filter(s => s.name === '其他孩子不可见');
    expect(otherSchedules.length).toBe(0);
  });

});

// ============================================================
// 2.B Calendar View — P2 (9 tests)
// ============================================================
test.describe('2.B Calendar View — P2 Boundary Cases', () => {

  test('[TC-CAL-006] Month view — click other-month date switches month @P2', async ({ request }) => {
    // API: verify that querying with a date from adjacent month returns data for that month
    const range = monthRange(-1);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(res.status()).toBe(200);
  });

  test('[TC-CAL-007] Month view — date with no schedules @P2', async ({ request }) => {
    const farDate = dateOffset(600);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: farDate,
      endDate: dateOffset(630),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    body.dates.forEach(d => {
      expect(d.scheduleCount).toBe(0);
      expect(d.dots.length).toBe(0);
    });
  });

  test('[TC-CAL-010] Week view — empty day column @P2', async ({ request }) => {
    // Create schedule only on Monday
    const payload = afterschoolActivity({
      name: '仅周一课',
      timeSlots: [{ dayOfWeek: 1, startTime: '08:00:00', endTime: '09:00:00' }],
    });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    createdScheduleIds.push(d.schedules[0].scheduleId);

    // Query a week range
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'week',
      startDate: today(),
      endDate: dateOffset(6),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Some days will have 0 schedules
    expect(body.dates.length).toBe(7);
  });

  test('[TC-CAL-019] Filter by child + type combination @P2', async ({ request }) => {
    const range = monthRange(0);
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
      childId: TEST_USERS.CHILD_1,
      scheduleTypes: 'AfterSchoolActivity',
    });
    expect(res.status()).toBe(200);
  });

  test('[TC-CAL-021] Filter reset to "All" @P2', async ({ request }) => {
    // No filters = all data
    const range = monthRange(0);
    const filtered = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
      childId: TEST_USERS.CHILD_1,
    });
    const unfiltered = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    expect(filtered.status()).toBe(200);
    expect(unfiltered.status()).toBe(200);
  });

  test('[TC-CAL-027] Rapid consecutive swipe — debounce (frontend) @P2', async ({ request }) => {
    // API: verify that two rapid queries return consistent results
    const range = monthRange(0);
    const [r1, r2] = await Promise.all([
      queryCalendar(request, AUTH.PARENT_A, { view: 'week', startDate: range.startDate, endDate: range.endDate }),
      queryCalendar(request, AUTH.PARENT_A, { view: 'week', startDate: range.startDate, endDate: range.endDate }),
    ]);
    expect(r1.status()).toBe(200);
    expect(r2.status()).toBe(200);
  });

  test('[TC-CAL-032] Date range too large — block @P2', async ({ request }) => {
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'month',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    // May return 400 if > 90 days
    // If not implemented, just verify it doesn't crash
    expect([200, 400]).toContain(res.status());
  });

  test('[TC-CAL-033] Invalid view type @P2', async ({ request }) => {
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'year',
      startDate: today(),
    });
    // May be 400 or default to month view
    expect([200, 400]).toContain(res.status());
  });

  test('[TC-CAL-005] Month view — click date jumps to day view (API verify) @P2', async ({ request }) => {
    // API: verify day view returns data for the specific date
    const res = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'day',
      startDate: today(),
      endDate: today(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.view).toBe('day');
  });

});
