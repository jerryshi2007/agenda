// app/__tests__/pages/settings.test.js
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
  app = { globalData: { userId: 'u1' } };
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const { type, config } = loadPage('pages/settings/index.js', { app });
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('settings 页面注销流程', () => {
  test('canDelete=false 时弹窗提示家庭未退出', async () => {
    auth.getDeletionStatus.mockResolvedValue({ isDeleted: false, canDelete: false, blockReason: 'FAMILY_STILL_ACTIVE' });
    const ctx = setup();
    ctx.onDeleteAccount();
    await flush();
    expect(wx.showModal).toHaveBeenCalledWith(expect.objectContaining({
      title: '无法注销',
      content: '请先退出所有家庭后再注销'
    }));
  });

  test('isDeleted=true 时跳转恢复页', async () => {
    auth.getDeletionStatus.mockResolvedValue({ isDeleted: true, remainingDays: 12 });
    const ctx = setup();
    ctx.onDeleteAccount();
    await flush();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/deleted-recovery/index' });
    expect(app.globalData.pendingDeletedRecovery).toEqual({ remainingDays: 12 });
  });

  test('canDelete=true 时确认后进入二次确认弹窗', async () => {
    auth.getDeletionStatus.mockResolvedValue({ isDeleted: false, canDelete: true });
    wx.showModal.mockImplementation(({ success }) => success({ confirm: true }));
    const ctx = setup();
    ctx.onDeleteAccount();
    await flush();
    expect(ctx.data.showDeleteDialog).toBe(true);
  });

  test('二次确认取消关闭弹窗', () => {
    const ctx = setup();
    ctx.data.showDeleteDialog = true;
    ctx.onDeleteCancel();
    expect(ctx.data.showDeleteDialog).toBe(false);
  });

  test('二次确认注销后清除 Token 与缓存并退出小程序', async () => {
    auth.deleteAccount.mockResolvedValue({ expiresAt: '2026-09-07', remainingDays: 30 });
    const ctx = setup();
    ctx.data.showDeleteDialog = true;
    ctx.onDeleteConfirm();
    await flush();
    expect(auth.deleteAccount).toHaveBeenCalled();
    expect(wx.removeStorageSync).toHaveBeenCalledWith('auth_token');
    expect(wx.removeStorageSync).toHaveBeenCalledWith('user_profile_cache');
    expect(wx.removeStorageSync).toHaveBeenCalledWith('families_cache');
    expect(app.globalData.userId).toBeNull();
    expect(wx.exitMiniProgram).toHaveBeenCalled();
  });

  test('注销失败时不改变本地状态', async () => {
    auth.deleteAccount.mockRejectedValue({ error: 'FAMILY_STILL_ACTIVE' });
    const ctx = setup();
    ctx.data.showDeleteDialog = true;
    ctx.onDeleteConfirm();
    await flush();
    expect(wx.exitMiniProgram).not.toHaveBeenCalled();
    expect(wx.removeStorageSync).not.toHaveBeenCalled();
    expect(wx.showToast).toHaveBeenCalled();
  });
});
