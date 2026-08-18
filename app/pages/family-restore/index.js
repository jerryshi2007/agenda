// pages/family-restore/index.js
// 解散恢复页 —— 显示已解散家庭的倒计时与恢复/不恢复选项
// query: familyId, familyName, dissolveExpiresAt（ISO 字符串，可选）
// TC-FMS-04：query.familyId 指向 Normal（未解散）家庭时给出错误占位
// 检测方式：getMyFamilies 不返回已解散家庭（spec TC-FSW-02），因此 familyId
// 出现在列表中即说明该家庭当前状态为 Normal（未解散），无需恢复

const familyService = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ErrorMessages } = require('../../contracts/family');

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
    errorMessage: '',
    invalidFamily: false
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
    // TC-FMS-04：通过 getMyFamilies 校验目标家庭是否仍在用户列表中
    // 已解散家庭不会出现在 getMyFamilies 响应中；若出现则说明仍是 Normal
    if (q.familyId) {
      this._checkFamilyStatus();
    }
  },

  _checkFamilyStatus() {
    familyService.getMyFamilies().then((res) => {
      const families = (res && res.families) || [];
      const stillActive = families.some(f => f.familyId === this.data.familyId);
      if (stillActive) {
        this.setData({ invalidFamily: true, errorMessage: ErrorMessages.FAMILY_NOT_DISSOLVED });
      }
    }).catch(() => {
      // 静默失败：保持默认状态
    });
  },

  onRestore() {
    if (this.data.invalidFamily) {
      this.setData({ errorMessage: ErrorMessages.FAMILY_NOT_DISSOLVED });
      return Promise.resolve();
    }
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
