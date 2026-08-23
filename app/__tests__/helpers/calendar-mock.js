// app/__tests__/helpers/calendar-mock.js
// 日历服务稳定 mock —— 供页面逻辑测试使用（跨 loadPage 的 jest.resetModules 保持同一实例）

const mockCalendar = {
  query: jest.fn(),
  queryMonth: jest.fn(),
  queryWeek: jest.fn(),
  queryDay: jest.fn()
};

module.exports = mockCalendar;
