// testing/e2e/helpers/data-factory.js
// Test data generation helpers for Agenda E2E tests

const { TEST_USERS, authHeader } = require('./jwt-helper');

/**
 * Get today's date as YYYY-MM-DD string.
 */
function today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get date offset by N days from today.
 * @param {number} offsetDays - positive for future, negative for past
 * @returns {string} YYYY-MM-DD
 */
function dateOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/**
 * Get the next occurrence of a specific day of week.
 * @param {number} dayOfWeek - 0=Sunday, 1=Monday, ..., 6=Saturday
 * @param {string} [fromDate] - Starting date (YYYY-MM-DD), defaults to today
 * @returns {string} YYYY-MM-DD
 */
function nextDayOfWeek(dayOfWeek, fromDate) {
  const d = fromDate ? new Date(fromDate) : new Date();
  const currentDay = d.getDay();
  const daysUntil = (dayOfWeek + 7 - currentDay) % 7;
  d.setDate(d.getDate() + (daysUntil === 0 ? 7 : daysUntil));
  return d.toISOString().split('T')[0];
}

/**
 * Get date as DateOnly string with year range.
 * @param {number} monthsFromNow - 0 = this month, +1 = next month, -1 = last month
 * @returns {object} { startDate, endDate } as YYYY-MM-DD
 */
function monthRange(monthsFromNow) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthsFromNow, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthsFromNow + 1, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

// ---- Create schedule request bodies ----

/**
 * Create a minimal AfterSchoolActivity schedule request.
 */
function afterschoolActivity(opts = {}) {
  return {
    name: opts.name !== undefined ? opts.name : '钢琴课',
    scheduleType: 'AfterSchoolActivity',
    childIds: opts.childIds || [TEST_USERS.CHILD_1],
    timeSlots: opts.timeSlots || [
      { dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }, // Tuesday
    ],
    repeatEndDate: opts.repeatEndDate !== undefined ? opts.repeatEndDate : dateOffset(365),
    location: opts.location !== undefined ? opts.location : '琴行教室A',
    notes: opts.notes !== undefined ? opts.notes : '带琴谱',
    dueDate: opts.dueDate !== undefined ? opts.dueDate : null,
    suggestedStartTime: opts.suggestedStartTime !== undefined ? opts.suggestedStartTime : null,
    suggestedEndTime: opts.suggestedEndTime !== undefined ? opts.suggestedEndTime : null,
    ignoreConflict: opts.ignoreConflict || false,
  };
}

/**
 * Create a minimal DailyRoutine schedule request.
 */
function dailyRoutine(opts = {}) {
  return {
    name: opts.name !== undefined ? opts.name : '练琴',
    scheduleType: 'DailyRoutine',
    childIds: opts.childIds || [TEST_USERS.CHILD_1],
    timeSlots: opts.timeSlots || [
      { dayOfWeek: 1, startTime: '16:00:00', endTime: '16:30:00' }, // Monday
      { dayOfWeek: 2, startTime: '16:00:00', endTime: '16:30:00' }, // Tuesday
      { dayOfWeek: 3, startTime: '17:00:00', endTime: '17:30:00' }, // Wednesday (tuned)
      { dayOfWeek: 4, startTime: '16:00:00', endTime: '16:30:00' }, // Thursday
      { dayOfWeek: 5, startTime: '16:00:00', endTime: '16:30:00' }, // Friday
    ],
    repeatEndDate: opts.repeatEndDate !== undefined ? opts.repeatEndDate : null,
    location: opts.location !== undefined ? opts.location : null,
    notes: opts.notes !== undefined ? opts.notes : null,
    dueDate: null,
    suggestedStartTime: null,
    suggestedEndTime: null,
    ignoreConflict: opts.ignoreConflict || false,
  };
}

/**
 * Create a minimal HomeworkTask schedule request.
 */
function homeworkTask(opts = {}) {
  return {
    name: opts.name !== undefined ? opts.name : '数学练习册 P32-35',
    scheduleType: 'HomeworkTask',
    childIds: opts.childIds || [TEST_USERS.CHILD_1],
    timeSlots: [], // HomeWorkTask has no time slots
    repeatEndDate: null,
    location: null,
    notes: opts.notes !== undefined ? opts.notes : null,
    dueDate: opts.dueDate !== undefined ? opts.dueDate : dateOffset(7), // due next week
    suggestedStartTime: opts.suggestedStartTime !== undefined ? opts.suggestedStartTime : '15:00:00',
    suggestedEndTime: opts.suggestedEndTime !== undefined ? opts.suggestedEndTime : '16:00:00',
    ignoreConflict: opts.ignoreConflict || false,
  };
}

// ---- Update schedule request bodies ----

function updateThisOnly(opts = {}) {
  return {
    scope: 'ThisOnly',
    date: opts.date || today(),
    name: opts.name,
    timeSlots: opts.timeSlots,
    repeatEndDate: opts.repeatEndDate,
    location: opts.location,
    notes: opts.notes,
    dueDate: opts.dueDate,
    suggestedStartTime: opts.suggestedStartTime,
    suggestedEndTime: opts.suggestedEndTime,
    rowVersion: opts.rowVersion,
  };
}

function updateAllFuture(opts = {}) {
  return {
    scope: 'ThisAndFuture',
    date: opts.date || today(),
    name: opts.name,
    timeSlots: opts.timeSlots,
    repeatEndDate: opts.repeatEndDate,
    location: opts.location,
    notes: opts.notes,
    dueDate: opts.dueDate,
    suggestedStartTime: opts.suggestedStartTime,
    suggestedEndTime: opts.suggestedEndTime,
    rowVersion: opts.rowVersion,
  };
}

// ---- Auth headers for convenience ----

const AUTH = {
  PARENT_A: authHeader(TEST_USERS.PARENT_A, 'Parent'),
  PARENT_B: authHeader(TEST_USERS.PARENT_B, 'Parent'),
  CHILD_1: authHeader(TEST_USERS.CHILD_1, 'Child'),
  CHILD_2: authHeader(TEST_USERS.CHILD_2, 'Child'),
  OUTSIDER: authHeader(TEST_USERS.OUTSIDER, 'Parent'),
};

module.exports = {
  today,
  dateOffset,
  nextDayOfWeek,
  monthRange,
  afterschoolActivity,
  dailyRoutine,
  homeworkTask,
  updateThisOnly,
  updateAllFuture,
  AUTH,
  TEST_USERS,
};
