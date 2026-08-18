// pages/family-join/index.js
// 加入家庭页 —— 输入 6 位邀请码（仅 2-9），提交 joinByCode，成功跳日历

const familyService = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ErrorMessages } = require('../../contracts/family');

const CODE_LENGTH = 6;
const ALLOWED_CHARS = /[2-9]/g;

Page({
  data: {
    code: '',
    codeLength: 0,
    valid: false,
    submitting: false,
    error: ''
  },

  onLoad(query) {
    // 来自微信分享卡片的预填：query.inviteCode
    const inviteCode = (query && query.inviteCode) || '';
    this.setData({
      code: inviteCode,
      codeLength: inviteCode.length,
      valid: this._isValidCode(inviteCode)
    });
  },

  onCodeInput(e) {
    const raw = (e && e.detail && e.detail.value) || '';
    // 仅保留 2-9，过滤掉 0/1/字母/中文/特殊字符
    const code = (raw.match(ALLOWED_CHARS) || []).join('').slice(0, CODE_LENGTH);
    this.setData({
      code,
      codeLength: code.length,
      valid: this._isValidCode(code)
    });
  },

  _isValidCode(code) {
    return typeof code === 'string' && code.length === CODE_LENGTH;
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onSubmit() {
    if (this.data.submitting) return Promise.resolve();
    if (!this._isValidCode(this.data.code)) {
      this.setData({ error: ErrorMessages.INVALID_INVITATION_CODE });
      return Promise.resolve();
    }
    this.setData({ submitting: true, error: '' });
    return familyService.joinByCode(this.data.code).then((res) => {
      const familyId = res && res.familyId;
      if (familyId) {
        wx.setStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID, familyId);
      }
      wx.switchTab({ url: '/pages/index/index' });
    }).catch((err) => {
      this.setData({
        submitting: false,
        error: (err && err.message) || ErrorMessages.INVALID_INVITATION_CODE
      });
    });
  }
});
