// app/__tests__/pages/child-month.test.js
// child-month 页面测试：displayMode 读取、月日历生成、点击日期跳转今日视图

const mockChildSchedule = require('../helpers/child-schedule-mock');
jest.mock('../../services/child-schedule', () => mockChildSchedule);

const childSchedule = require('../../services/child-schedule');
const dateUtils = require('../../utils/date-utils');
const { DisplayMode } = require('../../contracts/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  childSchedule.getMonthList.mockResolvedValue({ dates: [] });
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(appData = {}) {
  const { type, config } = loadPage('pages/child-month/index.js', {
    app: { globalData: appData }
  });
  expect(type).toBe('page');
  return createPageContext(config);
}

// 测试当月前 5 天（固定日期便于断言）
const SAMPLE_MONTH = {
  dates: [
    { date: '2026-08-01', dots: [{ scheduleType: 'DailyRoutine' }], scheduleCount: 1 },
    { date: '2026-08-05', dots: [{ scheduleType: 'AfterSchoolActivity' }, { scheduleType: 'HomeworkTask' }], scheduleCount: 2 },
    { date: '2026-08-15', dots: [{ scheduleType: 'HomeworkTask' }], scheduleCount: 1 }
  ]
};

describe('child-month 页面', () => {
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

  describe('月日历生成', () => {
    test('cells 为 42 格（7x6）', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      expect(ctx.data.cells).toHaveLength(42);
    });

    test('onLoad 后调用 childSchedule.getMonthList 加载日程', async () => {
      childSchedule.getMonthList.mockResolvedValue(SAMPLE_MONTH);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(childSchedule.getMonthList).toHaveBeenCalled();
    });

    test('加载成功后 cells 包含 dots 字段（按日期合并）', async () => {
      childSchedule.getMonthList.mockResolvedValue(SAMPLE_MONTH);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      const aug01 = ctx.data.cells.find(c => c.date === '2026-08-01');
      expect(aug01).toBeDefined();
      expect(aug01.dots).toHaveLength(1);
      expect(aug01.dots[0].typeClass).toBe('routine');
      // 8/5 有 2 个点
      const aug05 = ctx.data.cells.find(c => c.date === '2026-08-05');
      expect(aug05.dots).toHaveLength(2);
    });

    test('无日程的日期 dots 为空数组', async () => {
      childSchedule.getMonthList.mockResolvedValue(SAMPLE_MONTH);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      const aug10 = ctx.data.cells.find(c => c.date === '2026-08-10');
      expect(aug10.dots).toEqual([]);
    });
  });

  describe('日期点击交互', () => {
    test('点击当月日期跳转 child-today（带 date 参数）', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onDayTap({ currentTarget: { dataset: { date: '2026-08-15', current: '1' } } });
      expect(wx.redirectTo).toHaveBeenCalledWith({
        url: '/pages/child-today/index?date=2026-08-15'
      });
    });

    test('点击非当月日期（current=0）不跳转（避免跳转到无日程的占位格）', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onDayTap({ currentTarget: { dataset: { date: '2026-07-30', current: '0' } } });
      expect(wx.redirectTo).not.toHaveBeenCalled();
    });
  });

  describe('错误态', () => {
    test('加载失败时 error=true', async () => {
      childSchedule.getMonthList.mockRejectedValue({ message: '网络异常' });
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.error).toBe(true);
    });

    // M5 回归保护：列表加载失败时 MUST 让 <view wx:elif="{{error}}"> 错误块渲染
    // （带重试按钮），错误消息固定为 "网络连接失败，请检查网络设置"
    // MUST NOT 用 wx.showToast 抢占错误块渲染
    test('M5 回归：列表加载失败不调 wx.showToast，错误块自行渲染', async () => {
      childSchedule.getMonthList.mockRejectedValue({ message: '网络异常' });
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(wx.showToast).not.toHaveBeenCalled();
      expect(ctx.data.error).toBe(true);
    });

    test('M5 回归：WXML 错误块显示固定文案"网络连接失败，请检查网络设置"', () => {
      const fs = require('fs');
      const path = require('path');
      const wxml = fs.readFileSync(
        path.resolve(__dirname, '../../pages/child-month/index.wxml'),
        'utf8'
      );
      expect(wxml).toContain('网络连接失败，请检查网络设置');
    });
  });

  describe('data-id 契约（文本级）', () => {
    test('WXML 包含必需 data-id', () => {
      const fs = require('fs');
      const path = require('path');
      const wxml = fs.readFileSync(
        path.resolve(__dirname, '../../pages/child-month/index.wxml'),
        'utf8'
      );
      [
        'child-month-loading',
        'child-month-error',
        'child-month-grid',
        'child-month-retry-btn',
        'child-month-nav-today',
        'child-month-nav-week',
        'child-month-nav-month',
        'child-month-nav-mine'
      ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
      // 动态日期格
      expect(wxml).toContain('data-id="child-month-day-{{cell.date}}"');
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

    test('onSwitchToMine 跳转到 child-mine 页面', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onSwitchToMine();
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/child-mine/index' });
    });
  });
});
