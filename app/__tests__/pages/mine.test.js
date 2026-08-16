// app/__tests__/pages/mine.test.js
const mockAuth = require('../helpers/auth-mock');
jest.mock('../../services/auth', () => mockAuth);

const auth = require('../../services/auth');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const { type, config } = loadPage('pages/mine/index.js');
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('mine 页面', () => {
  test('onShow 并发加载资料与家庭', async () => {
    auth.getProfile.mockResolvedValue({ userId: 'u', nickname: '小明', avatarUrl: null });
    auth.getMyFamilies.mockResolvedValue({
      families: [{ familyId: 'f1', familyName: '我的家', role: 'parent', memberCount: 3 }]
    });
    const ctx = setup();
    ctx.onShow();
    await flush();
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.profile.nickname).toBe('小明');
    expect(ctx.data.currentFamily.familyId).toBe('f1');
    expect(ctx.data.familiesError).toBe(false);
  });

  test('未同意隐私时 onShow 不加载资料/家庭', () => {
    const { type, config } = loadPage('pages/mine/index.js', {
      app: { globalData: { pendingPrivacyConsent: true } }
    });
    expect(type).toBe('page');
    const ctx = createPageContext(config);
    ctx.onShow();
    expect(auth.getProfile).not.toHaveBeenCalled();
    expect(auth.getMyFamilies).not.toHaveBeenCalled();
  });

  test('资料加载失败时用缓存降级', async () => {
    auth.getProfile.mockRejectedValue({ error: 'TOKEN_INVALID' });
    auth.getMyFamilies.mockResolvedValue({ families: [] });
    wx.getStorageSync.mockReturnValue({ nickname: '缓存昵称', avatarUrl: '' });
    const ctx = setup();
    ctx.onShow();
    await flush();
    expect(ctx.data.profile.nickname).toBe('缓存昵称');
  });

  test('家庭加载失败时展示错误占位', async () => {
    auth.getProfile.mockResolvedValue({ nickname: '小明', avatarUrl: null });
    auth.getMyFamilies.mockRejectedValue({ error: 'TOKEN_INVALID' });
    const ctx = setup();
    ctx.onShow();
    await flush();
    expect(ctx.data.familiesError).toBe(true);
    expect(ctx.data.currentFamily).toBeNull();
  });

  test('无家庭时 currentFamily 为 null', async () => {
    auth.getProfile.mockResolvedValue({ nickname: '小明' });
    auth.getMyFamilies.mockResolvedValue({ families: [] });
    const ctx = setup();
    ctx.onShow();
    await flush();
    expect(ctx.data.currentFamily).toBeNull();
  });

  test('点击头像跳转资料编辑页', () => {
    const ctx = setup();
    ctx.onAvatarTap();
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/profile-edit/index' });
  });

  test('点击设置跳转设置页', () => {
    const ctx = setup();
    ctx.onSettings();
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/settings/index' });
  });
});
