// app/__tests__/helpers/template-mock.js
// 模板服务稳定 mock —— 供页面逻辑测试使用

const mockTemplate = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  apply: jest.fn()
};

module.exports = mockTemplate;
