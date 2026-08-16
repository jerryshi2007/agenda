// app/__tests__/helpers/auth-mock.js
// 认证服务稳定 mock —— 供页面/组件逻辑测试使用
//
// 原因：loadPage 用 jest.resetModules() 强制重新执行页面模块，若用自动 mock，
// resetModules 后会生成新的 mock 实例，与测试内 `auth` 引用分叉，导致 mockResolvedValue 失效。
// 本文件导出一个稳定对象，jest.mock 工厂返回同一实例，跨 resetModules 保持一致。

const mockAuth = {
  login: jest.fn(),
  refresh: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  getDeletionStatus: jest.fn(),
  deleteAccount: jest.fn(),
  recoverAccount: jest.fn(),
  uploadAvatar: jest.fn(),
  getMyFamilies: jest.fn()
};

module.exports = mockAuth;
