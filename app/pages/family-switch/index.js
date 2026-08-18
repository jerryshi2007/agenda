// pages/family-switch/index.js
// 多家庭切换页 —— 拉取我的所有家庭、标记当前家庭、选择后写入 CURRENT_FAMILY_ID 并 reLaunch 首页
// 单家庭时显示空态提示，不展示可点击列表

const familyService = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');

Page({
  data: {
    loading: true,
    error: false,
    errorMessage: '',
    families: [],
    singleFamily: false,
    switching: false
  },

  onLoad() {
    this._load();
  },

  onShow() {
    if (this.data.switching) return;
    this._load();
  },

  _load() {
    this.setData({ loading: true, error: false, errorMessage: '' });
    return familyService.getMyFamilies().then((res) => {
      const families = (res && res.families) || [];
      const currentId = this._readCurrentFamilyId();
      const decorated = families.map(f => Object.assign({}, f, { isCurrent: f.familyId === currentId }));
      this.setData({
        loading: false,
        families: decorated,
        singleFamily: families.length <= 1,
        error: false
      });
    }).catch((err) => {
      this.setData({
        loading: false,
        error: true,
        errorMessage: (err && err.message) || '加载失败'
      });
    });
  },

  _readCurrentFamilyId() {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      return wx.getStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID) || '';
    }
    return '';
  },

  onSelectFamily(e) {
    if (this.data.switching) return;
    const familyId = e.currentTarget.dataset.familyId;
    const currentId = this._readCurrentFamilyId();
    if (familyId === currentId) return;
    this.setData({ switching: true });
    wx.setStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID, familyId);
    wx.reLaunch({ url: '/pages/index/index' });
  },

  onRetry() {
    return this._load();
  }
});
