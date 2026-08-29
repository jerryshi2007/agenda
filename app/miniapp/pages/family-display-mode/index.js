// pages/family-display-mode/index.js
// 孩子展示模式设置页 —— 三模式选择（学龄前/小学/高年级），保存后更新孩子成员的展示模式
// 通过 query 接收：mode（当前模式）、memberId（待更新的孩子 memberId）、childName（展示用）

const familyService = require('../../services/family');
const { DisplayMode, DisplayModeLabels, ErrorMessages } = require('../../contracts/family');

Page({
  data: {
    memberId: '',
    childName: '',
    currentMode: DisplayMode.Primary,
    selectedMode: DisplayMode.Primary,
    displayModes: [
      { mode: DisplayMode.Preschool, label: DisplayModeLabels.Preschool },
      { mode: DisplayMode.Primary, label: DisplayModeLabels.Primary },
      { mode: DisplayMode.UpperGrades, label: DisplayModeLabels.UpperGrades }
    ],
    disabled: true,
    saving: false,
    success: false,
    errorMessage: ''
  },

  onLoad(query) {
    const q = query || {};
    const mode = q.mode || DisplayMode.Primary;
    const memberId = q.memberId || '';
    const childName = q.childName || '';
    this.setData({
      currentMode: mode,
      selectedMode: mode,
      memberId: memberId,
      childName: childName,
      disabled: true
    });
  },

  onSelectMode(e) {
    const mode = e.currentTarget.dataset.mode;
    const disabled = mode === this.data.currentMode;
    this.setData({ selectedMode: mode, disabled, errorMessage: '' });
  },

  onSave() {
    if (this.data.saving) return Promise.resolve();
    if (this.data.disabled) return Promise.resolve();
    if (!this.data.memberId) {
      this.setData({ errorMessage: '缺少成员标识' });
      return Promise.resolve();
    }
    this.setData({ saving: true, errorMessage: '' });
    return familyService.setDisplayMode(this.data.memberId, this.data.selectedMode).then(() => {
      this.setData({
        saving: false,
        success: true,
        currentMode: this.data.selectedMode,
        disabled: true
      });
    }).catch((err) => {
      this.setData({
        saving: false,
        errorMessage: (err && err.message) || ErrorMessages.PERMISSION_DENIED
      });
    });
  }
});
