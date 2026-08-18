// pages/mine/index.js
// 「我的」页面 —— 头像区 + 家庭信息 + 操作入口
// 并发加载资料与家庭，部分失败时降级展示（头像用缓存、家庭区错误占位）

const authService = require('../../services/auth');
const STORAGE_KEYS = require('../../utils/storage-keys');
const app = getApp();

Page({
  data: {
    loading: true,
    profile: null,        // { userId, nickname, avatarUrl, createdAt }
    families: [],         // FamilyInfo[] { familyId, familyName, role, memberCount }
    currentFamily: null,
    familiesError: false
  },

  onShow() {
    // 未同意隐私政策前不拉取资料/家庭（避免 401 → wx.login 触发违规）
    if (app && app.globalData && app.globalData.pendingPrivacyConsent) {
      return;
    }
    this._loadData();
  },

  _loadData() {
    this.setData({ loading: true, familiesError: false });

    Promise.all([
      authService.getProfile().catch(() => null),
      authService.getMyFamilies().catch(() => null)
    ]).then(([profile, familiesRes]) => {
      const profileData = profile || this._cachedProfile();
      const families = (familiesRes && familiesRes.families) || [];
      const currentFamily = families.length > 0 ? families[0] : null;

      if (profile) {
        wx.setStorageSync(STORAGE_KEYS.USER_PROFILE_CACHE, profile);
      }
      if (familiesRes) {
        wx.setStorageSync(STORAGE_KEYS.FAMILIES_CACHE, familiesRes);
      }

      this.setData({
        loading: false,
        profile: profileData,
        families: families,
        currentFamily: currentFamily,
        familiesError: !familiesRes
      });
    });
  },

  _cachedProfile() {
    const cached = wx.getStorageSync(STORAGE_KEYS.USER_PROFILE_CACHE);
    return cached || { nickname: '用户', avatarUrl: '' };
  },

  onAvatarTap() {
    wx.navigateTo({ url: '/pages/profile-edit/index' });
  },

  onFamilyTap(e) {
    const familyId = e.currentTarget.dataset.familyId;
    wx.navigateTo({ url: '/pages/family-members/index?familyId=' + familyId });
  },

  onSwitchFamily() {
    wx.navigateTo({ url: '/pages/family-switch/index' });
  },

  onCreateFamily() {
    wx.navigateTo({ url: '/pages/family-create/index' });
  },

  onJoinFamily() {
    wx.navigateTo({ url: '/pages/family-join/index' });
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  }
});
