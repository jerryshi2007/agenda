// app.js
// 小程序主入口 —— 全局状态管理 + 生命周期

const STORAGE_KEYS = require('./utils/storage-keys');

App({
  globalData: {
    // 用户信息
    userId: null,
    userRole: null, // 'parent' | 'child'
    currentFamilyId: null,

    // 日历状态
    calendarState: {
      currentView: 'week',    // 'month' | 'week' | 'day'
      currentDate: null,      // 当前浏览日期
      selectedChildId: null,  // 筛选的孩子 ID
      selectedScheduleTypes: [] // 筛选的日程类型
    },

    // 家庭数据
    familyList: [],
    childList: [],

    // 系统信息
    systemInfo: null,
    statusBarHeight: 0
  },

  onLaunch(options) {
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    this.globalData.systemInfo = systemInfo;
    this.globalData.statusBarHeight = systemInfo.statusBarHeight;

    // 恢复用户登录态
    this._restoreSession();

    // 恢复日历状态
    this._restoreCalendarState();

    // 检查隐私政策
    this._checkPrivacyConsent();
  },

  onShow(options) {
    // 从后台恢复日历状态
    this._restoreCalendarState();
  },

  onHide() {
    // 持久化日历状态
    this._persistCalendarState();
  },

  /**
   * 恢复用户会话
   */
  _restoreSession() {
    const token = wx.getStorageSync(STORAGE_KEYS.TOKEN);
    if (token) {
      const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
      const role = wx.getStorageSync(STORAGE_KEYS.USER_ROLE);
      const familyId = wx.getStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID);
      if (userInfo) {
        this.globalData.userId = userInfo.userId;
        this.globalData.userRole = role || userInfo.role || 'parent';
        this.globalData.currentFamilyId = familyId;
      }
    }
  },

  /**
   * 恢复日历状态
   */
  _restoreCalendarState() {
    const view = wx.getStorageSync(STORAGE_KEYS.CALENDAR_VIEW);
    const date = wx.getStorageSync(STORAGE_KEYS.CALENDAR_DATE);
    const childId = wx.getStorageSync(STORAGE_KEYS.CALENDAR_FILTER_CHILD);
    const types = wx.getStorageSync(STORAGE_KEYS.CALENDAR_FILTER_TYPES);

    if (view) this.globalData.calendarState.currentView = view;
    if (date) this.globalData.calendarState.currentDate = date;
    if (childId) this.globalData.calendarState.selectedChildId = childId;
    if (types) this.globalData.calendarState.selectedScheduleTypes = types;

    if (!this.globalData.calendarState.currentDate) {
      this.globalData.calendarState.currentDate = this._todayStr();
    }
  },

  /**
   * 持久化日历状态
   */
  _persistCalendarState() {
    const state = this.globalData.calendarState;
    wx.setStorageSync(STORAGE_KEYS.CALENDAR_VIEW, state.currentView);
    wx.setStorageSync(STORAGE_KEYS.CALENDAR_DATE, state.currentDate);
    wx.setStorageSync(STORAGE_KEYS.CALENDAR_FILTER_CHILD, state.selectedChildId);
    wx.setStorageSync(STORAGE_KEYS.CALENDAR_FILTER_TYPES, state.selectedScheduleTypes);
  },

  /**
   * 隐私政策检查
   */
  _checkPrivacyConsent() {
    const consent = wx.getStorageSync(STORAGE_KEYS.PRIVACY_CONSENT);
    if (!consent || !consent.agreed) {
      // 跳转隐私政策页
      wx.reLaunch({ url: '/pages/privacy-prompt/index' });
    }
  },

  /**
   * 获取今日日期字符串
   */
  _todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /**
   * 更新日历状态并持久化
   */
  updateCalendarState(partial) {
    Object.assign(this.globalData.calendarState, partial);
    this._persistCalendarState();
  },

  /**
   * 获取当前用户角色
   */
  getUserRole() {
    return this.globalData.userRole;
  },

  /**
   * 是否为家长
   */
  isParent() {
    return this.globalData.userRole === 'parent';
  },

  /**
   * 获取家庭 ID
   */
  getCurrentFamilyId() {
    return this.globalData.currentFamilyId;
  }
});
