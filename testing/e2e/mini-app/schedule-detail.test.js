// testing/e2e/mini-app/schedule-detail.test.js
// Schedule detail page frontend test skeleton (TC-DETAIL-xxx frontend portion)
// Prerequisites: WeChat DevTools + miniprogram-automator SDK

const automator = require('miniprogram-automator');

describe('Schedule Detail Page (EVT-ST-03)', () => {
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

  // Helper: navigate to detail page
  async function navigateToDetail(scheduleId, date) {
    const params = date ? `scheduleId=${scheduleId}&date=${date}` : `scheduleId=${scheduleId}`;
    await miniProgram.navigateTo(`/pages/schedule-detail/index?${params}`);
    page = await miniProgram.currentPage();
    await page.waitFor(1000);
  }

  // ---- P0 Tests ----

  // [TC-DETAIL-001] After-school activity detail — normal state
  it('[TC-DETAIL-001] Detail page shows all info for normal activity', async () => {
    // Navigate to a known schedule
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    // Check action buttons
    const checkinBtn = await page.$('[data-id="schedule-detail-checkin-btn"]');
    const editBtn = await page.$('[data-id="schedule-detail-edit-btn"]');
    const cancelBtn = await page.$('[data-id="schedule-detail-cancel-btn"]');
    const deleteBtn = await page.$('[data-id="schedule-detail-delete-btn"]');

    expect(checkinBtn).not.toBeNull();
    expect(editBtn).not.toBeNull();
    expect(cancelBtn).not.toBeNull();
    expect(deleteBtn).not.toBeNull();
  });

  // ---- P1 Tests ----

  // [TC-DETAIL-002] Checked-in state — show undo button
  it('[TC-DETAIL-002] Completed instance — shows undo button', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    const undoBtn = await page.$('[data-id="schedule-detail-undo-btn"]');
    // Visible when instance is checked in
  });

  // [TC-DETAIL-003] Cancelled state — show restore button
  it('[TC-DETAIL-003] Cancelled instance — shows restore button', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    const restoreBtn = await page.$('[data-id="schedule-detail-restore-btn"]');
    // Visible when instance is cancelled
    const checkinBtn = await page.$('[data-id="schedule-detail-checkin-btn"]');
    // Should NOT be visible when cancelled
  });

  // [TC-DETAIL-004] HomeworkTask detail — no cancel button
  it('[TC-DETAIL-004] HomeworkTask detail — no cancel button', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    const cancelBtn = await page.$('[data-id="schedule-detail-cancel-btn"]');
    // Should not exist or be hidden for HomeworkTask
  });

  // ---- P2 Tests ----

  // [TC-DETAIL-006] Schedule not found
  it('[TC-DETAIL-006] Deleted schedule — shows "deleted" message', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000000');

    // Error/empty state
    const retryBtn = await page.$('[data-id="schedule-detail-retry-btn"]');
    expect(retryBtn).not.toBeNull();
  });

  // ---- Delete flow tests ----

  // [TC-DEL-001] Delete "ThisOnly" via detail page
  it('[TC-DEL-001] Delete "ThisOnly" — Exclusion flow', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    // Tap delete button
    const deleteBtn = await page.$('[data-id="schedule-detail-delete-btn"]');
    await deleteBtn.tap();

    // Delete dialog appears
    await page.waitFor(300);
    const dialog = await page.$('[data-id="schedule-detail-delete-dialog"]');
    expect(dialog).not.toBeNull();

    // Default selected: "仅本次"
    const thisOnlyOption = await page.$('[data-id="schedule-detail-delete-this-only"]');
    // Select and confirm
    const confirmBtn = await page.$('[data-id="schedule-detail-delete-confirm"]');
    await confirmBtn.tap();

    await page.waitFor(1000);
  });

  // ---- Cancel/Restore flow tests ----

  // [TC-CANCEL-001] Cancel this instance
  it('[TC-CANCEL-001] Cancel instance via detail page', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    const cancelBtn = await page.$('[data-id="schedule-detail-cancel-btn"]');
    await cancelBtn.tap();

    // Cancel dialog
    await page.waitFor(300);
    const dialog = await page.$('[data-id="schedule-detail-cancel-dialog"]');
    expect(dialog).not.toBeNull();

    const confirmCancel = await page.$('[data-id="schedule-detail-cancel-confirm"]');
    await confirmCancel.tap();
  });

  // [TC-CANCEL-003] Restore cancelled instance
  it('[TC-CANCEL-003] Restore instance via detail page', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    const restoreBtn = await page.$('[data-id="schedule-detail-restore-btn"]');
    await restoreBtn.tap();

    // Instance restored, button should switch back to "取消本次"
    await page.waitFor(500);
    const cancelBtn = await page.$('[data-id="schedule-detail-cancel-btn"]');
    expect(cancelBtn).not.toBeNull();
  });

  // ---- Check-in flow tests ----

  // [TC-CHECKIN-001] Check-in from detail page
  it('[TC-CHECKIN-001] Check-in button tap on detail page', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    const checkinBtn = await page.$('[data-id="schedule-detail-checkin-btn"]');
    await checkinBtn.tap();

    // After check-in: button changes to undo
    await page.waitFor(500);
    const undoBtn = await page.$('[data-id="schedule-detail-undo-btn"]');
    expect(undoBtn).not.toBeNull();
  });

  // [TC-CHECKIN-004] Undo check-in
  it('[TC-CHECKIN-004] Undo check-in from detail page', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    const undoBtn = await page.$('[data-id="schedule-detail-undo-btn"]');
    await undoBtn.tap();

    await page.waitFor(500);
    // Check-in button should reappear
    const checkinBtn = await page.$('[data-id="schedule-detail-checkin-btn"]');
    expect(checkinBtn).not.toBeNull();
  });

  // [TC-CHECKIN-006] Cancelled instance — no check-in button
  it('[TC-CHECKIN-006] Cancelled — check-in button disabled/hidden', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    const disabledBtn = await page.$('[data-id="schedule-detail-checkin-btn-disabled"]');
    // Check-in button should be disabled or the enabled one should be hidden
  });

  // [TC-CHECKIN-014] Child view — limited buttons
  it('[TC-CHECKIN-014] Child role — no edit/delete/cancel, has check-in', async () => {
    await navigateToDetail('00000000-0000-0000-0000-000000000001');

    const editBtn = await page.$('[data-id="schedule-detail-edit-btn"]');
    const cancelBtn = await page.$('[data-id="schedule-detail-cancel-btn"]');
    const deleteBtn = await page.$('[data-id="schedule-detail-delete-btn"]');

    // As child, these should be hidden
    // Depends on current login role
  });
});
