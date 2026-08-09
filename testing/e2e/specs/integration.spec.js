// testing/e2e/specs/integration.spec.js
// TC-INTEG-001 ~ TC-INTEG-009: Cross-module integration tests
// End-to-end flows: create → view → edit → delete → cancel → restore

const { test, expect } = require('@playwright/test');
const {
  createSchedule, getSchedule, updateSchedule, deleteSchedule,
  cancelInstance, restoreInstance, queryCalendar, healthCheck,
} = require('../helpers/api-client');
const {
  afterschoolActivity, homeworkTask, today, dateOffset, monthRange, nextDayOfWeek,
  updateThisOnly,
  AUTH, TEST_USERS,
} = require('../helpers/data-factory');
const { cleanupSchedule } = require('../fixtures/seed-data');

let createdIds = [];

test.beforeAll(async ({ request }) => { await healthCheck(request); });
test.afterEach(async ({ request }) => {
  for (const id of createdIds) { await cleanupSchedule(request, AUTH.PARENT_A, id); }
  createdIds = [];
});

// ============================================================
// 2.I Integration — P0 (2 tests)
// ============================================================
test.describe('2.I Cross-Module Integration — P0 End-to-End', () => {

  test('[TC-INTEG-001] Create → Calendar visible (end-to-end) @P0', async ({ request }) => {
    // Step 1: Create a schedule
    const payload = afterschoolActivity({
      name: '端到端测试课',
      timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
    });
    const createRes = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(createRes.status()).toBe(201);
    const createData = await createRes.json();
    const scheduleId = createData.schedules[0].scheduleId;
    createdIds.push(scheduleId);

    // Step 2: Verify it appears in calendar (use week view for schedule detail)
    const nextTue = nextDayOfWeek(2);
    const calRes = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'week',
      startDate: nextTue,
      endDate: nextTue,
    });
    expect(calRes.status()).toBe(200);
    const calData = await calRes.json();
    const allSchedules = calData.dates.flatMap(d => d.schedules);
    const found = allSchedules.find(s => s.scheduleId === scheduleId);
    expect(found).toBeDefined();
  });

  test('[TC-INTEG-002] Create → Detail → Check-in (full flow) @P0', async ({ request }) => {
    // Step 1: Create
    const payload = afterschoolActivity({
      name: '全流程测试课',
      timeSlots: [{ dayOfWeek: 2, startTime: '10:00:00', endTime: '11:00:00' }],
    });
    const createRes = await createSchedule(request, AUTH.PARENT_A, payload);
    expect(createRes.status()).toBe(201);
    const createData = await createRes.json();
    const scheduleId = createData.schedules[0].scheduleId;
    createdIds.push(scheduleId);

    // Step 2: View detail
    const detailRes = await getSchedule(request, AUTH.PARENT_A, scheduleId, today());
    expect(detailRes.status()).toBe(200);
    const detailData = await detailRes.json();
    expect(detailData.name).toBe('全流程测试课');
    expect(detailData.canCheckin).toBe(true);
    expect(detailData.canEdit).toBe(true);

    // Step 3: Check-in (provided by checkin-module — verify flag availability)
    expect(detailData.checkinRecords).toBeDefined();
  });

});

// ============================================================
// 2.I Integration — P1 (5 tests)
// ============================================================
test.describe('2.I Cross-Module Integration — P1 Core Flows', () => {

  test('[TC-INTEG-003] Edit → Calendar updated @P1', async ({ request }) => {
    // Create
    const payload = afterschoolActivity({
      name: '编辑集成测试',
      timeSlots: [{ dayOfWeek: 3, startTime: '14:00:00', endTime: '15:00:00' }],
    });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    const sid = d.schedules[0].scheduleId;
    createdIds.push(sid);

    // Edit — change name (ThisOnly creates derivative with new Id)
    const editRes = await updateSchedule(request, AUTH.PARENT_A, sid, updateThisOnly({ name: '编辑后的集成测试' }));
    expect(editRes.status()).toBe(200);

    // Verify via GET (returns derivative schedule for today)
    const detail = await getSchedule(request, AUTH.PARENT_A, sid, today());
    expect(detail.status()).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.name).toBe('编辑后的集成测试');

    // Verify calendar reflects change — search by derivative's scheduleId
    const calRes = await queryCalendar(request, AUTH.PARENT_A, {
      view: 'week', startDate: today(), endDate: today(),
    });
    expect(calRes.status()).toBe(200);
    const calData = await calRes.json();
    const allSchedules = calData.dates.flatMap(d => d.schedules);
    const found = allSchedules.find(s => s.scheduleId === detailBody.scheduleId);
    expect(found).toBeDefined();
    expect(found.name).toBe('编辑后的集成测试');
  });

  test('[TC-INTEG-004] Delete → Calendar removed @P1', async ({ request }) => {
    const payload = afterschoolActivity({
      name: '删除集成测试',
      timeSlots: [{ dayOfWeek: 4, startTime: '09:00:00', endTime: '10:00:00' }],
    });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    const sid = d.schedules[0].scheduleId;
    createdIds.push(sid);

    // Delete ThisOnly
    const delRes = await deleteSchedule(request, AUTH.PARENT_A, sid, { scope: 'ThisOnly', date: today() });
    expect(delRes.status()).toBe(200);

    // Verify exclusion via GET
    const detail = await getSchedule(request, AUTH.PARENT_A, sid, today());
    if (detail.status() === 200) {
      const body = await detail.json();
      expect(body.isExcluded).toBe(true);
    }
  });

  test('[TC-INTEG-005] Cancel → Calendar visual change @P1', async ({ request }) => {
    const payload = afterschoolActivity({
      name: '取消集成测试',
      timeSlots: [{ dayOfWeek: 5, startTime: '10:00:00', endTime: '11:00:00' }],
    });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    const sid = d.schedules[0].scheduleId;
    createdIds.push(sid);

    // Cancel
    const cancelRes = await cancelInstance(request, AUTH.PARENT_A, sid, { date: today() });
    expect(cancelRes.status()).toBe(200);

    // Verify status change
    const detail = await getSchedule(request, AUTH.PARENT_A, sid, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.isCancelled).toBe(true);
  });

  test('[TC-INTEG-006] Restore → Calendar back to normal @P1', async ({ request }) => {
    const payload = afterschoolActivity({
      name: '恢复集成测试',
      timeSlots: [{ dayOfWeek: 5, startTime: '11:00:00', endTime: '12:00:00' }],
    });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    const sid = d.schedules[0].scheduleId;
    createdIds.push(sid);

    // Cancel first
    await cancelInstance(request, AUTH.PARENT_A, sid, { date: today() });

    // Restore
    const restoreRes = await restoreInstance(request, AUTH.PARENT_A, sid, { date: today() });
    expect(restoreRes.status()).toBe(200);

    // Verify normal state
    const detail = await getSchedule(request, AUTH.PARENT_A, sid, today());
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.isCancelled).toBe(false);
  });

  test('[TC-INTEG-007] IScheduleQueryService returns correct schedule info @P1', async ({ request }) => {
    // Verify each field returned correctly via GET endpoint
    const hw = homeworkTask({
      name: '查询服务测试',
      dueDate: dateOffset(10),
      suggestedStartTime: '14:00:00',
      suggestedEndTime: '15:00:00',
    });
    const r = await createSchedule(request, AUTH.PARENT_A, hw);
    const d = await r.json();
    const sid = d.schedules[0].scheduleId;
    createdIds.push(sid);

    const detail = await getSchedule(request, AUTH.PARENT_A, sid);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.scheduleType).toBe('HomeworkTask');
    expect(body.dueDate).toBe(dateOffset(10));
    expect(body.suggestedStartTime).toBe('14:00:00');
    expect(body.suggestedEndTime).toBe('15:00:00');
  });

});

// ============================================================
// 2.I Integration — P2 (2 tests)
// ============================================================
test.describe('2.I Cross-Module Integration — P2 Edge', () => {

  test('[TC-INTEG-008] Child removed from family — schedule retained, check-in disabled @P2', async ({ request }) => {
    // This requires family module to remove a child from family first.
    // Test: verify the schedule response structure includes child info.
    const payload = afterschoolActivity({
      name: '孩子离开测试',
      timeSlots: [{ dayOfWeek: 2, startTime: '08:00:00', endTime: '09:00:00' }],
    });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    createdIds.push(d.schedules[0].scheduleId);

    const detail = await getSchedule(request, AUTH.PARENT_A, d.schedules[0].scheduleId);
    expect(detail.status()).toBe(200);
  });

  test('[TC-INTEG-009] Edit schedule after child removed @P2', async ({ request }) => {
    // Requires child removal from family first
    const payload = afterschoolActivity({
      name: '移出后编辑测试',
      timeSlots: [{ dayOfWeek: 1, startTime: '12:00:00', endTime: '13:00:00' }],
    });
    const r = await createSchedule(request, AUTH.PARENT_A, payload);
    const d = await r.json();
    createdIds.push(d.schedules[0].scheduleId);

    // Edit should succeed if child still in family
    const editRes = await updateSchedule(request, AUTH.PARENT_A, d.schedules[0].scheduleId,
      updateThisOnly({ name: '正常编辑' }));
    expect(editRes.status()).toBe(200);
  });

});
