// testing/e2e/helpers/api-client.js
// Unified HTTP client for Agenda API testing
// Uses Playwright request fixture (APIRequestContext)

/**
 * Build request options with auth header.
 * @param {import('@playwright/test').APIRequestContext} request - Playwright request fixture
 * @param {string} authToken - Bearer token (or null for unauthenticated)
 * @param {object} [extraHeaders={}] - Additional headers
 * @returns {object} Options for request methods
 */
function buildOptions(authToken, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (authToken) {
    headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
  }
  return { headers };
}

// ---- Schedule CRUD endpoints ----

async function createSchedule(request, authToken, body) {
  const opts = buildOptions(authToken);
  opts.data = body;
  return request.post('/api/v1/schedules', opts);
}

async function getSchedule(request, authToken, scheduleId, date) {
  const opts = buildOptions(authToken);
  const queryParams = date ? `?date=${date}` : '';
  return request.get(`/api/v1/schedules/${scheduleId}${queryParams}`, opts);
}

async function updateSchedule(request, authToken, scheduleId, body) {
  const opts = buildOptions(authToken);
  opts.data = body;
  return request.put(`/api/v1/schedules/${scheduleId}`, opts);
}

async function deleteSchedule(request, authToken, scheduleId, params = {}) {
  const opts = buildOptions(authToken);
  const queryString = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return request.delete(`/api/v1/schedules/${scheduleId}${queryString ? '?' + queryString : ''}`, opts);
}

// ---- Cancel / Restore endpoints ----

async function cancelInstance(request, authToken, scheduleId, body) {
  const opts = buildOptions(authToken);
  opts.data = body;
  return request.post(`/api/v1/schedules/${scheduleId}/cancel`, opts);
}

async function restoreInstance(request, authToken, scheduleId, body) {
  const opts = buildOptions(authToken);
  opts.data = body;
  return request.post(`/api/v1/schedules/${scheduleId}/restore`, opts);
}

// ---- Conflict detection endpoint ----

async function checkConflict(request, authToken, body) {
  const opts = buildOptions(authToken);
  opts.data = body;
  return request.post('/api/v1/schedules/check-conflict', opts);
}

// ---- Calendar query endpoint ----

async function queryCalendar(request, authToken, params = {}) {
  const opts = buildOptions(authToken);
  const queryString = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return request.get(`/api/v1/calendar${queryString ? '?' + queryString : ''}`, opts);
}

// ---- Health check ----

async function healthCheck(request) {
  return request.get('/health');
}

module.exports = {
  buildOptions,
  createSchedule,
  getSchedule,
  updateSchedule,
  deleteSchedule,
  cancelInstance,
  restoreInstance,
  checkConflict,
  queryCalendar,
  healthCheck,
};
