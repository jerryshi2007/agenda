// pages/profile-edit/index.js
// 资料编辑页 —— 昵称 + 头像，保存时先上传头像再更新资料（事务一致）

const authService = require('../../services/auth');
const { ErrorMessages } = require('../../contracts/auth');

Page({
  data: {
    loading: true,
    saving: false,
    nickname: '',
    avatarUrl: '',        // 当前头像 URL（已上传）
    avatarTempPath: '',   // 本地待上传路径
    avatarChanged: false,
    error: ''
  },

  onLoad() {
    authService.getProfile().then((profile) => {
      this.setData({
        loading: false,
        nickname: profile.nickname || '',
        avatarUrl: profile.avatarUrl || ''
      });
    }).catch(() => {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    });
  },

  onChooseAvatar(e) {
    this.setData({
      avatarTempPath: e.detail.avatarUrl,
      avatarChanged: true,
      avatarUrl: e.detail.avatarUrl, // 本地预览
      error: ''
    });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value, error: '' });
  },

  onSave() {
    if (this.data.saving) return;
    const nickname = (this.data.nickname || '').trim();
    if (!nickname) {
      this.setData({ error: ErrorMessages.NICKNAME_EMPTY });
      return;
    }
    if (nickname.length > 20) {
      this.setData({ error: ErrorMessages.NICKNAME_TOO_LONG });
      return;
    }

    this.setData({ saving: true, error: '' });

    // 头像如变更则先上传，失败不保存昵称（事务一致性）
    const uploadPromise = this.data.avatarChanged
      ? authService.uploadAvatar(this.data.avatarTempPath).then(res => res.url)
      : Promise.resolve(this.data.avatarUrl);

    uploadPromise.then((avatarUrl) => {
      return authService.updateProfile({ nickname, avatarUrl: avatarUrl || null });
    }).then(() => {
      this.setData({ saving: false });
      wx.navigateBack();
    }).catch((err) => {
      this.setData({ saving: false });
      wx.showToast({ title: (err && err.message) || '保存失败，请重试', icon: 'none' });
    });
  },

  onCancel() {
    wx.navigateBack();
  }
});
