// pages/settings/index.js
// 设置页 —— 注销账户入口 + 注销流程（条件检查 → 说明 → 二次确认 → API）

const authService = require('../../services/auth');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ErrorMessages } = require('../../contracts/auth');
const app = getApp();

Page({
  data: {
    showDeleteDialog: false,  // 二次确认弹窗
    deleting: false
  },

  onDeleteAccount() {
    wx.showLoading({ title: '检查中...' });
    authService.getDeletionStatus().then((status) => {
      wx.hideLoading();
      if (status.isDeleted) {
        app.globalData.pendingDeletedRecovery = { remainingDays: status.remainingDays || 0 };
        wx.reLaunch({ url: '/pages/deleted-recovery/index' });
        return;
      }
      if (!status.canDelete) {
        this._showFamilyBlocked();
        return;
      }
      this._showDeleteExplanation();
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    });
  },

  _showFamilyBlocked() {
    wx.showModal({
      title: '无法注销',
      content: ErrorMessages.FAMILY_STILL_ACTIVE,
      confirmText: '前往家庭管理',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '家庭管理开发中', icon: 'none' });
        }
      }
    });
  },

  _showDeleteExplanation() {
    wx.showModal({
      title: '注销账户',
      content: '注销后数据保留 30 天，期间可随时登录恢复；30 天后将永久删除。确定要注销吗？',
      confirmText: '继续',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.setData({ showDeleteDialog: true });
        }
      }
    });
  },

  onDeleteCancel() {
    this.setData({ showDeleteDialog: false });
  },

  onDeleteConfirm() {
    if (this.data.deleting) return;
    this.setData({ deleting: true });

    authService.deleteAccount().then(() => {
      wx.removeStorageSync(STORAGE_KEYS.AUTH_TOKEN);
      wx.removeStorageSync(STORAGE_KEYS.USER_PROFILE_CACHE);
      wx.removeStorageSync(STORAGE_KEYS.FAMILIES_CACHE);
      app.globalData.userId = null;
      this.setData({ showDeleteDialog: false, deleting: false });
      wx.exitMiniProgram();
    }).catch(() => {
      this.setData({ deleting: false });
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    });
  },

  onAbout() {
    wx.showToast({ title: '关于功能开发中', icon: 'none' });
  },

  onFeedback() {
    wx.showToast({ title: '意见反馈开发中', icon: 'none' });
  }
});
