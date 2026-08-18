// pages/family-restore/index.js
// 解散恢复页 —— 显示已解散家庭的倒计时与恢复/不恢复选项
// query: familyId, familyName, dissolveExpiresAt（ISO 字符串，可选）

const familyService = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ErrorMessages, FamilyStatus } = require('../../contracts/family');

function _calcDaysLeft(expiresAt) {
  if (!expiresAt) return 0;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return 0;
  const ms = t - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

Page({
  data: {
    familyId: '',
    familyName: '',
    dissolveExpiresAt: '',
    daysLeft: 0,
    restoring: false,
    success: false,
    errorMessage: ''
  },

  onLoad(query) {
    const q = query || {};
    const daysLeft = _calcDaysLeft(q.dissolveExpiresAt);
    this.setData({
      familyId: q.familyId || '',
      familyName: q.familyName || '',
      dissolveExpiresAt: q.dissolveExpiresAt || '',
      daysLeft
    });
  },

  onRestore() {
    if (this.data.restoring) return Promise.resolve();
    if (!this.data.familyId) {
      this.setData({ errorMessage: '缺少家庭标识' });
      return Promise.resolve();
    }
    this.setData({ restoring: true, errorMessage: '' });
    return familyService.restoreFamily(this.data.familyId).then((res) => {
      this.setData({ restoring: false, success: true });
      setTimeout(() => {
        wx.setStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID, this.data.familyId);
        wx.reLaunch({ url: '/pages/index/index' });
      }, 3000);
      return res;
    }).catch((err) => {
      this.setData({
        restoring: false,
        errorMessage: (err && err.message) || ErrorMessages.DISSOLVED_EXPIRED
      });
    });
  },

  onSkip() {
    wx.removeStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID);
    wx.reLaunch({ url: '/pages/family-welcome/index' });
  }
});
