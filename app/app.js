// app.js
// 小程序主入口 —— 全局状态管理 + 生命周期 + 隐私检查 + 静默登录串联

const STORAGE_KEYS = require('./utils/storage-keys');
const privacy = require('./utils/privacy');
const crypto = require('./utils/crypto');
const authService = require('./services/auth');
const { ErrorCodes } = require('./contracts/auth');

App({
  globalData: {
    // 认证模块
    userId: null,
    userProfile: null,
    families: [],
    needsProfileCollection: false,
    pendingPrivacyConsent: false,
    pendingDeletedRecovery: null, // { remainingDays } 注销缓冲剩余天数

    // 日程模块（保留）
    userRole: null,
    currentFamilyId: null,
    calendarState: {
      currentView: 'week',    // 'month' | 'week' | 'day'
      currentDate: null,      // 当前浏览日期
      selectedChildId: null,  // 筛选的孩子 ID
      selectedScheduleTypes: [] // 筛选的日程类型
    },
    familyList: [],
    childList: [],

    // 系统信息
    systemInfo: null,
    statusBarHeight: 0
  },

  onLaunch(options) {
    const systemInfo = wx.getSystemInfoSync();
    this.globalData.systemInfo = systemInfo;
    this.globalData.statusBarHeight = systemInfo.statusBarHeight;

    // 恢复日历状态
    this._restoreCalendarState();

    // 隐私检查 -> 登录
    this._bootstrapLogin();
  },

  onShow() {
    this._restoreCalendarState();
  },

  onHide() {
    this._persistCalendarState();
  },

  /**
   * 隐私政策检查：未同意/版本变更则标记待弹窗，已同意则静默登录
   */
  _bootstrapLogin() {
    const { consented, needsReshow } = privacy.checkConsent();
    if (needsReshow) {
      this.globalData.pendingPrivacyConsent = true;
      return Promise.resolve();
    }
    // 静默登录完成后通知当前页刷新认证弹窗（覆盖「老用户昵称仍为默认值」的
    // needsProfileCollection 场景：登录是异步的，onShow 早于登录完成触发）
    return this.doLogin().then(() => this._notifyCurrentPage());
  },

  /**
   * 隐私弹窗「同意并继续」：记录同意 -> 静默登录
   */
  onPrivacyAgree() {
    privacy.recordConsent();
    this.globalData.pendingPrivacyConsent = false;
    return this.doLogin();
  },

  /**
   * 隐私弹窗「不同意」：跳转静态提示页
   */
  onPrivacyDecline() {
    wx.reLaunch({ url: '/pages/privacy-prompt/index' });
  },

  /**
   * 静默登录：wx.login -> auth.login(code) -> 存 JWT -> 更新全局态
   * code 已使用（CODE_INVALID）时重新 wx.login 最多 1 次
   */
  doLogin(retried = false) {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (loginRes) => {
          if (!loginRes.code) {
            wx.showToast({ title: '登录失败，请检查网络后重试', icon: 'none' });
            reject({ error: 'LOGIN_FAILED' });
            return;
          }
          authService.login(loginRes.code).then((res) => {
            this.setLoginData(res.jwt, res.userId);

            if (res.isDeleted) {
              this.globalData.pendingDeletedRecovery = { remainingDays: res.remainingDays || 0 };
              wx.reLaunch({ url: '/pages/deleted-recovery/index' });
            } else {
              this.globalData.needsProfileCollection = !!res.needsProfileCollection;
            }
            resolve(res);
          }).catch((err) => {
            if (err && err.error === ErrorCodes.CODE_INVALID && !retried) {
              this.doLogin(true).then(resolve).catch(reject);
              return;
            }
            wx.showToast({ title: (err && err.message) || '登录失败，请重试', icon: 'none' });
            reject(err);
          });
        },
        fail: () => {
          wx.showToast({ title: '登录失败，请检查网络后重试', icon: 'none' });
          reject({ error: 'LOGIN_FAILED' });
        }
      });
    });
  },

  /**
   * 设置登录态（供 doLogin 与 T19 续期流程调用）
   */
  setLoginData(jwt, userId) {
    wx.setStorageSync(STORAGE_KEYS.AUTH_TOKEN, crypto.encrypt(jwt));
    this.globalData.userId = userId;
  },

  /**
   * 登录态就绪后通知当前页面刷新认证弹窗（隐私弹窗 / 资料收集）
   * 仅 index 页实现了 _checkAuthOverlays，其余页面安全跳过
   */
  _notifyCurrentPage() {
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];
    if (current && typeof current._checkAuthOverlays === 'function') {
      current._checkAuthOverlays();
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

  getUserRole() {
    return this.globalData.userRole;
  },

  isParent() {
    return this.globalData.userRole === 'parent';
  },

  getCurrentFamilyId() {
    return this.globalData.currentFamilyId;
  }
});
