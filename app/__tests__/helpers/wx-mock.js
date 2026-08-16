// app/__tests__/helpers/wx-mock.js
// 统一的 wx.* mock 工厂 —— 每个测试文件独立安装，禁止跨测试共享 mock 状态

/**
 * 创建 wx mock 对象，所有方法默认为 jest.fn()
 * @param {Object} overrides 覆盖特定方法的返回值/实现
 */
function createWxMock(overrides = {}) {
  return {
    getStorageSync: jest.fn(),
    setStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
    clearStorageSync: jest.fn(),
    getStorageInfoSync: jest.fn(() => ({ keys: [] })),
    request: jest.fn(),
    uploadFile: jest.fn(),
    login: jest.fn(),
    navigateTo: jest.fn(),
    redirectTo: jest.fn(),
    reLaunch: jest.fn(),
    switchTab: jest.fn(),
    navigateBack: jest.fn(),
    showToast: jest.fn(),
    showModal: jest.fn(),
    showActionSheet: jest.fn(),
    showLoading: jest.fn(),
    hideLoading: jest.fn(),
    exitMiniProgram: jest.fn(),
    getSystemInfoSync: jest.fn(() => ({ statusBarHeight: 20, theme: 'light' })),
    getSetting: jest.fn(),
    openSetting: jest.fn(),
    getNetworkType: jest.fn(),
    ...overrides
  };
}

/**
 * 安装 wx mock 到 global.wx 并返回
 * 用法：beforeEach(() => { wx = installWxMock(); })
 */
function installWxMock(overrides) {
  const wx = createWxMock(overrides);
  global.wx = wx;
  return wx;
}

module.exports = { createWxMock, installWxMock };
