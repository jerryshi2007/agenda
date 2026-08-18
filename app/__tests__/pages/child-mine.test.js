// app/__tests__/pages/child-mine.test.js
// child-mine 页面测试：displayMode 读取、孩子姓名展示、本周完成率渲染

const mockChildSchedule = require('../helpers/child-schedule-mock');
const mockAuth = require('../helpers/auth-mock');
jest.mock('../../services/child-schedule', () => mockChildSchedule);
jest.mock('../../services/auth', () => mockAuth);

const childSchedule = require('../../services/child-schedule');
const auth = require('../../services/auth');
const { DisplayMode } = require('../../contracts/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  childSchedule.getWeeklyCompletion.mockResolvedValue({ percentage: 0, completed: 0, total: 0 });
  // H2 回归保护：auth.getProfile() 真实返回只有 { userId, nickname, avatarUrl?, createdAt }
  // 没有 childName 字段；child-mine 页面 childName MUST 仅取自 profile.nickname
  auth.getProfile.mockResolvedValue({ nickname: '小明' });
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(appData = {}) {
  const { type, config } = loadPage('pages/child-mine/index.js', {
    app: { globalData: appData }
  });
  expect(type).toBe('page');
  return createPageContext(config);
}

const SAMPLE_WEEKLY = { percentage: 75, completed: 3, total: 4 };

describe('child-mine 页面', () => {
  describe('onLoad 读取 displayMode', () => {
    test('从 globalData.displayMode 读取并设置到 data', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      expect(ctx.data.displayMode).toBe(DisplayMode.Primary);
    });

    test('globalData.displayMode 缺失时使用 Primary 默认值', () => {
      const ctx = setup({});
      ctx.onLoad();
      expect(ctx.data.displayMode).toBe(DisplayMode.Primary);
    });
  });

  describe('孩子姓名展示', () => {
    test('childName 取自 profile.nickname（auth.getProfile 真实契约）', async () => {
      auth.getProfile.mockResolvedValue({ nickname: '默认昵称' });
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.childName).toBe('默认昵称');
    });

    // H2 回归保护：real auth.getProfile() 不返回 childName 字段；
    // 即使响应中混入 childName，页面 MUST 仅取 profile.nickname
    test('H2 回归：profile.childName 字段被忽略，childName 取自 nickname', async () => {
      auth.getProfile.mockResolvedValue({ childName: '假冒姓名', nickname: '真昵称' });
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.childName).toBe('真昵称');
      expect(ctx.data.childName).not.toBe('假冒姓名');
    });

    test('profile 加载失败时 childName 为空字符串（不阻断本周完成率展示）', async () => {
      auth.getProfile.mockRejectedValue({ message: '网络异常' });
      childSchedule.getWeeklyCompletion.mockResolvedValue(SAMPLE_WEEKLY);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.childName).toBe('');
      // 本周完成率仍可展示
      expect(ctx.data.weeklyPercentage).toBe(75);
    });
  });

  describe('本周完成率渲染', () => {
    test('加载完成后写入 percentage/completed/total', async () => {
      childSchedule.getWeeklyCompletion.mockResolvedValue(SAMPLE_WEEKLY);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.weeklyPercentage).toBe(75);
      expect(ctx.data.weeklyCompleted).toBe(3);
      expect(ctx.data.weeklyTotal).toBe(4);
      expect(ctx.data.weeklyText).toBe('已完成 3/4');
      expect(ctx.data.weeklyLoading).toBe(false);
    });

    test('并发加载资料与本周完成率', async () => {
      auth.getProfile.mockResolvedValue({ nickname: '小红' });
      childSchedule.getWeeklyCompletion.mockResolvedValue(SAMPLE_WEEKLY);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.loading).toBe(false);
      expect(auth.getProfile).toHaveBeenCalled();
      expect(childSchedule.getWeeklyCompletion).toHaveBeenCalled();
    });

    test('本周完成率加载失败时使用 0/0/0 降级展示', async () => {
      auth.getProfile.mockResolvedValue({ nickname: '小红' });
      childSchedule.getWeeklyCompletion.mockRejectedValue({ message: '网络异常' });
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.weeklyPercentage).toBe(0);
      expect(ctx.data.weeklyCompleted).toBe(0);
      expect(ctx.data.weeklyTotal).toBe(0);
      expect(ctx.data.weeklyText).toBe('已完成 0/0');
    });
  });

  describe('隐私策略', () => {
    test('未同意隐私时 onShow 不加载资料/完成率', () => {
      const { type, config } = loadPage('pages/child-mine/index.js', {
        app: { globalData: { pendingPrivacyConsent: true } }
      });
      expect(type).toBe('page');
      const ctx = createPageContext(config);
      ctx.onShow();
      expect(auth.getProfile).not.toHaveBeenCalled();
      expect(childSchedule.getWeeklyCompletion).not.toHaveBeenCalled();
    });
  });

  describe('data-id 契约（文本级）', () => {
    test('WXML 包含必需 data-id', () => {
      const fs = require('fs');
      const path = require('path');
      const wxml = fs.readFileSync(
        path.resolve(__dirname, '../../pages/child-mine/index.wxml'),
        'utf8'
      );
      [
        'child-mine-name',
        'child-mine-progress',
        'child-mine-progress-text',
        'child-mine-progress-bar-fill',
        'child-mine-loading',
        'child-mine-error',
        'child-mine-nav-today',
        'child-mine-nav-week',
        'child-mine-nav-month',
        'child-mine-nav-mine'
      ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
    });

    test('WXML 不包含家长端管理功能入口（避免越界）', () => {
      const fs = require('fs');
      const path = require('path');
      const wxml = fs.readFileSync(
        path.resolve(__dirname, '../../pages/child-mine/index.wxml'),
        'utf8'
      );
      // 不应包含切换家庭、加入/创建家庭、设置等家长管理入口
      expect(wxml).not.toContain('family-switch');
      expect(wxml).not.toContain('family-create');
      expect(wxml).not.toContain('family-join');
      expect(wxml).not.toContain('settings');
    });
  });

  describe('视图切换', () => {
    test('onSwitchToToday 跳转到 child-today 页面', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onSwitchToToday();
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/child-today/index' });
    });

    test('onSwitchToWeek 跳转到 child-week 页面', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onSwitchToWeek();
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/child-week/index' });
    });

    test('onSwitchToMonth 跳转到 child-month 页面', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onSwitchToMonth();
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/child-month/index' });
    });
  });
});
