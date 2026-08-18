// app/__tests__/pages/family-welcome.test.js
// family-welcome 页面测试：onLoad 拉取家庭列表，0 家庭时显示引导，
// 有家庭时跳走；点击创建/加入按钮跳转对应页；网络失败显示重试
// TC-FW-04：分享卡片（query.inviteCode）进入时自动调 getShareInfo 预填并展示确认页

const mockAuth = require('../helpers/auth-mock');
jest.mock('../../services/auth', () => mockAuth);

const mockFamily = require('../helpers/family-mock');
jest.mock('../../services/family', () => mockFamily);

const family = require('../../services/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');
const { ErrorMessages } = require('../../contracts/family');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(opts = {}) {
  const { type, config } = loadPage('pages/family-welcome/index.js', opts);
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('family-welcome 页面', () => {
  test('onLoad 并发拉取家庭列表（无家庭时显示引导）', async () => {
    family.getMyFamilies.mockResolvedValue({ families: [] });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.error).toBe(false);
    expect(ctx.data.hasFamily).toBe(false);
  });

  test('有家庭时 onLoad 后跳转日历（switchTab 到首页）', async () => {
    family.getMyFamilies.mockResolvedValue({ families: [{ familyId: 'f1', familyName: '家' }] });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' });
  });

  test('拉取失败时显示错误态', async () => {
    family.getMyFamilies.mockRejectedValue({ error: 'NETWORK_ERROR', message: '网络异常' });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.error).toBe(true);
  });

  test('点击创建家庭跳转到 family-create', () => {
    const ctx = setup();
    ctx.onCreateFamily();
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/family-create/index' });
  });

  test('点击加入家庭跳转到 family-join', () => {
    const ctx = setup();
    ctx.onJoinFamily();
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/family-join/index' });
  });

  test('点击重试重新拉取家庭列表', async () => {
    family.getMyFamilies.mockRejectedValue({ error: 'NETWORK_ERROR' });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.error).toBe(true);
    family.getMyFamilies.mockResolvedValue({ families: [] });
    ctx.onRetry();
    await flush();
    expect(ctx.data.error).toBe(false);
    expect(family.getMyFamilies).toHaveBeenCalledTimes(2);
  });

  // TC-FW-04：分享卡片（query.inviteCode）进入 family-welcome 调 getShareInfo
  test('TC-FW-04：query.inviteCode 存在时 onLoad 自动调 getShareInfo 预填', async () => {
    family.getShareInfo.mockResolvedValue({
      familyName: '小明的家',
      inviterName: '小明妈妈',
      targetRole: 'Child',
      inviteCode: '234567',
      isValid: true,
      targetChildName: '小明',
      targetDisplayMode: 'Primary'
    });
    const ctx = setup();
    ctx.onLoad({ inviteCode: '234567' });
    await flush();
    expect(family.getShareInfo).toHaveBeenCalledWith('234567');
    expect(ctx.data.shareInfo.familyName).toBe('小明的家');
    expect(ctx.data.shareInfo.targetChildName).toBe('小明');
    expect(ctx.data.pendingShare).toBe(false);
  });

  test('TC-FW-04：getShareInfo 失败时展示 INVALID_INVITATION_CODE 提示（来自 contracts）', async () => {
    family.getShareInfo.mockRejectedValue({ message: ErrorMessages.INVALID_INVITATION_CODE });
    const ctx = setup();
    ctx.onLoad({ inviteCode: '999999' });
    await flush();
    expect(family.getShareInfo).toHaveBeenCalledWith('999999');
    expect(ctx.data.shareError).toBe(ErrorMessages.INVALID_INVITATION_CODE);
    expect(ctx.data.shareInfo).toBeNull();
  });

  test('TC-FW-04：onAcceptShare 跳转到 family-join 并预填 inviteCode', async () => {
    family.getShareInfo.mockResolvedValue({
      familyName: '小明的家',
      inviterName: '小明妈妈',
      targetRole: 'Child',
      inviteCode: '234567',
      isValid: true
    });
    const ctx = setup();
    ctx.onLoad({ inviteCode: '234567' });
    await flush();
    ctx.onAcceptShare();
    expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/family-join/index?inviteCode=234567' });
  });

  test('TC-FW-04：onDeclineShare 回到普通引导态（重置 shareInfo 并调 getMyFamilies）', async () => {
    family.getShareInfo.mockResolvedValue({
      familyName: '小明的家',
      inviterName: '小明妈妈',
      targetRole: 'Child',
      inviteCode: '234567',
      isValid: true
    });
    family.getMyFamilies.mockResolvedValue({ families: [] });
    const ctx = setup();
    ctx.onLoad({ inviteCode: '234567' });
    await flush();
    ctx.onDeclineShare();
    await flush();
    expect(ctx.data.shareInfo).toBeNull();
    expect(ctx.data.pendingShare).toBe(false);
    expect(family.getMyFamilies).toHaveBeenCalled();
  });
});
