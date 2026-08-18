// pages/family-invite/index.js
// 邀请成员页 —— 选择邀请类型（家长/孩子），孩子需姓名+展示模式，生成邀请码

const familyService = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { UserRole, DisplayMode, DisplayModeLabels, ErrorMessages } = require('../../contracts/family');

Page({
  data: {
    targetRole: UserRole.Parent,
    childFormVisible: false,
    childName: '',
    targetDisplayMode: DisplayMode.Primary,
    displayModeLabel: DisplayModeLabels.Primary,
    displayModes: [
      { mode: DisplayMode.Preschool, label: DisplayModeLabels.Preschool },
      { mode: DisplayMode.Primary, label: DisplayModeLabels.Primary },
      { mode: DisplayMode.UpperGrades, label: DisplayModeLabels.UpperGrades }
    ],
    valid: true,
    submitting: false,
    error: '',
    code: '',
    expiresAt: '',
    codeVisible: false
  },

  onLoad() {
    // 默认角色为 Parent，valid=true（Parent 无需额外字段）
    this.setData({ valid: true, targetRole: UserRole.Parent, childFormVisible: false });
  },

  onSelectType(e) {
    const role = e.currentTarget.dataset.role;
    const childFormVisible = role === UserRole.Child;
    this.setData({
      targetRole: role,
      childFormVisible
    });
    this._recomputeValid();
  },

  onChildNameInput(e) {
    const value = (e && e.detail && e.detail.value) || '';
    this.setData({ childName: value });
    this._recomputeValid();
  },

  onSelectDisplayMode(e) {
    const mode = e.currentTarget.dataset.mode;
    const displayModeLabel = DisplayModeLabels[mode] || '';
    this.setData({
      targetDisplayMode: mode,
      displayModeLabel
    });
  },

  _isValid() {
    if (this.data.targetRole === UserRole.Parent) return true;
    // Child 模式必须有姓名
    return typeof this.data.childName === 'string' && this.data.childName.trim().length > 0;
  },

  _recomputeValid() {
    this.setData({ valid: this._isValid() });
  },

  onSubmit() {
    if (this.data.submitting) return Promise.resolve();
    if (!this._isValid()) {
      this.setData({ error: '请填写孩子姓名' });
      return Promise.resolve();
    }
    this.setData({ submitting: true, error: '' });
    const payload = { targetRole: this.data.targetRole };
    if (this.data.targetRole === UserRole.Child) {
      payload.targetChildName = this.data.childName;
      payload.targetDisplayMode = this.data.targetDisplayMode;
    }
    return familyService.generateInviteCode(this.data._currentFamilyId || this._readFamilyId(), payload).then((res) => {
      this.setData({
        submitting: false,
        code: (res && res.code) || '',
        expiresAt: (res && res.expiresAt) || '',
        codeVisible: true,
        error: ''
      });
    }).catch((err) => {
      this.setData({
        submitting: false,
        error: (err && err.message) || ErrorMessages.FAMILY_MEMBER_LIMIT_EXCEEDED
      });
    });
  },

  _readFamilyId() {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      return wx.getStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID) || '';
    }
    return '';
  },

  onRegenerate() {
    this.setData({ codeVisible: false, error: '' });
  },

  onCopyCode() {
    if (!this.data.code) return;
    wx.setClipboardData({
      data: this.data.code,
      success: () => {
        wx.showToast({ title: '已复制邀请码', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    // 分享卡片：路径携带邀请码
    const code = this.data.code;
    return {
      title: '邀请你加入家庭',
      path: code ? `/pages/family-welcome/index?inviteCode=${code}` : '/pages/family-welcome/index'
    };
  }
});
