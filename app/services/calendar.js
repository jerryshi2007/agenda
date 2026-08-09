// app/services/calendar.js
// 日历查询 API 封装

const api = require('./api');

/**
 * 日历视图查询（月/周/日）
 * GET /api/v1/calendar
 */
function query(params) {
  return api.get('/api/v1/calendar', params);
}

/**
 * 查询月视图数据
 */
function queryMonth(startDate, endDate, childId, scheduleTypes) {
  return query({
    view: 'month',
    startDate: startDate,
    endDate: endDate,
    childId: childId || undefined,
    eventTypes: scheduleTypes ? scheduleTypes.join(',') : undefined
  });
}

/**
 * 查询周视图数据
 */
function queryWeek(startDate, endDate, childId, scheduleTypes) {
  return query({
    view: 'week',
    startDate: startDate,
    endDate: endDate,
    childId: childId || undefined,
    eventTypes: scheduleTypes ? scheduleTypes.join(',') : undefined
  });
}

/**
 * 查询日视图数据
 */
function queryDay(startDate, endDate, childId, scheduleTypes) {
  return query({
    view: 'day',
    startDate: startDate,
    endDate: endDate,
    childId: childId || undefined,
    eventTypes: scheduleTypes ? scheduleTypes.join(',') : undefined
  });
}

module.exports = {
  query,
  queryMonth,
  queryWeek,
  queryDay
};
