// app/miniapp-test/__tests__/app.test.js
const mockAuth = require('./helpers/auth-mock');
const mockFamily = { getMembers: jest.fn(), getMyFamilies: jest.fn() };
jest.mock('../../miniapp/services/auth', () => mockAuth);
jest.mock('../../miniapp/services/family', () => mockFamily);
jest.mock('../../miniapp/utils/crypto', () => ({ encrypt: (s) => s, decrypt: (s) => s }));

const auth = require('../../miniapp/services/auth');
const family = require('../../miniapp/services/family');
const STORAGE_KEYS = require('../../miniapp/utils/storage-keys');
const { installWxMock } = require('./helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  // 默认空家庭：既有 doLogin 用例中 getStorageSync 返回统一对象，familyId 会命中 truthy 分支，
  // 需保证 getMembers 返回 Promise 而非 undefined，否则 loadFamilyMembers 的 .then 同步抛错
  family.getMembers.mockResolvedValue({ parents: [], children: [] });
  // getMyFamilies 同样需默认返回 Promise，否则 refreshFamilyContext 空 familyId 分支的 .then 抛错
  family.getMyFamilies.mockResolvedValue({ families: [] });
  // 必须在 resetAllMocks 之后注册，否则实现会被清空（resetAllMocks 移除实现）
  global.getCurrentPages = jest.fn(() => []);
});

function loadApp() {
  let captured = null;
  const prevApp = global.App;
  global.App = (cfg) => { captured = cfg; };
  // Jest 的 require.cache delete 不生效，用 resetModules 强制重新执行
  jest.resetModules();
  require('../../miniapp/app.js');
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

describe('app.js 家庭上下文加载（memberList + userRole）', () => {
  test('家长视角：memberList 含全体成员且 userRole 派生为 Parent', async () => {
    family.getMembers.mockResolvedValue({
      familyName: '我家',
      creatorId: 'u1',
      parents: [{ userId: 'u1', role: 'Parent', nickname: '爸爸', avatarUrl: 'a1' }],
      children: [
        { userId: 'u2', role: 'Child', childName: '小明', nickname: '小明', avatarUrl: 'a2' },
        { userId: 'u3', role: 'Child', childName: '小红', nickname: '小红', avatarUrl: 'a3' }
      ]
    });
    const ctx = createAppContext(loadApp());
    ctx.globalData.userId = 'u1';
    ctx.globalData.currentFamilyId = 'f1';

    await ctx.refreshFamilyContext();

    expect(family.getMembers).toHaveBeenCalledWith('f1');
    expect(ctx.globalData.userRole).toBe('Parent');
    expect(ctx.globalData.memberList).toEqual([
      { userId: 'u1', role: 'Parent', name: '爸爸', avatarUrl: 'a1' },
      { userId: 'u2', role: 'Child', name: '小明', avatarUrl: 'a2' },
      { userId: 'u3', role: 'Child', name: '小红', avatarUrl: 'a3' }
    ]);
    expect(ctx.globalData.currentFamilyId).toBe('f1');
  });

  test('孩子视角：memberList 仅自身且 userRole 派生为 Child', async () => {
    family.getMembers.mockResolvedValue({
      familyName: '我家',
      creatorId: 'u1',
      parents: [{ userId: 'u1', role: 'Parent', nickname: '爸爸' }],
      children: [
        { userId: 'u2', role: 'Child', childName: '小明', nickname: '小明', avatarUrl: 'a2' },
        { userId: 'u3', role: 'Child', childName: '小红', nickname: '小红', avatarUrl: 'a3' }
      ]
    });
    const ctx = createAppContext(loadApp());
    ctx.globalData.userId = 'u2';
    ctx.globalData.currentFamilyId = 'f1';

    await ctx.refreshFamilyContext();

    expect(ctx.globalData.userRole).toBe('Child');
    expect(ctx.globalData.memberList).toEqual([
      { userId: 'u2', role: 'Child', name: '小明', avatarUrl: 'a2' }
    ]);
  });

  test('无家庭且用户无任何家庭时清空 memberList 与 userRole', async () => {
    family.getMyFamilies.mockResolvedValue({ families: [] });
    const ctx = createAppContext(loadApp());
    ctx.globalData.userId = 'u1';
    ctx.globalData.currentFamilyId = null;
    ctx.globalData.memberList = [{ userId: 'u9', role: 'Parent', name: '残留' }];
    ctx.globalData.userRole = 'Parent';

    await ctx.refreshFamilyContext();

    expect(ctx.globalData.memberList).toEqual([]);
    expect(ctx.globalData.userRole).toBeNull();
    expect(family.getMembers).not.toHaveBeenCalled();
    expect(family.getMyFamilies).toHaveBeenCalled();
  });

  test('CURRENT_FAMILY_ID 为空且用户有 ≥1 家庭时补写首项并加载成员', async () => {
    wx.getStorageSync.mockImplementation(() => null);
    family.getMyFamilies.mockResolvedValue({ families: [
      { familyId: 'f-first', familyName: '第一个家', role: 'Parent', memberCount: 2 }
    ] });
    family.getMembers.mockResolvedValue({
      parents: [{ userId: 'u1', role: 'Parent', nickname: '爸爸' }],
      children: []
    });
    const ctx = createAppContext(loadApp());
    ctx.globalData.userId = 'u1';
    ctx.globalData.currentFamilyId = null;

    await ctx.refreshFamilyContext();

    expect(family.getMyFamilies).toHaveBeenCalled();
    expect(wx.setStorageSync).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_FAMILY_ID, 'f-first');
    expect(family.getMembers).toHaveBeenCalledWith('f-first');
    expect(ctx.globalData.userRole).toBe('Parent');
    expect(ctx.globalData.currentFamilyId).toBe('f-first');
  });

  test('getMyFamilies 失败且无当前家庭时清空 memberList 与 userRole', async () => {
    family.getMyFamilies.mockRejectedValue({ error: 'NETWORK_ERROR' });
    const ctx = createAppContext(loadApp());
    ctx.globalData.userId = 'u1';
    ctx.globalData.currentFamilyId = null;
    ctx.globalData.memberList = [{ userId: 'u9', role: 'Parent', name: '残留' }];
    ctx.globalData.userRole = 'Parent';

    await ctx.refreshFamilyContext();

    expect(ctx.globalData.memberList).toEqual([]);
    expect(ctx.globalData.userRole).toBeNull();
  });

  test('无 userId 时清空 memberList 与 userRole 且不请求', async () => {
    const ctx = createAppContext(loadApp());
    ctx.globalData.userId = null;
    ctx.globalData.currentFamilyId = 'f1';
    ctx.globalData.memberList = [{ userId: 'u9', role: 'Child', name: '残留' }];
    ctx.globalData.userRole = 'Child';

    await ctx.refreshFamilyContext();

    expect(ctx.globalData.memberList).toEqual([]);
    expect(ctx.globalData.userRole).toBeNull();
    expect(family.getMembers).not.toHaveBeenCalled();
  });

  test('自身不在成员列表时清空 memberList 与 userRole（防残留）', async () => {
    family.getMembers.mockResolvedValue({
      parents: [{ userId: 'u1', role: 'Parent', nickname: '爸爸' }],
      children: []
    });
    const ctx = createAppContext(loadApp());
    ctx.globalData.userId = 'u-ghost';
    ctx.globalData.currentFamilyId = 'f1';
    ctx.globalData.memberList = [{ userId: 'u1', role: 'Parent', name: '爸爸' }];
    ctx.globalData.userRole = 'Parent';

    await ctx.refreshFamilyContext();

    expect(ctx.globalData.memberList).toEqual([]);
    expect(ctx.globalData.userRole).toBeNull();
  });

  test('接口失败时清空 memberList 与 userRole', async () => {
    family.getMembers.mockRejectedValue({ error: 'NETWORK_ERROR', message: '网络请求失败' });
    const ctx = createAppContext(loadApp());
    ctx.globalData.userId = 'u1';
    ctx.globalData.currentFamilyId = 'f1';
    ctx.globalData.memberList = [{ userId: 'u1', role: 'Parent', name: '爸爸' }];
    ctx.globalData.userRole = 'Parent';

    await ctx.refreshFamilyContext();

    expect(ctx.globalData.memberList).toEqual([]);
    expect(ctx.globalData.userRole).toBeNull();
  });

  test('doLogin 成功后触发家庭成员上下文加载', async () => {
    wx.getStorageSync.mockImplementation((key) => key === 'current_family_id' ? 'f1' : null);
    wx.login.mockImplementation(({ success }) => success({ code: 'code-8' }));
    auth.login.mockResolvedValue({ jwt: 'j8', userId: 'u8', isNewUser: false, needsProfileCollection: false });
    family.getMembers.mockResolvedValue({
      parents: [{ userId: 'u8', role: 'Parent', nickname: '爸爸' }],
      children: []
    });
    const ctx = createAppContext(loadApp());

    await ctx.doLogin();

    expect(family.getMembers).toHaveBeenCalledWith('f1');
  });
});
