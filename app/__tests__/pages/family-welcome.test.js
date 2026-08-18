// app/__tests__/pages/family-welcome.test.js
// family-welcome 页面测试：onLoad 拉取家庭列表，0 家庭时显示引导，
// 有家庭时跳走；点击创建/加入按钮跳转对应页；网络失败显示重试

const mockAuth = require('../helpers/auth-mock');
jest.mock('../../services/auth', () => mockAuth);

const mockFamily = require('../helpers/family-mock');
jest.mock('../../services/family', () => mockFamily);

const family = require('../../services/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

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
});
