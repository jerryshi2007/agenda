// app/services/checkin.js
// 打卡模块 API 封装 —— 与 checkin-module 联调
// 错误码与枚举值一律引用 app/contracts/checkin.js，禁止手写字符串字面量

const api = require('./api');
const { ErrorCodes } = require('../contracts/checkin');

// 撤销打卡错误码 → 前端精简中文提示（区别于 errors.json 的完整文案）
const UNDO_ERROR_MESSAGES = {
  [ErrorCodes.TERMINAL_STATE]: '已结算，不可撤销',
  [ErrorCodes.NOT_CHECKED_IN]: '无打卡记录'
};

/**
 * 查询打卡窗口状态
 * GET /api/v1/checkin/window/{scheduleId}/{date}
 */
function getWindow(scheduleId, date) {
  return api.get(`/api/v1/checkin/window/${scheduleId}/${date}`);
}

/**
 * 打卡（幂等：alreadyCheckedIn=true 时同样视为成功）
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
 * DELETE /api/v1/checkin/{scheduleId}/{date}（路径参数形式，非 body）
 */
function undo(scheduleId, date) {
  return api.del(`/api/v1/checkin/${scheduleId}/${date}`)
    .catch(err => {
      const mapped = UNDO_ERROR_MESSAGES[err && err.error];
      if (mapped) {
        throw Object.assign({}, err, { message: mapped });
      }
      throw err;
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
