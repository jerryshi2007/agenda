// pages/child-mine/index.js
// 孩子我的页面（小学模式基准视图）—— 仅展示孩子姓名 + 本周完成率进度条
// 不显示家长端管理功能（切换家庭、设置、注销等）

const childSchedule = require('../../services/child-schedule');
const authService = require('../../services/auth');
const { DisplayMode } = require('../../contracts/family');
const app = getApp();

Page({
  data: {
    displayMode: DisplayMode.Primary,
    loading: true,
    error: false,

    childName: '',
    weeklyLoading: true,
    weeklyPercentage: 0,
    weeklyCompleted: 0,
    weeklyTotal: 0,
    weeklyText: '已完成 0/0'
  },

  onLoad() {
    const displayMode = (app && app.globalData && app.globalData.displayMode) || DisplayMode.Primary;
    this.setData({ displayMode });
    this._loadData();
  },

  onShow() {
    // 未同意隐私政策前不加载任何数据
    if (app && app.globalData && app.globalData.pendingPrivacyConsent) return;
    this._loadData();
  },

  _loadData() {
    this.setData({ loading: true, error: false });

    // 并发加载资料与本周完成率；任一失败不阻断另一项
    Promise.all([
      authService.getProfile().catch(() => null),
      childSchedule.getWeeklyCompletion().catch(() => null)
    ]).then(([profile, weekly]) => {
      // 孩子姓名：取自 profile.nickname（auth.getProfile 真实契约：仅 { userId, nickname, avatarUrl?, createdAt }，无 childName 字段）
      const childName = (profile && profile.nickname) || '';
      const weeklyData = weekly || { percentage: 0, completed: 0, total: 0 };
      const weeklyCompleted = weeklyData.completed || 0;
      const weeklyTotal = weeklyData.total || 0;
      const weeklyPercentage = weeklyData.percentage || 0;

      this.setData({
        loading: false,
        childName,
        weeklyLoading: false,
        weeklyCompleted,
        weeklyTotal,
        weeklyPercentage,
        weeklyText: `已完成 ${weeklyCompleted}/${weeklyTotal}`
      });
    });
  },

  onSwitchToToday() {
    wx.redirectTo({ url: '/pages/child-today/index' });
  },

  onSwitchToWeek() {
    wx.redirectTo({ url: '/pages/child-week/index' });
  },

  onSwitchToMonth() {
    wx.redirectTo({ url: '/pages/child-month/index' });
  }
});
