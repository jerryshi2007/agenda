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
      families: [{ familyId: 'f1', familyName: '我的家', role: 'Parent', memberCount: 3 }]
    });
    const ctx = setup();
    ctx.onShow();
    await flush();
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.profile.nickname).toBe('小明');
    expect(ctx.data.currentFamily.familyId).toBe('f1');
    expect(ctx.data.familiesError).toBe(false);
  });

  test('role=Parent 展示"家长"（H2 修复：role 枚举大小写契约 PascalCase）', async () => {
    auth.getProfile.mockResolvedValue({ nickname: '小明' });
    auth.getMyFamilies.mockResolvedValue({
      families: [{ familyId: 'f1', familyName: '我的家', role: 'Parent', memberCount: 3 }]
    });
    const ctx = setup();
    ctx.onShow();
    await flush();
    // 契约：role 枚举值为 'Parent' / 'Child'（PascalCase），WXML 模板以该值比对展示"家长/成员"
    expect(ctx.data.currentFamily.role).toBe('Parent');
    // 模拟 WXML 表达式：role === 'Parent' ? '家长' : '成员' → '家长'
    const roleLabel = ctx.data.currentFamily.role === 'Parent' ? '家长' : '成员';
    expect(roleLabel).toBe('家长');
  });

  test('role=Child 展示"成员"', async () => {
    auth.getProfile.mockResolvedValue({ nickname: '小红' });
    auth.getMyFamilies.mockResolvedValue({
      families: [{ familyId: 'f2', familyName: '孩子家', role: 'Child', memberCount: 2 }]
    });
    const ctx = setup();
    ctx.onShow();
    await flush();
    expect(ctx.data.currentFamily.role).toBe('Child');
    const roleLabel = ctx.data.currentFamily.role === 'Parent' ? '家长' : '成员';
    expect(roleLabel).toBe('成员');
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

  test('点击家庭卡片跳转到 family-members 页（带 familyId）', () => {
    const ctx = setup();
    ctx.onFamilyTap({ currentTarget: { dataset: { familyId: 'f1' } } });
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/family-members/index?familyId=f1' });
  });

  test('点击"切换"按钮跳转到 family-switch 页', () => {
    const ctx = setup();
    ctx.onSwitchFamily();
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/family-switch/index' });
  });

  test('点击"创建家庭"跳转到 family-create 页', () => {
    const ctx = setup();
    ctx.onCreateFamily();
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/family-create/index' });
  });

  test('点击"加入家庭"跳转到 family-join 页', () => {
    const ctx = setup();
    ctx.onJoinFamily();
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/family-join/index' });
  });
});
