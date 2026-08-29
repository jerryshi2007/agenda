// pages/child-today/index.js
// 孩子今日只读视图（小学模式基准视图）—— onLoad 读取 displayMode，加载今日列表，
// 顶部展示"已完成 X/Y"进度，列表项=类型图标+名称+时间+打卡按钮+状态图标

const childSchedule = require('../../services/child-schedule');
const checkinService = require('../../services/checkin');
const { DisplayMode } = require('../../contracts/family');
const app = getApp();

// 日程类型 → 中文标签（前端展示用，与 family.js 的 DisplayModeLabels 一致的展示风格）
const TYPE_LABELS = {
  AfterSchoolActivity: '课后活动',
  DailyRoutine: '日常作息',
  HomeworkTask: '作业任务'
};

// 日程类型 → CSS 颜色类名（与 schedule-card 组件对齐）
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
    isEmpty: false,
    items: [],
    completedCount: 0,
    totalCount: 0,
    completionPercentage: 0,
    progressText: '已完成 0/0'
  },

  onLoad() {
    const displayMode = (app && app.globalData && app.globalData.displayMode) || DisplayMode.Primary;
    this.setData({ displayMode });
    this._loadToday();
  },

  onShow() {
    // 页面切回时刷新（处理 tabBar 切换/打卡后状态同步）
    this._loadToday();
  },

  onPullDownRefresh() {
    this._loadToday().then(() => wx.stopPullDownRefresh());
  },

  /**
   * 加载今日日程列表（含完成统计）
   */
  _loadToday() {
    this.setData({ loading: true, error: false });
    return childSchedule.getTodayList().then((res) => {
      const items = (res && res.items) || [];
      const completedCount = (res && res.completedCount) || 0;
      const totalCount = (res && res.totalCount) || 0;
      const completionPercentage = (res && res.completionPercentage) || 0;

      // 列表项计算属性：typeLabel / typeClass 注入（避免 WXML 内三元表达式过长）
      const enrichedItems = items.map((item) => Object.assign({}, item, {
        typeLabel: TYPE_LABELS[item.scheduleType] || '',
        typeClass: TYPE_CLASS_MAP[item.scheduleType] || 'activity'
      }));

      this.setData({
        loading: false,
        error: false,
        items: enrichedItems,
        completedCount,
        totalCount,
        completionPercentage,
        isEmpty: enrichedItems.length === 0,
        progressText: `已完成 ${completedCount}/${totalCount}`
      });
    }).catch(() => {
      // M5：错误块由 <view wx:elif="{{error}}"> 自行渲染（含重试按钮），不再用 wx.showToast 抢占
      this.setData({ loading: false, error: true, isEmpty: false });
    });
  },

  /**
   * 点击打卡/撤销按钮 —— 已在 WXML 中按 status 分发（incomplete → checkin；completed → undo）
   */
  onCheckinTap(e) {
    const { scheduleId, instanceDate, status } = e.currentTarget.dataset;
    const promise = status === 'completed'
      ? checkinService.undo(scheduleId, instanceDate)
      : checkinService.checkin(scheduleId, instanceDate);

    return promise.then(() => {
      this._loadToday();
    }).catch((err) => {
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
    });
  },

  onRetry() {
    this._loadToday();
  },

  onSwitchToWeek() {
    wx.redirectTo({ url: '/pages/child-week/index' });
  },

  onSwitchToMonth() {
    wx.redirectTo({ url: '/pages/child-month/index' });
  },

  onSwitchToMine() {
    wx.redirectTo({ url: '/pages/child-mine/index' });
  }
});
