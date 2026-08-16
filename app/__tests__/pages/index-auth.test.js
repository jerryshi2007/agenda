// app/__tests__/pages/index-auth.test.js
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
    globalData: { pendingPrivacyConsent: false, needsProfileCollection: false },
    onPrivacyAgree: jest.fn(),
    onPrivacyDecline: jest.fn()
  };
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const { type, config } = loadPage('pages/index/index.js', { app });
  expect(type).toBe('page');
  const ctx = createPageContext(config);
  ctx.selectComponent = jest.fn(() => ({ reset: jest.fn() }));
  return ctx;
}

describe('index 页认证弹窗宿主', () => {
  test('pendingPrivacyConsent 时展示隐私弹窗', () => {
    app.globalData.pendingPrivacyConsent = true;
    const ctx = setup();
    ctx._checkAuthOverlays();
    expect(ctx.data.showPrivacyDialog).toBe(true);
  });

  test('未同意隐私时 onShow 仅展示弹窗不拉取日历数据', () => {
    app.globalData.pendingPrivacyConsent = true;
    const ctx = setup();
    ctx.onShow();
    expect(ctx.data.showPrivacyDialog).toBe(true);
    expect(wx.request).not.toHaveBeenCalled();
  });

  test('needsProfileCollection 时展示资料收集弹窗', () => {
    app.globalData.needsProfileCollection = true;
    const ctx = setup();
    ctx._checkAuthOverlays();
    expect(ctx.data.showProfileCollection).toBe(true);
  });

  test('隐私同意成功后隐藏弹窗并检查资料收集', async () => {
    app.onPrivacyAgree.mockResolvedValue({});
    const ctx = setup();
    ctx.data.showPrivacyDialog = true;
    ctx.onPrivacyAgree();
    await flush();
    expect(ctx.data.showPrivacyDialog).toBe(false);
  });

  test('隐私同意失败时复位弹窗供重试', async () => {
    app.onPrivacyAgree.mockRejectedValue({ error: 'LOGIN_FAILED' });
    const dialogReset = jest.fn();
    const ctx = setup();
    ctx.selectComponent.mockReturnValue({ reset: dialogReset });
    ctx.data.showPrivacyDialog = true;
    ctx.onPrivacyAgree();
    await flush();
    expect(dialogReset).toHaveBeenCalled();
  });

  test('隐私拒绝时调用 app.onPrivacyDecline', () => {
    const ctx = setup();
    ctx.onPrivacyDecline();
    expect(app.onPrivacyDecline).toHaveBeenCalled();
  });

  test('资料提交：上传头像后更新资料并清除标记', async () => {
    auth.uploadAvatar.mockResolvedValue({ url: 'https://x/a.png' });
    auth.updateProfile.mockResolvedValue({ nickname: '小明' });
    const ctx = setup();
    ctx.data.showProfileCollection = true;
    ctx.onProfileSubmit({ detail: { nickname: '小明', avatarUrl: '/tmp/a.png' } });
    await flush();
    expect(auth.uploadAvatar).toHaveBeenCalledWith('/tmp/a.png');
    expect(auth.updateProfile).toHaveBeenCalledWith({ nickname: '小明', avatarUrl: 'https://x/a.png' });
    expect(app.globalData.needsProfileCollection).toBe(false);
    expect(ctx.data.showProfileCollection).toBe(false);
  });

  test('资料提交无头像时仅更新资料', async () => {
    auth.updateProfile.mockResolvedValue({ nickname: '小明' });
    const ctx = setup();
    ctx.onProfileSubmit({ detail: { nickname: '小明', avatarUrl: '' } });
    await flush();
    expect(auth.uploadAvatar).not.toHaveBeenCalled();
    expect(auth.updateProfile).toHaveBeenCalledWith({ nickname: '小明', avatarUrl: null });
  });

  test('资料提交失败时保留弹窗（输入不清空）', async () => {
    auth.updateProfile.mockRejectedValue({ error: 'NICKNAME_SENSITIVE', message: '昵称包含不允许的词汇' });
    const ctx = setup();
    ctx.data.showProfileCollection = true;
    ctx.onProfileSubmit({ detail: { nickname: '违规', avatarUrl: '' } });
    await flush();
    expect(ctx.data.showProfileCollection).toBe(true);
    expect(wx.showToast).toHaveBeenCalled();
  });

  test('跳过资料收集仅清除标记', () => {
    const ctx = setup();
    ctx.data.showProfileCollection = true;
    ctx.onProfileSkip();
    expect(app.globalData.needsProfileCollection).toBe(false);
    expect(ctx.data.showProfileCollection).toBe(false);
  });
});
