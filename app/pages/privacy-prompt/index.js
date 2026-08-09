// pages/privacy-prompt/index.js
const STORAGE_KEYS = require('../../utils/storage-keys');

Page({
  data: {
    agreed: false
  },

  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  onConfirm() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意隐私政策', icon: 'none' });
      return;
    }
    wx.setStorageSync(STORAGE_KEYS.PRIVACY_CONSENT, { agreed: true, version: 1, time: Date.now() });
    wx.reLaunch({ url: '/pages/index/index' });
  },

  onReject() {
    this.setData({ rejected: true });
  }
});
