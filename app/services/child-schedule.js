// app/services/child-schedule.js
// 孩子端日程查询 API 封装 —— 5 个只读端点（小学模式基准视图）
// 走统一 services/api.js，自动注入 X-Family-Id（从 CURRENT_FAMILY_ID 读取）
// 错误码透传 api.js 错误信封（CHILD_ACCESS_DENIED 等）
// 枚举值不手写字符串字面量（本服务无需枚举参数，但下游页面会引用 app/contracts/family.js）

const api = require('./api');

/**
 * 获取孩子今日日程列表（含完成统计）
 * GET /api/v1/child/schedule/today?date=YYYY-MM-DD（date 可选，默认今天）
 * @param {string} [date] 目标日期 yyyy-MM-dd（缺省由后端按今天处理）
 * @returns {Promise<{items:Array, completedCount:number, totalCount:number, completionPercentage:number}>}
 */
function getTodayList(date) {
  return api.get('/api/v1/child/schedule/today', date ? { date } : undefined).then(res => res.data);
}

/**
 * 获取孩子本周日程概览
 * GET /api/v1/child/schedule/week?date=YYYY-MM-DD
 * @param {string} [date] 周内任意一天，缺省由后端按本周处理
 */
function getWeekList(date) {
  return api.get('/api/v1/child/schedule/week', date ? { date } : undefined).then(res => res.data);
}

/**
 * 获取孩子本月日程概览
 * GET /api/v1/child/schedule/month?date=YYYY-MM-DD
 * @param {string} [date] 月内任意一天，缺省由后端按本月处理
 */
function getMonthList(date) {
  return api.get('/api/v1/child/schedule/month', date ? { date } : undefined).then(res => res.data);
}

/**
 * 获取单个日程详情（只读）
 * GET /api/v1/child/schedule/{scheduleId}
 * 越权访问他人日程返回 403 CHILD_ACCESS_DENIED
 * @param {string} scheduleId
 */
function getById(scheduleId) {
  return api.get(`/api/v1/child/schedule/${scheduleId}`).then(res => res.data);
}

/**
 * 获取孩子本周完成率统计
 * GET /api/v1/child/stats/weekly-completion
 * @returns {Promise<{percentage:number, completed:number, total:number}>}
 */
function getWeeklyCompletion() {
  return api.get('/api/v1/child/stats/weekly-completion').then(res => res.data);
}

module.exports = {
  getTodayList,
  getWeekList,
  getMonthList,
  getById,
  getWeeklyCompletion
};
