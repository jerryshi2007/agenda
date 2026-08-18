// app/__tests__/pages/child-today.test.js
// child-today 页面测试：displayMode 读取、今日列表加载、完成进度渲染、打卡/撤销交互

const mockChildSchedule = require('../helpers/child-schedule-mock');
const mockCheckin = require('../helpers/checkin-mock');
jest.mock('../../services/child-schedule', () => mockChildSchedule);
jest.mock('../../services/checkin', () => mockCheckin);

const childSchedule = require('../../services/child-schedule');
const checkinService = require('../../services/checkin');
const { DisplayMode } = require('../../contracts/family');
const { CheckinStatus } = require('../../contracts/checkin');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  // 默认 child-schedule 服务空响应
  childSchedule.getTodayList.mockResolvedValue({
    items: [],
    completedCount: 0,
    totalCount: 0,
    completionPercentage: 0
  });
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(appData = {}) {
  const { type, config } = loadPage('pages/child-today/index.js', {
    app: { globalData: appData }
  });
  expect(type).toBe('page');
  return createPageContext(config);
}

const SAMPLE_TODAY = {
  items: [
    {
      scheduleId: 's1',
      name: '练琴',
      scheduleType: 'DailyRoutine',
      startTime: '16:00',
      endTime: '17:00',
      instanceDate: '2026-08-18',
      status: 'incomplete'
    },
    {
      scheduleId: 's2',
      name: '钢琴课',
      scheduleType: 'AfterSchoolActivity',
      startTime: '17:30',
      endTime: '18:30',
      instanceDate: '2026-08-18',
      status: 'completed'
    }
  ],
  completedCount: 1,
  totalCount: 2,
  completionPercentage: 50
};

describe('child-today 页面', () => {
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

  describe('今日日程加载', () => {
    test('onLoad 触发后调用 childSchedule.getTodayList', async () => {
      childSchedule.getTodayList.mockResolvedValue(SAMPLE_TODAY);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(childSchedule.getTodayList).toHaveBeenCalled();
    });

    test('加载成功后 items/completedCount/totalCount 写入 data', async () => {
      childSchedule.getTodayList.mockResolvedValue(SAMPLE_TODAY);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      // items 经过页面 enrichment（含 typeLabel/typeClass）
      expect(ctx.data.items).toHaveLength(2);
      expect(ctx.data.items[0].scheduleId).toBe('s1');
      expect(ctx.data.items[0].typeLabel).toBe('日常作息');
      expect(ctx.data.items[0].typeClass).toBe('routine');
      expect(ctx.data.items[1].typeLabel).toBe('课后活动');
      expect(ctx.data.items[1].typeClass).toBe('activity');
      expect(ctx.data.completedCount).toBe(1);
      expect(ctx.data.totalCount).toBe(2);
      expect(ctx.data.completionPercentage).toBe(50);
      expect(ctx.data.loading).toBe(false);
      expect(ctx.data.error).toBe(false);
    });

    test('加载失败时设置 error=true', async () => {
      childSchedule.getTodayList.mockRejectedValue({ message: '网络异常' });
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.error).toBe(true);
      expect(ctx.data.loading).toBe(false);
    });

    // M5 回归保护：列表加载失败时 MUST 让 <view wx:elif="{{error}}"> 错误块渲染
    // （带重试按钮），错误消息固定为 "网络连接失败，请检查网络设置"
    // MUST NOT 用 wx.showToast 抢占错误块渲染
    test('M5 回归：列表加载失败不调 wx.showToast，错误块自行渲染', async () => {
      childSchedule.getTodayList.mockRejectedValue({ message: '网络异常' });
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(wx.showToast).not.toHaveBeenCalled();
      expect(ctx.data.error).toBe(true);
      expect(ctx.data.loading).toBe(false);
    });

    test('M5 回归：WXML 错误块显示固定文案"网络连接失败，请检查网络设置"', () => {
      const fs = require('fs');
      const path = require('path');
      const wxml = fs.readFileSync(
        path.resolve(__dirname, '../../pages/child-today/index.wxml'),
        'utf8'
      );
      expect(wxml).toContain('网络连接失败，请检查网络设置');
    });
  });

  describe('完成进度计算', () => {
    test('已计算展示文案"已完成 X/Y"（模板渲染用 data 字段）', async () => {
      childSchedule.getTodayList.mockResolvedValue(SAMPLE_TODAY);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      // 模板渲染依赖于 data 中的 progressText 字段
      expect(ctx.data.progressText).toBe('已完成 1/2');
    });

    test('totalCount=0 时进度文案为"已完成 0/0"', async () => {
      childSchedule.getTodayList.mockResolvedValue({
        items: [],
        completedCount: 0,
        totalCount: 0,
        completionPercentage: 0
      });
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.progressText).toBe('已完成 0/0');
    });
  });

  describe('空态', () => {
    test('items 为空数组时 isEmpty=true', async () => {
      childSchedule.getTodayList.mockResolvedValue({
        items: [],
        completedCount: 0,
        totalCount: 0,
        completionPercentage: 0
      });
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.isEmpty).toBe(true);
    });

    test('items 非空时 isEmpty=false', async () => {
      childSchedule.getTodayList.mockResolvedValue(SAMPLE_TODAY);
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();
      expect(ctx.data.isEmpty).toBe(false);
    });
  });

  describe('打卡交互', () => {
    test('点击未完成项的 checkin 按钮：调 checkinService.checkin 并刷新列表', async () => {
      childSchedule.getTodayList.mockResolvedValue(SAMPLE_TODAY);
      checkinService.checkin.mockResolvedValue({ data: { checkinId: 'c1' } });
      childSchedule.getTodayList.mockResolvedValueOnce(SAMPLE_TODAY);
      childSchedule.getTodayList.mockResolvedValueOnce({
        ...SAMPLE_TODAY,
        completedCount: 2,
        completionPercentage: 100
      });

      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();

      await ctx.onCheckinTap({
        currentTarget: {
          dataset: { scheduleId: 's1', instanceDate: '2026-08-18', status: 'incomplete' }
        }
      });

      expect(checkinService.checkin).toHaveBeenCalledWith('s1', '2026-08-18');
      // 刷新后 completedCount 更新
      expect(ctx.data.completedCount).toBe(2);
    });

    test('点击已完成项的撤销：调 checkinService.undo 并刷新列表', async () => {
      childSchedule.getTodayList.mockResolvedValueOnce(SAMPLE_TODAY);
      childSchedule.getTodayList.mockResolvedValueOnce({
        ...SAMPLE_TODAY,
        completedCount: 0,
        completionPercentage: 0
      });
      checkinService.undo.mockResolvedValue({ data: { undone: true } });

      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();

      await ctx.onCheckinTap({
        currentTarget: {
          dataset: { scheduleId: 's2', instanceDate: '2026-08-18', status: 'completed' }
        }
      });

      expect(checkinService.undo).toHaveBeenCalledWith('s2', '2026-08-18');
      expect(ctx.data.completedCount).toBe(0);
    });

    test('打卡失败时显示 wx.showToast', async () => {
      childSchedule.getTodayList.mockResolvedValue(SAMPLE_TODAY);
      checkinService.checkin.mockRejectedValue({ message: '打卡时间窗口已关闭' });

      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      await flush();

      await ctx.onCheckinTap({
        currentTarget: {
          dataset: { scheduleId: 's1', instanceDate: '2026-08-18', status: 'incomplete' }
        }
      });

      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
    });
  });

  describe('data-id 契约（文本级）', () => {
    test('WXML 包含打卡按钮、列表项、进度文案、空态等必需 data-id', () => {
      const fs = require('fs');
      const path = require('path');
      const wxml = fs.readFileSync(
        path.resolve(__dirname, '../../pages/child-today/index.wxml'),
        'utf8'
      );
      [
        'child-today-progress',
        'child-today-list',
        'child-today-empty',
        'child-today-error',
        'child-today-loading',
        'child-today-retry-btn',
        'child-today-nav-today',
        'child-today-nav-week',
        'child-today-nav-month',
        'child-today-nav-mine'
      ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
      // 动态项
      expect(wxml).toContain('data-id="child-today-item-{{item.scheduleId}}"');
      expect(wxml).toContain('data-id="child-today-checkin-btn-{{item.scheduleId}}"');
    });
  });

  describe('视图切换（孩子端 4 视图互跳）', () => {
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

    test('onSwitchToMine 跳转到 child-mine 页面', () => {
      const ctx = setup({ displayMode: DisplayMode.Primary });
      ctx.onLoad();
      ctx.onSwitchToMine();
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/child-mine/index' });
    });
  });
});
