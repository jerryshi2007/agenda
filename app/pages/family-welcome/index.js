// pages/family-welcome/index.js
// 首次引导页 —— 用户无家庭时显示，提供"创建家庭"/"加入家庭"按钮
// 有家庭时自动跳转到日历首页

const familyService = require('../../services/family');

Page({
  data: {
    loading: true,
    error: false,
    hasFamily: false
  },

  onLoad() {
    this._loadFamilies();
  },

  onShow() {
    // 从创建/加入页成功返回时重新拉取（可能已建立家庭）
    if (!this.data.loading) {
      this._loadFamilies();
    }
  },

  _loadFamilies() {
    this.setData({ loading: true, error: false });
    familyService.getMyFamilies().then((res) => {
      const families = (res && res.families) || [];
      if (families.length > 0) {
        this.setData({ loading: false, hasFamily: true });
        wx.switchTab({ url: '/pages/index/index' });
        return;
      }
      this.setData({ loading: false, error: false, hasFamily: false });
    }).catch(() => {
      this.setData({ loading: false, error: true });
    });
  },

  onCreateFamily() {
    wx.navigateTo({ url: '/pages/family-create/index' });
  },

  onJoinFamily() {
    wx.navigateTo({ url: '/pages/family-join/index' });
  },

  onRetry() {
    this._loadFamilies();
  }
});
