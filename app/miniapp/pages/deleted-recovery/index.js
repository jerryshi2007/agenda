// pages/deleted-recovery/index.js
// 账户已注销恢复页 —— 展示数据保留倒计时，可恢复账户或退出

const authService = require('../../services/auth');
const app = getApp();

Page({
  data: {
    loading: false,
    restoring: false,
    remainingDays: 30,
    expiresDateStr: ''
  },

  onLoad() {
    const recovery = app.globalData.pendingDeletedRecovery;
    const remainingDays = (recovery && recovery.remainingDays) || 30;
    this.setData({
      remainingDays: remainingDays,
      expiresDateStr: this._computeExpiryDate(remainingDays)
    });
  },

  _computeExpiryDate(remainingDays) {
    const d = new Date();
    d.setDate(d.getDate() + remainingDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  onRestore() {
    if (this.data.restoring) return;
    this.setData({ restoring: true });

    authService.recoverAccount().then((res) => {
      app.setLoginData(res.jwt, res.userId);
      app.globalData.pendingDeletedRecovery = null;
      app.globalData.needsProfileCollection = false;
      wx.switchTab({ url: '/pages/index/index' });
      wx.showToast({ title: '账户已恢复', icon: 'success' });
      this.setData({ restoring: false });
    }).catch((err) => {
      this.setData({ restoring: false });
      wx.showToast({ title: (err && err.message) || '恢复失败，请重试', icon: 'none' });
    });
  },

  onDismiss() {
    wx.exitMiniProgram();
  }
});
