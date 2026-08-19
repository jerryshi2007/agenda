// app/__tests__/helpers/child-schedule-mock.js
// 孩子端日程服务稳定 mock —— 供页面逻辑测试使用（原因同 helpers/auth-mock.js）

const mockChildSchedule = {
  getTodayList: jest.fn(),
  getWeekList: jest.fn(),
  getMonthList: jest.fn(),
  getById: jest.fn(),
  getWeeklyCompletion: jest.fn()
};

module.exports = mockChildSchedule;
