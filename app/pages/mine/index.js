// pages/mine/index.js
const app = getApp();

Page({
  data: {
    userRole: 'parent',
    nickname: '',
    avatarUrl: ''
  },

  onLoad() {
    this.setData({
      userRole: app.getUserRole() || 'parent',
      nickname: '用户'
    });
  },

  onSettings() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.reLaunch({ url: '/pages/privacy-prompt/index' });
        }
      }
    });
  }
});
