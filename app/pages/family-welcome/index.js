// pages/family-welcome/index.js
// 首次引导页 —— 用户无家庭时显示，提供"创建家庭"/"加入家庭"按钮
// 有家庭时自动跳转到日历首页
// 分享卡片入口：从 query.inviteCode 自动调 getShareInfo 预填家庭信息
// 分享卡片分享的格式：/pages/family-welcome/index?inviteCode=xxxxxx

const familyService = require('../../services/family');
const { ErrorMessages } = require('../../contracts/family');

Page({
  data: {
    loading: true,
    error: false,
    errorMessage: '',
    hasFamily: false,
    // 分享卡片预填
    pendingShare: false,
    shareInfo: null,
    shareError: ''
  },

  onLoad(query) {
    const q = query || {};
    if (q.inviteCode) {
      // 分享卡片入口：调 getShareInfo 预填，渲染确认页
      this._loadShareInfo(q.inviteCode);
    } else {
      this._loadFamilies();
    }
  },

  onShow() {
    // 从创建/加入页成功返回时重新拉取（可能已建立家庭）
    if (this.data.pendingShare || this.data.shareInfo) return;
    if (!this.data.loading) {
      this._loadFamilies();
    }
  },

  _loadFamilies() {
    this.setData({ loading: true, error: false, errorMessage: '' });
    familyService.getMyFamilies().then((res) => {
      const families = (res && res.families) || [];
      if (families.length > 0) {
        this.setData({ loading: false, hasFamily: true });
        wx.switchTab({ url: '/pages/index/index' });
        return;
      }
      this.setData({ loading: false, error: false, hasFamily: false });
    }).catch(() => {
      this.setData({ loading: false, error: true, errorMessage: '网络异常' });
    });
  },

  _loadShareInfo(inviteCode) {
    this.setData({ loading: true, pendingShare: true, shareInfo: null, shareError: '' });
    familyService.getShareInfo(inviteCode).then((info) => {
      this.setData({
        loading: false,
        pendingShare: false,
        shareInfo: info || null
      });
    }).catch((err) => {
      this.setData({
        loading: false,
        pendingShare: false,
        shareError: (err && err.message) || ErrorMessages.INVALID_INVITATION_CODE
      });
    });
  },

  onAcceptShare() {
    const info = this.data.shareInfo;
    if (!info) return;
    const code = info.inviteCode || info.code;
    if (!code) return;
    wx.redirectTo({ url: '/pages/family-join/index?inviteCode=' + code });
  },

  onDeclineShare() {
    this.setData({ pendingShare: false, shareInfo: null, shareError: '' });
    this._loadFamilies();
  },

  onCreateFamily() {
    wx.navigateTo({ url: '/pages/family-create/index' });
  },

  onJoinFamily() {
    wx.navigateTo({ url: '/pages/family-join/index' });
  },

  onRetry() {
    if (this.data.shareError) {
      // 分享信息加载失败 → 回到普通引导
      this.setData({ pendingShare: false, shareInfo: null, shareError: '' });
      this._loadFamilies();
      return;
    }
    this._loadFamilies();
  }
});
