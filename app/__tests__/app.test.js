// app/__tests__/app.test.js
const mockAuth = require('./helpers/auth-mock');
jest.mock('../services/auth', () => mockAuth);
jest.mock('../utils/crypto', () => ({ encrypt: (s) => s, decrypt: (s) => s }));

const auth = require('../services/auth');
const { installWxMock } = require('./helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  // 必须在 resetAllMocks 之后注册，否则实现会被清空（resetAllMocks 移除实现）
  global.getCurrentPages = jest.fn(() => []);
});

function loadApp() {
  let captured = null;
  const prevApp = global.App;
  global.App = (cfg) => { captured = cfg; };
  // Jest 的 require.cache delete 不生效，用 resetModules 强制重新执行
  jest.resetModules();
  require('../app.js');
  global.App = prevApp;
  return captured;
}

function createAppContext(config) {
  const ctx = { globalData: JSON.parse(JSON.stringify(config.globalData || {})) };
  for (const [k, v] of Object.entries(config)) {
    if (k === 'globalData') continue;
    if (typeof v === 'function') ctx[k] = v.bind(ctx);
    else ctx[k] = v;
  }
  return ctx;
}

describe('app.js 隐私检查与静默登录', () => {
  test('未同意隐私时标记 pendingPrivacyConsent 且不登录', () => {
    wx.getStorageSync.mockReturnValue(null);
    const ctx = createAppContext(loadApp());
    ctx._bootstrapLogin();
    expect(ctx.globalData.pendingPrivacyConsent).toBe(true);
    expect(auth.login).not.toHaveBeenCalled();
  });

  test('已同意隐私时直接静默登录', async () => {
    wx.getStorageSync.mockReturnValue({ version: '1.0', time: 1691460000000 });
    wx.login.mockImplementation(({ success }) => success({ code: 'code-1' }));
    auth.login.mockResolvedValue({ jwt: 'j1', userId: 'u1', isNewUser: false, needsProfileCollection: false });
    const ctx = createAppContext(loadApp());
    await ctx._bootstrapLogin();
    expect(ctx.globalData.pendingPrivacyConsent).toBe(false);
    expect(auth.login).toHaveBeenCalledWith('code-1');
  });

  test('onPrivacyAgree 记录同意并登录', () => {
    wx.login.mockImplementation(({ success }) => success({ code: 'code-2' }));
    auth.login.mockResolvedValue({ jwt: 'j2', userId: 'u2', isNewUser: true, needsProfileCollection: true });
    const ctx = createAppContext(loadApp());
    ctx.globalData.pendingPrivacyConsent = true;
    ctx.onPrivacyAgree();
    expect(wx.setStorageSync).toHaveBeenCalledWith('privacy_consent', {
      version: '1.0',
      time: expect.any(Number)
    });
    expect(ctx.globalData.pendingPrivacyConsent).toBe(false);
    expect(auth.login).toHaveBeenCalledWith('code-2');
  });

  test('onPrivacyDecline 跳转静态提示页', () => {
    const ctx = createAppContext(loadApp());
    ctx.onPrivacyDecline();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/privacy-prompt/index' });
  });

  test('doLogin 成功后存 JWT 与 userId', async () => {
    wx.login.mockImplementation(({ success }) => success({ code: 'code-3' }));
    auth.login.mockResolvedValue({ jwt: 'j3', userId: 'u3', isNewUser: false, needsProfileCollection: false });
    const ctx = createAppContext(loadApp());
    await ctx.doLogin();
    expect(wx.setStorageSync).toHaveBeenCalledWith('auth_token', 'j3');
    expect(ctx.globalData.userId).toBe('u3');
  });

  test('doLogin code 已使用时重新 wx.login 一次', async () => {
    wx.login.mockImplementation(({ success }) => success({ code: 'code-4' }));
    auth.login
      .mockRejectedValueOnce({ error: 'CODE_INVALID', message: '微信登录凭证无效' })
      .mockResolvedValue({ jwt: 'j4', userId: 'u4', isNewUser: false, needsProfileCollection: false });
    const ctx = createAppContext(loadApp());
    await ctx.doLogin();
    expect(wx.login).toHaveBeenCalledTimes(2);
    expect(wx.setStorageSync).toHaveBeenCalledWith('auth_token', 'j4');
  });

  test('doLogin 返回已注销时跳转恢复页', async () => {
    wx.login.mockImplementation(({ success }) => success({ code: 'code-5' }));
    auth.login.mockResolvedValue({ jwt: 'j5', userId: 'u5', isDeleted: true, remainingDays: 8 });
    const ctx = createAppContext(loadApp());
    await ctx.doLogin();
    expect(ctx.globalData.pendingDeletedRecovery).toEqual({ remainingDays: 8 });
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/deleted-recovery/index' });
  });

  test('已同意隐私且返回用户昵称仍为默认值时，登录完成后通知当前页刷新认证弹窗', async () => {
    wx.getStorageSync.mockReturnValue({ version: '1.0', time: 1691460000000 });
    wx.login.mockImplementation(({ success }) => success({ code: 'code-6' }));
    auth.login.mockResolvedValue({ jwt: 'j6', userId: 'u6', isNewUser: false, needsProfileCollection: true });
    const page = { _checkAuthOverlays: jest.fn() };
    global.getCurrentPages = jest.fn(() => [page]);
    const ctx = createAppContext(loadApp());
    await ctx._bootstrapLogin();
    expect(ctx.globalData.needsProfileCollection).toBe(true);
    expect(page._checkAuthOverlays).toHaveBeenCalled();
  });

  test('登录完成时当前页未实现 _checkAuthOverlays 则安全跳过', async () => {
    wx.getStorageSync.mockReturnValue({ version: '1.0', time: 1691460000000 });
    wx.login.mockImplementation(({ success }) => success({ code: 'code-7' }));
    auth.login.mockResolvedValue({ jwt: 'j7', userId: 'u7', isNewUser: false, needsProfileCollection: true });
    global.getCurrentPages = jest.fn(() => [{}]);
    const ctx = createAppContext(loadApp());
    await ctx._bootstrapLogin();
    expect(ctx.globalData.needsProfileCollection).toBe(true);
  });
});
