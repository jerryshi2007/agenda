// pages/child-week/index.js
// 孩子周只读视图（小学模式）—— 7 天日历，每天显示日程类型色点
// 点击日期跳转对应日期的 child-today 视图

const childSchedule = require('../../services/child-schedule');
const dateUtils = require('../../utils/date-utils');
const { DisplayMode } = require('../../contracts/family');
const app = getApp();

// 日程类型 → CSS 颜色类名
const TYPE_CLASS_MAP = {
  AfterSchoolActivity: 'activity',
  DailyRoutine: 'routine',
  HomeworkTask: 'homework'
};

Page({
  data: {
    displayMode: DisplayMode.Primary,
    loading: true,
    error: false,
    weekDays: []   // 7 天，每天含 { date, day, dayOfWeek, dayOfWeekName, isToday, isWeekend, dots, scheduleCount }
  },

  onLoad() {
    const displayMode = (app && app.globalData && app.globalData.displayMode) || DisplayMode.Primary;
    // 7 天骨架同步生成（保证日历立即可见）；dots 由 API 加载后注入
    const weekDays = dateUtils.generateWeekDays(new Date());
    this.setData({ displayMode, weekDays });
    this._loadWeek();
  },

  onShow() {
    this._loadWeek();
  },

  onPullDownRefresh() {
    this._loadWeek().then(() => wx.stopPullDownRefresh());
  },

  /**
   * 加载本周日程概览
   */
  _loadWeek() {
    this.setData({ loading: true, error: false });
    return childSchedule.getWeekList().then((res) => {
      const dates = (res && res.dates) || [];
      // 构建 7 天骨架（基于当前日期所在周）
      const weekDays = dateUtils.generateWeekDays(new Date());
      // 将后端返回的 dots 注入到对应日期
      const dateMap = {};
      dates.forEach(d => { dateMap[d.date] = d; });
      const enriched = weekDays.map(day => {
        const info = dateMap[day.date] || { dots: [], scheduleCount: 0 };
        const dots = (info.dots || []).map(dot => Object.assign({}, dot, {
          typeClass: TYPE_CLASS_MAP[dot.scheduleType] || 'activity'
        }));
        return Object.assign({}, day, { dots, scheduleCount: info.scheduleCount || 0 });
      });
      this.setData({ loading: false, error: false, weekDays: enriched });
    }).catch(() => {
      // M5：错误块由 <view wx:elif="{{error}}"> 自行渲染（含重试按钮），不再用 wx.showToast 抢占
      this.setData({ loading: false, error: true });
    });
  },

  /**
   * 点击日期 → 跳转到对应日期的 child-today 视图
   */
  onDayTap(e) {
    const { date } = e.currentTarget.dataset;
    wx.redirectTo({ url: `/pages/child-today/index?date=${date}` });
  },

  onRetry() {
    this._loadWeek();
  },

  onSwitchToToday() {
    wx.redirectTo({ url: '/pages/child-today/index' });
  },

  onSwitchToMonth() {
    wx.redirectTo({ url: '/pages/child-month/index' });
  },

  onSwitchToMine() {
    wx.redirectTo({ url: '/pages/child-mine/index' });
  }
});
