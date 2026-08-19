// app/__tests__/pages/child-week.test.js
// child-week 页面测试：displayMode 读取、7 天日历渲染、点击日期跳转到今日视图

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
  // 默认无日程
  childSchedule.getWeekList.mockResolvedValue({ dates: [] });
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(appData = {}, query = {}) {
  const { type, config } = loadPage('pages/child-week/index.js', {
    app: { globalData: appData },
    query
  });
  expect(type).toBe('page');
  return createPageContext(config);
}

// 测试当前周（以测试执行时的系统日期为准）
const _todayWeek = dateUtils.generateWeekDays(new Date());
const _weekDates = _todayWeek.map(d => d.date);

const SAMPLE_WEEK = {
  dates: [
    { date: _weekDates[0], dots: [{ scheduleType: 'DailyRoutine' }, { scheduleType: 'AfterSchoolActivity' }], scheduleCount: 2 },
    { date: _weekDates[1], dots: [{ scheduleType: 'DailyRoutine' }], scheduleCount: 1 },
    { date: _weekDates[2], dots: [], scheduleCount: 0 },
    { date: _weekDates[3], dots: [{ scheduleType: 'HomeworkTask' }], scheduleCount: 1 },
    { date: _weekDates[4], dots: [], scheduleCount: 0 },
    { date: _weekDates[5], dots: [], scheduleCount: 0 },
    { date: _weekDates[6], dots: [], scheduleCount: 0 }
  ]
};

describe('child-week 页面', () => {
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

  describe('7 天日历生成', () => {
    test('weekDays 为 7 天数据（基于当前日期所在周）', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      const days = ctx.data.weekDays;
      expect(days).toHaveLength(7);
      // 每周从周一开始
      expect(days[0].dayOfWeek).toBe(1);
      expect(days[6].dayOfWeek).toBe(0);
    });

    test('每一天的 date 字段符合 yyyy-MM-dd 格式', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.data.weekDays.forEach(day => {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    test('onLoad 后调用 childSchedule.getWeekList 加载日程', async () => {
      childSchedule.getWeekList.mockResolvedValue(SAMPLE_WEEK);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(childSchedule.getWeekList).toHaveBeenCalled();
    });
  });

  describe('日程色点注入', () => {
    test('加载成功后 weekDays 包含 dots 字段（按日期合并）', async () => {
      childSchedule.getWeekList.mockResolvedValue(SAMPLE_WEEK);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      // 当前周第一天有 2 个点（routine + activity）
      const firstDay = ctx.data.weekDays.find(d => d.date === _weekDates[0]);
      expect(firstDay).toBeDefined();
      expect(firstDay.dots).toHaveLength(2);
      expect(firstDay.scheduleCount).toBe(2);
      // 第三天无日程
      const emptyDay = ctx.data.weekDays.find(d => d.date === _weekDates[2]);
      expect(emptyDay.dots).toEqual([]);
    });

    test('dots 元素带有 typeClass 字段便于 WXML 类名渲染', async () => {
      childSchedule.getWeekList.mockResolvedValue(SAMPLE_WEEK);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      const firstDay = ctx.data.weekDays.find(d => d.date === _weekDates[0]);
      expect(firstDay.dots[0].typeClass).toBe('routine');
      expect(firstDay.dots[1].typeClass).toBe('activity');
    });
  });

  describe('日期点击交互', () => {
    test('点击日期跳转 child-today 页面（带 date 参数）', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onDayTap({ currentTarget: { dataset: { date: '2026-08-19' } } });
      expect(wx.redirectTo).toHaveBeenCalledWith({
        url: '/pages/child-today/index?date=2026-08-19'
      });
    });
  });

  describe('错误态', () => {
    test('加载失败时 error=true', async () => {
      childSchedule.getWeekList.mockRejectedValue({ message: '网络异常' });
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.error).toBe(true);
    });

    // M5 回归保护：列表加载失败时 MUST 让 <view wx:elif="{{error}}"> 错误块渲染
    // （带重试按钮），错误消息固定为 "网络连接失败，请检查网络设置"
    // MUST NOT 用 wx.showToast 抢占错误块渲染
    test('M5 回归：列表加载失败不调 wx.showToast，错误块自行渲染', async () => {
      childSchedule.getWeekList.mockRejectedValue({ message: '网络异常' });
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
        path.resolve(__dirname, '../../pages/child-week/index.wxml'),
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
        path.resolve(__dirname, '../../pages/child-week/index.wxml'),
        'utf8'
      );
      [
        'child-week-loading',
        'child-week-error',
        'child-week-grid',
        'child-week-retry-btn',
        'child-week-nav-today',
        'child-week-nav-week',
        'child-week-nav-month',
        'child-week-nav-mine'
      ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
      // 动态日期格
      expect(wxml).toContain('data-id="child-week-day-{{day.date}}"');
    });
  });

  describe('视图切换', () => {
    test('onSwitchToToday 跳转到 child-today 页面', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onSwitchToToday();
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/child-today/index' });
    });

    test('onSwitchToMonth 跳转到 child-month 页面', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onSwitchToMonth();
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/child-month/index' });
    });

    test('onSwitchToMine 跳转到 child-mine 页面', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onSwitchToMine();
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/child-mine/index' });
    });
  });
});
