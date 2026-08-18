// pages/family-switch/index.js
// 多家庭切换页 —— 拉取我的所有家庭、标记当前家庭、选择后写入 CURRENT_FAMILY_ID 并 reLaunch 首页
// 单家庭时显示空态提示，不展示可点击列表
// TC-FSW-05：点击已退出家庭时提示"你已不在该家庭中"并自动从列表移除

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
    // TC-FSW-05：先校验用户是否仍在该家庭中（避免切到已退出的家庭后 reLaunch 失败）
    // 通过 getMyFamilies 重新拉取权威列表，被移除的家庭不会返回
    familyService.getMyFamilies().then((res) => {
      const fresh = (res && res.families) || [];
      const stillMember = fresh.some(f => f.familyId === familyId);
      if (!stillMember) {
        // 已不在该家庭：从列表移除并提示
        const remaining = this.data.families.filter(f => f.familyId !== familyId);
        this.setData({
          switching: false,
          families: remaining,
          singleFamily: remaining.length <= 1,
          errorMessage: '你已不在该家庭中'
        });
        return;
      }
      wx.setStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID, familyId);
      wx.reLaunch({ url: '/pages/index/index' });
    }).catch((err) => {
      this.setData({
        switching: false,
        errorMessage: (err && err.message) || '切换失败'
      });
    });
  },

  onRetry() {
    return this._load();
  }
});
