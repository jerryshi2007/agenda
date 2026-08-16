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

// ---- Auth endpoints ----

async function login(request, body) {
  return request.post('/api/v1/auth/login', { data: body });
}

async function refresh(request, body) {
  return request.post('/api/v1/auth/refresh', { data: body });
}

async function getProfile(request, authToken) {
  return request.get('/api/v1/auth/profile', buildOptions(authToken));
}

async function updateProfile(request, authToken, body) {
  const opts = buildOptions(authToken);
  opts.data = body;
  return request.put('/api/v1/auth/profile', opts);
}

async function getDeletionStatus(request, authToken) {
  return request.get('/api/v1/auth/deletion-status', buildOptions(authToken));
}

async function deleteAccount(request, authToken) {
  return request.post('/api/v1/auth/deletion', buildOptions(authToken));
}

async function recoverAccount(request, authToken) {
  return request.post('/api/v1/auth/deletion/recover', buildOptions(authToken));
}

async function getMyFamilies(request, authToken) {
  return request.get('/api/v1/users/me/families', buildOptions(authToken));
}

/**
 * Upload an avatar via multipart/form-data (field name "file").
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} authToken
 * @param {{ fileName: string, mimeType: string, buffer: Buffer }} file
 */
async function uploadAvatar(request, authToken, file) {
  return request.post('/api/v1/upload/avatar', {
    ...buildOptions(authToken),
    multipart: {
      file: {
        name: file.fileName,
        mimeType: file.mimeType,
        buffer: file.buffer,
      },
    },
  });
}

// ---- Checkin endpoints ----

async function getCheckinWindow(request, authToken, scheduleId, date) {
  return request.get(`/api/v1/checkin/window/${scheduleId}/${date}`, buildOptions(authToken));
}

async function checkin(request, authToken, body) {
  const opts = buildOptions(authToken);
  opts.data = body;
  return request.post('/api/v1/checkin', opts);
}

async function undoCheckin(request, authToken, scheduleId, date) {
  return request.delete(`/api/v1/checkin/${scheduleId}/${date}`, buildOptions(authToken));
}

/**
 * 触发每日结算任务（Development-only 测试端点，test-plan.md §3.5 方案 1 / Gate 0-6）。
 * 后端由 dev-dotnet 落地 `POST /api/v1/test/checkin/settle`，直连 SettlementJob.ExecuteAsync
 * 或 RecurringJob.TriggerJob("daily-settlement")。
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} authToken - 传 PARENT_A 即可（若端点 AllowAnonymous 则该头被忽略）
 */
async function triggerSettlement(request, authToken) {
  return request.post('/api/v1/test/checkin/settle', buildOptions(authToken));
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
  getCheckinWindow,
  checkin,
  undoCheckin,
  triggerSettlement,
  login,
  refresh,
  getProfile,
  updateProfile,
  getDeletionStatus,
  deleteAccount,
  recoverAccount,
  getMyFamilies,
  uploadAvatar,
  healthCheck,
};
