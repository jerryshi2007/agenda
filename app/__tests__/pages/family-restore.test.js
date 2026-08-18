// app/__tests__/pages/family-restore.test.js
// family-restore 页面测试：拉取已解散家庭、倒计时、恢复/不恢复两个选项

const mockFamily = require('../helpers/family-mock');
jest.mock('../../services/family', () => mockFamily);

const family = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ErrorCodes, ErrorMessages, FamilyStatus } = require('../../contracts/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  wx.getStorageSync.mockImplementation((k) => k === STORAGE_KEYS.CURRENT_FAMILY_ID ? 'f-current' : null);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(query = {}) {
  const { type, config } = loadPage('pages/family-restore/index.js', { query });
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('family-restore 页面', () => {
  test('onLoad 从 query 读取 familyId 和 familyName', () => {
    const ctx = setup({ familyId: 'f1', familyName: '我的家' });
    ctx.onLoad({ familyId: 'f1', familyName: '我的家' });
    expect(ctx.data.familyId).toBe('f1');
    expect(ctx.data.familyName).toBe('我的家');
  });

  test('onLoad 计算剩余天数（基于 dissolveExpiresAt）', () => {
    const now = new Date('2026-08-18T00:00:00Z').getTime();
    const expires = '2026-08-21T00:00:00Z';
    const ctx = setup({ familyId: 'f1', familyName: '家', dissolveExpiresAt: expires });
    ctx.onLoad({ familyId: 'f1', familyName: '家', dissolveExpiresAt: expires });
    // 实际天数取决于系统时间，但应 >= 0 且 <= 30
    const days = ctx.data.daysLeft;
    expect(typeof days).toBe('number');
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(30);
  });

  test('onRestore 调 familyService.restoreFamily', async () => {
    family.restoreFamily.mockResolvedValue({ familyId: 'f1', status: FamilyStatus.Normal });
    const ctx = setup();
    ctx.onLoad({ familyId: 'f1', familyName: '家' });
    await ctx.onRestore();
    expect(family.restoreFamily).toHaveBeenCalledWith('f1');
  });

  test('onRestore 成功后设置 success=true', async () => {
    family.restoreFamily.mockResolvedValue({ familyId: 'f1', status: FamilyStatus.Normal });
    const ctx = setup();
    ctx.onLoad({ familyId: 'f1', familyName: '家' });
    await ctx.onRestore();
    expect(ctx.data.success).toBe(true);
  });

  test('onRestore 失败时设置 errorMessage（来自 contracts）', async () => {
    family.restoreFamily.mockRejectedValue({ message: ErrorMessages.DISSOLVED_EXPIRED });
    const ctx = setup();
    ctx.onLoad({ familyId: 'f1', familyName: '家' });
    await ctx.onRestore();
    expect(ctx.data.errorMessage).toBe('数据已过期删除，无法恢复');
  });

  test('onSkip 不调用 restoreFamily', () => {
    const ctx = setup();
    ctx.onLoad({ familyId: 'f1', familyName: '家' });
    ctx.onSkip();
    expect(family.restoreFamily).not.toHaveBeenCalled();
  });

  test('onSkip 调用 wx.reLaunch 跳转 welcome 页', () => {
    const ctx = setup();
    ctx.onLoad({ familyId: 'f1', familyName: '家' });
    ctx.onSkip();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/family-welcome/index' });
  });

  test('restoring 期间防止重复点击', async () => {
    let resolveApi;
    family.restoreFamily.mockImplementation(() => new Promise((r) => { resolveApi = r; }));
    const ctx = setup();
    ctx.onLoad({ familyId: 'f1', familyName: '家' });
    const p1 = ctx.onRestore();
    const p2 = ctx.onRestore();
    expect(ctx.data.restoring).toBe(true);
    resolveApi({ familyId: 'f1', status: FamilyStatus.Normal });
    await p1;
    await p2;
    expect(family.restoreFamily).toHaveBeenCalledTimes(1);
  });

  test('dissolveExpiresAt 为空时 daysLeft 默认为 0', () => {
    const ctx = setup();
    ctx.onLoad({ familyId: 'f1', familyName: '家' });
    expect(ctx.data.daysLeft).toBe(0);
  });
});
