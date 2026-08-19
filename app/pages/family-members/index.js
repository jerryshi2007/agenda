// pages/family-members/index.js
// 成员列表与成员管理页 —— 按家长/孩子分组、操作菜单（移除/转让/设置展示模式）、底部退出/解散按钮

const familyService = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { UserRole, DisplayMode, DisplayModeLabels, ErrorMessages } = require('../../contracts/family');
const app = getApp();

function _deactivate(list) {
  return (list || []).map(m => Object.assign({}, m, { isDeactivated: !!m.isDeleted }));
}

function _roleLabel(role) {
  return role === UserRole.Parent ? '家长' : '孩子';
}

Page({
  data: {
    loading: true,
    error: false,
    errorMessage: '',
    familyName: '',
    creatorId: '',
    parents: [],
    children: [],
    activeMemberCount: 0,
    maxMemberCount: 10,
    selfMemberId: '',
    selfRole: ''
  },

  onLoad(options) {
    // 优先从 URL 参数读取 familyId（如 mine 页跳转时传入），回退到 Storage
    const familyId = (options && options.familyId) || this._readFamilyId();
    if (familyId) {
      wx.setStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID, familyId);
    }
    this._familyId = familyId;
    this._load();
  },

  onShow() {
    this._familyId = this._readFamilyId();
    this._load();
  },

  _load() {
    this.setData({ loading: true, error: false, errorMessage: '' });
    const familyId = this._familyId;
    if (!familyId) {
      this.setData({ loading: false, error: true, errorMessage: '未选择家庭' });
      return;
    }
    return familyService.getMembers(familyId).then((res) => {
      const data = res || {};
      this.setData({
        loading: false,
        familyName: data.familyName || '',
        creatorId: data.creatorId || '',
        parents: _deactivate(data.parents),
        children: _deactivate(data.children),
        activeMemberCount: data.activeMemberCount || 0,
        maxMemberCount: data.maxMemberCount || 10
      });
    }).catch((err) => {
      this.setData({ loading: false, error: true, errorMessage: (err && err.message) || '网络异常' });
    });
  },

  _readFamilyId() {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      return wx.getStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID) || '';
    }
    return '';
  },

  _selfMemberId() {
    // 在 parents 或 children 中通过 userId 匹配
    if (app && app.globalData && app.globalData.userId) {
      const me = (this.data.parents || []).find(m => m.userId === app.globalData.userId);
      if (me) return me.memberId;
      const child = (this.data.children || []).find(m => m.userId === app.globalData.userId);
      if (child) return child.memberId;
    }
    return '';
  },

  onMemberAction(e) {
    const memberId = e.currentTarget.dataset.memberId;
    const role = e.currentTarget.dataset.role;
    const selfId = this._selfMemberId();
    if (memberId === selfId) {
      // 自己：仅孩子角色时可升级为家长；此处简化处理，不弹菜单
      return;
    }
    const itemList = role === UserRole.Child
      ? ['设置展示模式', '移除成员']
      : ['移除成员', '转让创建者'];
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const idx = res.tapIndex;
        if (role === UserRole.Child) {
          if (idx === 0) this._showDisplayModePicker(memberId);
          else if (idx === 1) this._confirmRemove(memberId, role);
        } else {
          if (idx === 0) this._confirmRemove(memberId, role);
          else if (idx === 1) this._confirmTransfer(memberId);
        }
      }
    });
  },

  _showDisplayModePicker(memberId) {
    const modes = [
      { mode: DisplayMode.Preschool, label: DisplayModeLabels.Preschool },
      { mode: DisplayMode.Primary, label: DisplayModeLabels.Primary },
      { mode: DisplayMode.UpperGrades, label: DisplayModeLabels.UpperGrades }
    ];
    wx.showActionSheet({
      itemList: modes.map(m => m.label),
      success: (res) => {
        const mode = modes[res.tapIndex].mode;
        this._setDisplayMode(memberId, mode);
      }
    });
  },

  _setDisplayMode(memberId, mode) {
    return familyService.setDisplayMode(memberId, mode).then(() => this._load());
  },

  _confirmRemove(memberId, role) {
    wx.showModal({
      title: '移除成员',
      content: '确定要移除该成员吗？',
      success: (res) => {
        if (res.confirm) this._removeMember(memberId);
      }
    });
  },

  _removeMember(memberId) {
    const familyId = this._readFamilyId();
    return familyService.removeMember(familyId, memberId).then(() => this._load());
  },

  _confirmTransfer(memberId) {
    wx.showModal({
      title: '转让创建者',
      content: '确定要将创建者身份转让给该成员吗？',
      success: (res) => {
        if (res.confirm) this._transfer(memberId);
      }
    });
  },

  _transfer(memberId) {
    const familyId = this._readFamilyId();
    return familyService.transferCreator(familyId, memberId).then(() => this._load());
  },

  onInvite() {
    wx.navigateTo({ url: '/pages/family-invite/index' });
  },

  onInviteList() {
    wx.navigateTo({ url: '/pages/family-invite-list/index' });
  },

  onLeaveFamily() {
    wx.showModal({
      title: '退出家庭',
      content: '确定要退出当前家庭吗？',
      success: (res) => {
        if (!res.confirm) return;
        const familyId = this._readFamilyId();
        return familyService.exitFamily(familyId).then((r) => {
          // 清空当前家庭上下文
          wx.removeStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID);
          if (app && app.globalData) app.globalData.currentFamilyId = null;
          if (r && r.hasOtherFamilies) {
            wx.switchTab({ url: '/pages/mine/index' });
          } else {
            wx.reLaunch({ url: '/pages/family-welcome/index' });
          }
        }).catch((err) => {
          wx.showToast({
            title: (err && err.message) || ErrorMessages.LAST_PARENT_CANNOT_EXIT,
            icon: 'none'
          });
        });
      }
    });
    return Promise.resolve();
  },

  onDisbandFamily(familyName) {
    const expectedName = familyName || this.data.familyName;
    return new Promise((resolve) => {
      wx.showModal({
        title: '解散家庭',
        content: `解散后数据保留 30 天。请输入家庭名称「${expectedName}」确认解散`,
        editable: true,
        placeholderText: '输入家庭名称',
        success: (res) => {
          if (!res.confirm) return resolve();
          const inputName = (res.content || '').trim();
          if (inputName !== expectedName) {
            wx.showToast({ title: ErrorMessages.FAMILY_NAME_MISMATCH, icon: 'none' });
            return resolve();
          }
          const familyId = this._readFamilyId();
          return resolve(familyService.dissolveFamily(familyId, inputName).then(() => {
            wx.removeStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID);
            if (app && app.globalData) app.globalData.currentFamilyId = null;
            wx.reLaunch({ url: '/pages/family-welcome/index' });
          }).catch((err) => {
            wx.showToast({
              title: (err && err.message) || '解散失败',
              icon: 'none'
            });
          }));
        }
      });
    });
  },

  onRetry() {
    return this._load();
  }
});
