// app/services/schedule.js
// 日程 CRUD API 封装

const api = require('./api');

/**
 * 创建日程（含多孩子展开）
 * POST /api/v1/schedules
 */
function create(data) {
  return api.post('/api/v1/schedules', data);
}

/**
 * 获取日程详情
 * GET /api/v1/schedules/{scheduleId}?date=...
 */
function getById(scheduleId, date) {
  return api.get(`/api/v1/schedules/${scheduleId}`, { date: date });
}

/**
 * 编辑日程（含 EditScope 逻辑）
 * PUT /api/v1/schedules/{scheduleId}
 */
function update(scheduleId, data) {
  return api.put(`/api/v1/schedules/${scheduleId}`, data);
}

/**
 * 删除日程
 * DELETE /api/v1/schedules/{scheduleId}?scope=...&date=...
 */
function remove(scheduleId, scope, date) {
  return api.del(`/api/v1/schedules/${scheduleId}`, { scope: scope, date: date });
}

/**
 * 临时取消本次实例
 * POST /api/v1/schedules/{scheduleId}/cancel
 */
function cancel(scheduleId, date) {
  return api.post(`/api/v1/schedules/${scheduleId}/cancel`, { date: date });
}

/**
 * 恢复已取消/已删除实例
 * POST /api/v1/schedules/{scheduleId}/restore
 */
function restore(scheduleId, date) {
  return api.post(`/api/v1/schedules/${scheduleId}/restore`, { date: date });
}

/**
 * 冲突检测（可选调用）
 * POST /api/v1/schedules/check-conflict
 */
function checkConflict(childId, date, startTime, endTime) {
  return api.post('/api/v1/schedules/check-conflict', {
    childId: childId,
    date: date,
    startTime: startTime,
    endTime: endTime
  });
}

module.exports = {
  create,
  getById,
  update,
  remove,
  cancel,
  restore,
  checkConflict
};
