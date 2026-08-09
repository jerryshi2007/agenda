// testing/e2e/fixtures/seed-data.js
// Seed data definitions for Agenda E2E tests
// These define the expected test data state before each test suite.
//
// Data seeding is done per-test via API calls (create what's needed, clean up after),
// NOT via SQL scripts — this ensures independence between test runs.
//
// See test-plan.md Section 3 for the complete seed data specification.

const { TEST_USERS } = require('../helpers/jwt-helper');

/**
 * Pre-defined schedule creation payloads for common seed scenarios.
 * Each provides a unique name to avoid collisions.
 */

const SEED = {
  // 3.2 日程种子数据
  SCHEDULE_PIANO: {
    name: '钢琴课',
    scheduleType: 'AfterSchoolActivity',
    childIds: [TEST_USERS.CHILD_1],
    timeSlots: [
      { dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }, // 周二
      { dayOfWeek: 4, startTime: '16:00:00', endTime: '17:00:00' }, // 周四
    ],
    repeatEndDate: '2026-12-31',
    location: '琴行教室A',
    notes: '带琴谱',
  },

  SCHEDULE_ENGLISH_CONFLICT: {
    name: '英语课',
    scheduleType: 'AfterSchoolActivity',
    childIds: [TEST_USERS.CHILD_1],
    timeSlots: [
      { dayOfWeek: 2, startTime: '16:30:00', endTime: '17:30:00' }, // 周二，与钢琴课冲突
    ],
    repeatEndDate: '2026-12-31',
    location: '英语教室B',
  },

  SCHEDULE_SWIMMING: {
    name: '游泳课',
    scheduleType: 'AfterSchoolActivity',
    childIds: [TEST_USERS.CHILD_2],
    timeSlots: [
      { dayOfWeek: 3, startTime: '15:00:00', endTime: '16:00:00' }, // 周三
    ],
    repeatEndDate: '2026-12-31',
    location: '游泳馆',
  },

  SCHEDULE_PRACTICE: {
    name: '练琴',
    scheduleType: 'DailyRoutine',
    childIds: [TEST_USERS.CHILD_1],
    timeSlots: [
      { dayOfWeek: 1, startTime: '16:00:00', endTime: '16:30:00' },
      { dayOfWeek: 2, startTime: '16:00:00', endTime: '16:30:00' },
      { dayOfWeek: 3, startTime: '17:00:00', endTime: '17:30:00' },
      { dayOfWeek: 4, startTime: '16:00:00', endTime: '16:30:00' },
      { dayOfWeek: 5, startTime: '16:00:00', endTime: '16:30:00' },
    ],
    repeatEndDate: null,
  },

  SCHEDULE_HOMEWORK: {
    name: '数学练习册 P32-35',
    scheduleType: 'HomeworkTask',
    childIds: [TEST_USERS.CHILD_1],
    timeSlots: [],
    repeatEndDate: null,
    dueDate: null, // will be set dynamically to next week
    suggestedStartTime: '15:00:00',
    suggestedEndTime: '16:00:00',
  },
};

/**
 * Create a seed schedule by calling the API.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} authToken
 * @param {object} payload - Schedule creation body
 * @returns {Promise<object>} Created schedule response data
 */
async function seedSchedule(request, authToken, payload) {
  const res = await request.post('/api/v1/schedules', {
    headers: { Authorization: authToken },
    data: payload,
  });
  if (res.status() !== 201) {
    const body = await res.json().catch(() => null);
    throw new Error(`Failed to seed schedule "${payload.name}": ${res.status()} ${JSON.stringify(body)}`);
  }
  return res.json();
}

/**
 * Clean up a schedule at the end of a test.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} authToken
 * @param {string} scheduleId
 */
async function cleanupSchedule(request, authToken, scheduleId) {
  try {
    await request.delete(`/api/v1/schedules/${scheduleId}?force=true`, {
      headers: { Authorization: authToken },
    });
  } catch (err) {
    // Resource may have already been deleted by the test or a prior cleanup step
    console.warn(`[cleanup] Failed to clean up schedule ${scheduleId}: ${err.message}`);
  }
}

module.exports = {
  SEED,
  seedSchedule,
  cleanupSchedule,
};
