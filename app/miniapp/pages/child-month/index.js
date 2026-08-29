// pages/child-month/index.js
// 孩子月只读视图（小学模式）—— 月日历 + 有日程的日期显示色点
// 点击日期跳转对应日期的 child-today 视图（仅当月日期）

const childSchedule = require('../../services/child-schedule');
const dateUtils = require('../../utils/date-utils');
const { DisplayMode } = require('../../contracts/family');
const app = getApp();

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
    cells: [],    // 42 格日历，每格含 { date, day, isCurrentMonth, isToday, isWeekend, dots }
    navTitle: ''  // "YYYY年 M月"
  },

  onLoad() {
    const displayMode = (app && app.globalData && app.globalData.displayMode) || DisplayMode.Primary;
    // 月份骨架同步生成（日历立即可见）；dots 由 API 加载后注入
    const today = new Date();
    const cells = dateUtils.generateMonthCells(today.getFullYear(), today.getMonth());
    this.setData({
      displayMode,
      cells,
      navTitle: dateUtils.formatMonthTitle(today)
    });
    this._loadMonth();
  },

  onShow() {
    this._loadMonth();
  },

  onPullDownRefresh() {
    this._loadMonth().then(() => wx.stopPullDownRefresh());
  },

  /**
   * 加载本月日程概览
   */
  _loadMonth() {
    this.setData({ loading: true, error: false });
    return childSchedule.getMonthList().then((res) => {
      const dates = (res && res.dates) || [];
      const dateMap = {};
      dates.forEach(d => { dateMap[d.date] = d; });
      const enriched = this.data.cells.map(cell => {
        const info = dateMap[cell.date] || { dots: [] };
        const dots = (info.dots || []).map(dot => Object.assign({}, dot, {
          typeClass: TYPE_CLASS_MAP[dot.scheduleType] || 'activity'
        }));
        return Object.assign({}, cell, { dots });
      });
      this.setData({ loading: false, error: false, cells: enriched });
    }).catch(() => {
      // M5：错误块由 <view wx:elif="{{error}}"> 自行渲染（含重试按钮），不再用 wx.showToast 抢占
      this.setData({ loading: false, error: true });
    });
  },

  /**
   * 点击日期 → 跳转到对应日期的 child-today 视图
   * 仅当月日期可跳转（current=1），上/下月占位格无意义
   */
  onDayTap(e) {
    const { date, current } = e.currentTarget.dataset;
    if (current === '0' || current === 'false') return;
    wx.redirectTo({ url: `/pages/child-today/index?date=${date}` });
  },

  onRetry() {
    this._loadMonth();
  },

  onSwitchToToday() {
    wx.redirectTo({ url: '/pages/child-today/index' });
  },

  onSwitchToWeek() {
    wx.redirectTo({ url: '/pages/child-week/index' });
  },

  onSwitchToMine() {
    wx.redirectTo({ url: '/pages/child-mine/index' });
  }
});
