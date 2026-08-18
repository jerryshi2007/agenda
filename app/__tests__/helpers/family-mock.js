// app/__tests__/helpers/family-mock.js
// 家庭服务稳定 mock —— 供页面/组件逻辑测试使用
//
// 原因：loadPage 用 jest.resetModules() 强制重新执行页面模块，需稳定工厂
// 保持跨 resetModules 的 mock 实例一致。

const mockFamily = {
  getMyFamilies: jest.fn(),
  createFamily: jest.fn(),
  updateFamilyName: jest.fn(),
  getMembers: jest.fn(),
  generateInviteCode: jest.fn(),
  getInvites: jest.fn(),
  revokeInvite: jest.fn(),
  joinByCode: jest.fn(),
  removeMember: jest.fn(),
  transferCreator: jest.fn(),
  setDisplayMode: jest.fn(),
  exitFamily: jest.fn(),
  dissolveFamily: jest.fn(),
  restoreFamily: jest.fn(),
  getShareInfo: jest.fn()
};

module.exports = mockFamily;
