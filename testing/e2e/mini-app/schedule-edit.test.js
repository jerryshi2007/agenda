// testing/e2e/mini-app/schedule-edit.test.js
// Schedule edit page frontend test skeleton (TC-EDIT-xxx frontend portion)
// Prerequisites: WeChat DevTools + miniprogram-automator SDK

const automator = require('miniprogram-automator');

describe('Schedule Edit Page (EVT-ST-03)', () => {
  let miniProgram;
  let page;

  beforeAll(async () => {
    miniProgram = await automator.launch({
      projectPath: 'app/',
    });
    page = await miniProgram.currentPage();
  });

  afterAll(async () => {
    await miniProgram.close();
  });

  // Helper: navigate to edit page
  async function navigateToEdit(scheduleId, date) {
    const params = date ? `scheduleId=${scheduleId}&date=${date}` : `scheduleId=${scheduleId}`;
    await miniProgram.navigateTo(`/pages/schedule-edit/index?${params}`);
    page = await miniProgram.currentPage();
    await page.waitFor(1000);
  }

  // ---- P0 Tests ----

  // [TC-EDIT-001] Edit "ThisOnly" — change name
  it('[TC-EDIT-001] Edit "ThisOnly" — modify name', async () => {
    await navigateToEdit('00000000-0000-0000-0000-000000000001');

    // Default: "仅本次" scope selected
    const thisOnly = await page.$('[data-id="schedule-edit-scope-this-only"]');
    expect(thisOnly).not.toBeNull();

    // Modify name
    const nameInput = await page.$('[data-id="schedule-edit-name-input"]');
    await nameInput.clear();
    await nameInput.input('钢琴课补课');

    // Save
    const saveBtn = await page.$('[data-id="schedule-edit-save-btn"]');
    await saveBtn.tap();

    await page.waitFor(1000);
  });

  // [TC-EDIT-003] Edit "AllFuture" — change time slot
  it('[TC-EDIT-003] Edit "AllFuture" — modify time slot', async () => {
    await navigateToEdit('00000000-0000-0000-0000-000000000001');

    // Switch to "全部日程" scope
    const allFuture = await page.$('[data-id="schedule-edit-scope-all"]');
    await allFuture.tap();

    // Modify time slot via picker
    const timeSlotPicker = await page.$('[data-id="schedule-edit-timeslot"]');
    expect(timeSlotPicker).not.toBeNull();

    const saveBtn = await page.$('[data-id="schedule-edit-save-btn"]');
    await saveBtn.tap();
  });

  // ---- P1 Tests ----

  // [TC-EDIT-002] Edit "ThisOnly" — change time
  it('[TC-EDIT-002] Edit "ThisOnly" — modify time', async () => {
    await navigateToEdit('00000000-0000-0000-0000-000000000001');

    // Modify time via [data-id="schedule-edit-timeslot"]
    const saveBtn = await page.$('[data-id="schedule-edit-save-btn"]');
    await saveBtn.tap();
  });

  // [TC-EDIT-005] Toggle scope — data preserved
  it('[TC-EDIT-005] Toggle edit scope — data retention', async () => {
    await navigateToEdit('00000000-0000-0000-0000-000000000001');

    // Fill name
    const nameInput = await page.$('[data-id="schedule-edit-name-input"]');
    await nameInput.clear();
    await nameInput.input('切换测试');

    // Toggle to "全部日程"
    const allFuture = await page.$('[data-id="schedule-edit-scope-all"]');
    await allFuture.tap();

    // Verify name still there
    const currentValue = await nameInput.value();
    expect(currentValue).toBe('切换测试');

    // Toggle back
    const thisOnly = await page.$('[data-id="schedule-edit-scope-this-only"]');
    await thisOnly.tap();

    const backValue = await nameInput.value();
    expect(backValue).toBe('切换测试');
  });

  // [TC-EDIT-009] HomeworkTask edit — no scope switch
  it('[TC-EDIT-009] HomeworkTask edit — scope switch hidden', async () => {
    await navigateToEdit('00000000-0000-0000-0000-000000000001');

    // Scope container should be hidden for homework
    const scopeContainer = await page.$('[data-id="schedule-edit-scope"]');
    // May be absent or hidden for HomeworkTask
  });

  // [TC-EDIT-011] Concurrent edit conflict
  it('[TC-EDIT-011] Concurrent edit — conflict dialog', async () => {
    await navigateToEdit('00000000-0000-0000-0000-000000000001');

    // Modify and save
    const nameInput = await page.$('[data-id="schedule-edit-name-input"]');
    await nameInput.input('冲突测试');

    const saveBtn = await page.$('[data-id="schedule-edit-save-btn"]');
    await saveBtn.tap();

    // May show conflict dialog — depends on another concurrent edit
  });

  // [TC-EDIT-014] Edit non-existent schedule
  it('[TC-EDIT-014] Non-existent schedule — error handling', async () => {
    await navigateToEdit('00000000-0000-0000-0000-000000000000');

    // Should show error or redirect
    const saveBtn = await page.$('[data-id="schedule-edit-save-btn"]');
    expect(saveBtn).not.toBeNull();
  });

  // ---- P2 Tests ----

  // [TC-EDIT-006] "AllFuture" with no future instances
  it('[TC-EDIT-006] AllFuture edit — expired schedule', async () => {
    await navigateToEdit('00000000-0000-0000-0000-000000000001');

    const allFuture = await page.$('[data-id="schedule-edit-scope-all"]');
    await allFuture.tap();
    // For expired schedule: "no future instances" message
  });
});
