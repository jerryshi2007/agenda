// pages/family-create/index.js
// 创建家庭页 —— 输入名称 + 选择角色（Parent/Child），提交后创建家庭并跳日历

const familyService = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { UserRole, ErrorMessages } = require('../../contracts/family');

// 名称长度约束（与 contracts dto.json CreateFamilyRequest 一致）
const NAME_MIN = 2;
const NAME_MAX = 20;

Page({
  data: {
    name: '',
    charCount: 0,
    role: UserRole.Parent,
    roleLabel: '家长',
    roleHint: '',
    valid: false,
    submitting: false,
    error: ''
  },

  onLoad() {
    // 默认角色为家长
    this._applyRole(UserRole.Parent);
  },

  onNameInput(e) {
    const value = (e && e.detail && e.detail.value) || '';
    this.setData({
      name: value,
      charCount: value.length,
      valid: this._isValidName(value)
    });
  },

  onSelectRole(e) {
    const role = e.currentTarget.dataset.role;
    this._applyRole(role);
  },

  _applyRole(role) {
    const roleLabel = role === UserRole.Parent ? '家长' : '孩子';
    const roleHint = role === UserRole.Child ? '创建后家庭暂无家长，建议邀请家长来管理家庭' : '';
    this.setData({ role, roleLabel, roleHint });
  },

  _isValidName(name) {
    if (typeof name !== 'string') return false;
    if (name.length < NAME_MIN || name.length > NAME_MAX) return false;
    return true;
  },

  onSubmit() {
    if (this.data.submitting) return;
    if (!this._isValidName(this.data.name)) {
      this.setData({ error: ErrorMessages.FAMILY_NAME_INVALID_LENGTH });
      return Promise.resolve();
    }
    this.setData({ submitting: true, error: '' });
    return familyService.createFamily({
      name: this.data.name,
      role: this.data.role
    }).then((res) => {
      const familyId = res && res.familyId;
      if (familyId) {
        wx.setStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID, familyId);
      }
      wx.switchTab({ url: '/pages/index/index' });
    }).catch((err) => {
      this.setData({
        submitting: false,
        error: (err && err.message) || ErrorMessages.FAMILY_NAME_INVALID_LENGTH
      });
    });
  }
});
