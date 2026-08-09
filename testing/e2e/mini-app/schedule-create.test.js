// testing/e2e/mini-app/schedule-create.test.js
// Schedule creation wizard frontend test skeleton (TC-CREATE-xxx frontend portion)
// Prerequisites: WeChat DevTools + miniprogram-automator SDK

const automator = require('miniprogram-automator');

describe('Schedule Create Wizard (EVT-ST-01)', () => {
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

  // Helper: navigate to create page
  async function navigateToCreate() {
    await miniProgram.navigateTo('/pages/schedule-create/index');
    page = await miniProgram.currentPage();
    await page.waitFor(500);
  }

  // ---- P0 Tests ----

  // [TC-CREATE-001] Create AfterSchoolActivity (single child) — full wizard flow
  it('[TC-CREATE-001] Create AfterSchoolActivity wizard flow', async () => {
    await navigateToCreate();

    // Step 1: Select child
    const childCheckbox = await page.$('[data-id="schedule-create-child-00000000-0000-0000-0000-000000000010"]');
    await childCheckbox.tap();

    // Step 2: Select type
    const nextBtn1 = await page.$('[data-id="schedule-create-next-btn"]');
    await nextBtn1.tap();
    await page.waitFor(300);

    const typeCard = await page.$('[data-id="schedule-create-type-afterschool"]');
    await typeCard.tap();

    // Step 3: Fill form
    await nextBtn1.tap();
    await page.waitFor(300);

    const nameInput = await page.$('[data-id="schedule-create-name-input"]');
    await nameInput.input('钢琴课');

    // Configure time slot
    const timeSlotPicker = await page.$('[data-id="schedule-create-timeslot"]');
    expect(timeSlotPicker).not.toBeNull();

    const locationInput = await page.$('[data-id="schedule-create-location-input"]');
    await locationInput.input('琴行教室A');

    const notesInput = await page.$('[data-id="schedule-create-notes-input"]');
    await notesInput.input('带琴谱');

    // Step 4: Confirm
    const submitBtn = await page.$('[data-id="schedule-create-submit-btn"]');
    await submitBtn.tap();

    // Wait for creation and navigation back
    await page.waitFor(1000);
  });

  // [TC-CREATE-010] No child selected — blocked
  it('[TC-CREATE-010] Block next step when no child selected', async () => {
    await navigateToCreate();

    // Don't select any child, try to go next
    const nextBtn = await page.$('[data-id="schedule-create-next-btn"]');
    await nextBtn.tap();

    // Verify: stayed on step 1 (toast or indicator shows error)
    // Check step indicator if present
    const stepIndicator = await page.$('[data-id="schedule-create-step-indicator"]');
    if (stepIndicator) {
      const text = await stepIndicator.text();
      expect(text).toContain('1');
    }
  });

  // [TC-CREATE-011] Empty name — blocked
  it('[TC-CREATE-011] Block submission with empty name', async () => {
    await navigateToCreate();

    // Navigate to step 3 quickly
    // ... (wizard navigation steps)
    // Then try to submit with empty name

    const submitBtn = await page.$('[data-id="schedule-create-submit-btn"]');
    // Should be disabled or trigger validation error
  });

  // ---- P1 Tests ----

  // [TC-CREATE-006] Conflict detection popup
  it('[TC-CREATE-006] Show conflict dialog when time overlaps', async () => {
    // Requires seed data with existing schedule
    await navigateToCreate();
    // ... navigate to step 3 with conflicting time

    // Submit — expect conflict dialog
    const conflictDialog = await page.$('[data-id="schedule-create-conflict-dialog"]');
    // Assert dialog is visible when conflict occurs
  });

  // [TC-CREATE-007] Conflict — continue create
  it('[TC-CREATE-007] Conflict — choose "Continue Create"', async () => {
    // After triggering conflict
    const continueBtn = await page.$('[data-id="schedule-create-conflict-continue"]');
    await continueBtn.tap();
    // Verify schedule created despite conflict
  });

  // [TC-CREATE-008] Conflict — back to edit
  it('[TC-CREATE-008] Conflict — choose "Back to Edit"', async () => {
    const backBtn = await page.$('[data-id="schedule-create-conflict-back"]');
    await backBtn.tap();
    // Verify: back to form, data preserved
  });

  // [TC-CREATE-003] DailyRoutine — per-day tuning
  it('[TC-CREATE-003] Create DailyRoutine with per-day tuning', async () => {
    await navigateToCreate();
    // Step 1: select child
    // Step 2: select DailyRoutine type at [data-id="schedule-create-type-daily"]
    // Step 3: fill name, use time slot picker

    // Open per-day tuning
    const tuneToggle = await page.$('[data-id="schedule-create-timeslot-tune-toggle"]');
    if (tuneToggle) {
      await tuneToggle.tap();
    }

    // Adjust individual days
    const wedTune = await page.$('[data-id="schedule-create-timeslot-tune-周三"]');
    if (wedTune) {
      await wedTune.tap();
    }
  });

  // [TC-CREATE-033] Step 4 preview confirmation
  it('[TC-CREATE-033] Step 4 preview shows correct summary', async () => {
    await navigateToCreate();
    // Navigate through steps 1-3

    // At step 4, check preview summary
    const preview = await page.$('[data-id="schedule-create-preview-summary"]');
    expect(preview).not.toBeNull();
    // Check it lists: children, type, name, time slots, location, notes
  });

  // [TC-CREATE-032] Wizard navigation — data retention
  it('[TC-CREATE-032] Go back then forward — data retained', async () => {
    await navigateToCreate();
    // Fill step 3 data
    const nameInput = await page.$('[data-id="schedule-create-name-input"]');
    await nameInput.input('数据保留测试');

    // Go back to step 2
    const prevBtn = await page.$('[data-id="schedule-create-prev-btn"]');
    await prevBtn.tap();
    await page.waitFor(300);

    // Go forward to step 3 again
    const nextBtn = await page.$('[data-id="schedule-create-next-btn"]');
    await nextBtn.tap();
    await page.waitFor(300);

    // Verify name still present
    const currentValue = await nameInput.value();
    expect(currentValue).toBe('数据保留测试');
  });
});
