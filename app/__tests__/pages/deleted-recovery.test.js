// app/__tests__/pages/deleted-recovery.test.js
const mockAuth = require('../helpers/auth-mock');
jest.mock('../../services/auth', () => mockAuth);

const auth = require('../../services/auth');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
let app;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  app = {
    globalData: { pendingDeletedRecovery: { remainingDays: 5 } },
    setLoginData: jest.fn()
  };
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const { type, config } = loadPage('pages/deleted-recovery/index.js', { app });
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('deleted-recovery 页面', () => {
  test('onLoad 计算保留截止日期', () => {
    const ctx = setup();
    ctx.onLoad();
    expect(ctx.data.remainingDays).toBe(5);
    expect(ctx.data.expiresDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('无 pendingDeletedRecovery 时默认 30 天', () => {
    app.globalData.pendingDeletedRecovery = null;
    const ctx = setup();
    ctx.onLoad();
    expect(ctx.data.remainingDays).toBe(30);
  });

  test('恢复账户：存新 JWT 后 switchTab 回首页', async () => {
    auth.recoverAccount.mockResolvedValue({ jwt: 'new-jwt', userId: 'u2' });
    const ctx = setup();
    ctx.onLoad();
    ctx.onRestore();
    await flush();
    expect(app.setLoginData).toHaveBeenCalledWith('new-jwt', 'u2');
    expect(app.globalData.pendingDeletedRecovery).toBeNull();
    expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' });
  });

  test('恢复失败时 Toast 提示', async () => {
    auth.recoverAccount.mockRejectedValue({ error: 'EXPIRED', message: '注销已超过 30 天' });
    const ctx = setup();
    ctx.onRestore();
    await flush();
    expect(wx.showToast).toHaveBeenCalled();
    expect(wx.switchTab).not.toHaveBeenCalled();
  });

  test('知道了退出小程序', () => {
    const ctx = setup();
    ctx.onDismiss();
    expect(wx.exitMiniProgram).toHaveBeenCalled();
  });
});
