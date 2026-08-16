// app/__tests__/helpers/schedule-mock.js
// 日程服务稳定 mock —— 供页面逻辑测试使用（原因同 helpers/auth-mock.js）

const mockSchedule = {
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  cancel: jest.fn(),
  restore: jest.fn(),
  checkConflict: jest.fn()
};

module.exports = mockSchedule;
