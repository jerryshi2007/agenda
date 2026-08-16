// app/__tests__/helpers/checkin-mock.js
// 打卡服务稳定 mock —— 供页面逻辑测试使用（原因同 helpers/auth-mock.js）

const mockCheckin = {
  getWindow: jest.fn(),
  checkin: jest.fn(),
  undo: jest.fn(),
  getRecords: jest.fn()
};

module.exports = mockCheckin;
