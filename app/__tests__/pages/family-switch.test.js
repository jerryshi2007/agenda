// app/__tests__/pages/family-switch.test.js
// family-switch 页面测试：拉取家庭列表、标记当前家庭、切换后写入 CURRENT_FAMILY_ID、退出页面

const mockFamily = require('../helpers/family-mock');
jest.mock('../../services/family', () => mockFamily);

const family = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ErrorMessages } = require('../../contracts/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  wx.getStorageSync.mockImplementation((k) => k === STORAGE_KEYS.CURRENT_FAMILY_ID ? 'f-current' : null);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const { type, config } = loadPage('pages/family-switch/index.js');
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('family-switch 页面', () => {
  test('onLoad 调 getMyFamilies 拉取家庭列表', async () => {
    family.getMyFamilies.mockResolvedValue({ families: [
      { familyId: 'f1', familyName: '家1', role: 'Parent', memberCount: 3 },
      { familyId: 'f2', familyName: '家2', role: 'Parent', memberCount: 2 }
    ] });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(family.getMyFamilies).toHaveBeenCalled();
    expect(ctx.data.families.length).toBe(2);
  });

  test('标记当前家庭（familyId 与 storage 一致）', async () => {
    family.getMyFamilies.mockResolvedValue({ families: [
      { familyId: 'f-current', familyName: '当前家', role: 'Parent', memberCount: 3 },
      { familyId: 'f2', familyName: '家2', role: 'Parent', memberCount: 2 }
    ] });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    const current = ctx.data.families.find(f => f.isCurrent);
    expect(current.familyId).toBe('f-current');
    expect(ctx.data.families.find(f => f.familyId === 'f2').isCurrent).toBe(false);
  });

  test('onSelectFamily 写入 CURRENT_FAMILY_ID 到 storage', async () => {
    family.getMyFamilies.mockResolvedValue({ families: [
      { familyId: 'f-current', familyName: '当前家', role: 'Parent', memberCount: 3 },
      { familyId: 'f2', familyName: '家2', role: 'Parent', memberCount: 2 }
    ] });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    ctx.onSelectFamily({ currentTarget: { dataset: { familyId: 'f2' } } });
    expect(wx.setStorageSync).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_FAMILY_ID, 'f2');
  });

  test('onSelectFamily 切换后调用 wx.reLaunch 重新加载首页', async () => {
    family.getMyFamilies.mockResolvedValue({ families: [
      { familyId: 'f-current', familyName: '当前家', role: 'Parent', memberCount: 3 },
      { familyId: 'f2', familyName: '家2', role: 'Parent', memberCount: 2 }
    ] });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    ctx.onSelectFamily({ currentTarget: { dataset: { familyId: 'f2' } } });
    expect(wx.reLaunch).toHaveBeenCalled();
  });

  test('选择当前家庭时不重复切换（不写 storage / 不 reLaunch）', async () => {
    family.getMyFamilies.mockResolvedValue({ families: [
      { familyId: 'f-current', familyName: '当前家', role: 'Parent', memberCount: 3 }
    ] });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    wx.setStorageSync.mockClear();
    wx.reLaunch.mockClear();
    ctx.onSelectFamily({ currentTarget: { dataset: { familyId: 'f-current' } } });
    expect(wx.setStorageSync).not.toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_FAMILY_ID, 'f-current');
    expect(wx.reLaunch).not.toHaveBeenCalled();
  });

  test('拉取失败时显示错误态', async () => {
    family.getMyFamilies.mockRejectedValue({ message: '网络异常' });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.error).toBe(true);
    expect(ctx.data.errorMessage).toBe('网络异常');
  });

  test('只有 1 个家庭时 empty 提示"仅有 1 个家庭"', async () => {
    family.getMyFamilies.mockResolvedValue({ families: [
      { familyId: 'f1', familyName: '家1', role: 'Parent', memberCount: 3 }
    ] });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.singleFamily).toBe(true);
  });

  test('多个家庭时 singleFamily = false', async () => {
    family.getMyFamilies.mockResolvedValue({ families: [
      { familyId: 'f1', familyName: '家1', role: 'Parent', memberCount: 3 },
      { familyId: 'f2', familyName: '家2', role: 'Parent', memberCount: 2 }
    ] });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.singleFamily).toBe(false);
  });

  test('onRetry 重新拉取', async () => {
    family.getMyFamilies.mockRejectedValueOnce({ message: '错误' });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.error).toBe(true);
    family.getMyFamilies.mockResolvedValue({ families: [] });
    ctx.onRetry();
    await flush();
    expect(ctx.data.error).toBe(false);
  });
});
