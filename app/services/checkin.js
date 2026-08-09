// app/services/checkin.js
// 打卡模块 API 封装 —— 与 checkin-module 联调

const api = require('./api');

/**
 * 查询打卡窗口状态
 * GET /api/v1/checkin/window/{scheduleId}/{date}
 */
function getWindow(scheduleId, date) {
  return api.get(`/api/v1/checkin/window/${scheduleId}/${date}`);
}

/**
 * 打卡
 * POST /api/v1/checkin
 */
function checkin(scheduleId, date) {
  return api.post('/api/v1/checkin', {
    scheduleId: scheduleId,
    date: date
  });
}

/**
 * 撤销打卡
 * DELETE /api/v1/checkin/{checkinId}
 * 或通过 scheduleId + date 撤销
 */
function undo(scheduleId, date) {
  return api.del('/api/v1/checkin', {
    scheduleId: scheduleId,
    date: date
  });
}

/**
 * 获取打卡记录
 * GET /api/v1/checkin/records?scheduleId=...&date=...
 */
function getRecords(scheduleId, date) {
  return api.get('/api/v1/checkin/records', {
    scheduleId: scheduleId,
    date: date
  });
}

module.exports = {
  getWindow,
  checkin,
  undo,
  getRecords
};
