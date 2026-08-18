// app/__tests__/utils/family-state.test.js
// 多家庭状态记忆 helper —— TC-FSW-06
// 存储键格式：family-{familyId}-state
// 覆盖：load/save/clear 三个动作 + 跨家庭隔离

const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
});

const familyState = require('../../utils/family-state');

describe('TC-FSW-06：多家庭状态记忆 helper', () => {
  test('loadState：storage 无值时返回 null', () => {
    wx.getStorageSync.mockReturnValue(null);
    expect(familyState.loadState('f1')).toBeNull();
  });

  test('loadState：storage 有值时返回 state 对象', () => {
    const state = { view: 'week', date: '2026-08-18', filterChildId: '' };
    wx.getStorageSync.mockReturnValue(state);
    expect(familyState.loadState('f1')).toEqual(state);
  });

  test('loadState：familyId 为空时返回 null（不调 storage）', () => {
    expect(familyState.loadState('')).toBeNull();
    expect(familyState.loadState(null)).toBeNull();
    expect(wx.getStorageSync).not.toHaveBeenCalled();
  });

  test('saveState：写入 storage 时键为 family-{familyId}-state', () => {
    const state = { view: 'month', date: '2026-08-01' };
    familyState.saveState('f1', state);
    expect(wx.setStorageSync).toHaveBeenCalledWith('family-f1-state', state);
  });

  test('saveState：state 为空时跳过写入', () => {
    familyState.saveState('f1', null);
    expect(wx.setStorageSync).not.toHaveBeenCalled();
  });

  test('clearState：移除 storage 键', () => {
    familyState.clearState('f1');
    expect(wx.removeStorageSync).toHaveBeenCalledWith('family-f1-state');
  });

  test('clearState：familyId 为空时跳过', () => {
    familyState.clearState('');
    expect(wx.removeStorageSync).not.toHaveBeenCalled();
  });

  // 跨家庭隔离：每个 familyId 独立键
  test('跨家庭隔离：loadState 不同 familyId 调用 storage 时使用不同键', () => {
    wx.getStorageSync.mockReturnValue(null);
    familyState.loadState('f1');
    familyState.loadState('f2');
    expect(wx.getStorageSync).toHaveBeenNthCalledWith(1, 'family-f1-state');
    expect(wx.getStorageSync).toHaveBeenNthCalledWith(2, 'family-f2-state');
  });

  test('跨家庭隔离：saveState 不同 familyId 写入不同键（互不覆盖）', () => {
    familyState.saveState('f1', { view: 'week' });
    familyState.saveState('f2', { view: 'month' });
    expect(wx.setStorageSync).toHaveBeenCalledWith('family-f1-state', { view: 'week' });
    expect(wx.setStorageSync).toHaveBeenCalledWith('family-f2-state', { view: 'month' });
  });

  // 端到端：模拟多家庭切换场景
  test('端到端：家庭 A 选周视图 → 家庭 B 选月视图 → 切回 A 仍是周视图', () => {
    const store = new Map();
    wx.setStorageSync.mockImplementation((k, v) => store.set(k, v));
    wx.getStorageSync.mockImplementation((k) => store.get(k) || null);

    // 用户切到 A，保存周视图
    familyState.saveState('f-A', { view: 'week', date: '2026-08-18' });

    // 用户切到 B，保存月视图
    familyState.saveState('f-B', { view: 'month', date: '2026-08-01' });

    // 切回 A：读取到周视图
    const stateA = familyState.loadState('f-A');
    expect(stateA.view).toBe('week');

    // 切到 B：读取到月视图
    const stateB = familyState.loadState('f-B');
    expect(stateB.view).toBe('month');
  });
});
