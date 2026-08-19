// pages/template-list/index.js
// 模板列表页 —— 预设模板 + 我的模板分区，搜索 + 新建入口 + use-template-dialog 弹窗

const templateService = require('../../services/template');

Page({
  data: {
    presets: [],
    customs: [],
    keyword: '',
    loading: false,
    dialogVisible: false,
    activeTemplate: null
  },

  onLoad() {
    this._loadList();
  },

  onShow() {
    // 家庭切换/模板变更后重新加载
    this._loadList();
  },

  /**
   * 加载模板列表
   */
  _loadList() {
    if (this.data.loading) return Promise.resolve();
    this.setData({ loading: true });

    const query = {};
    if (this.data.keyword) query.keyword = this.data.keyword;

    return templateService.list(query)
      .then(res => {
        const items = (res && res.data && res.data.items) || [];
        const presets = items.filter(t => t.isPreset);
        const customs = items.filter(t => !t.isPreset);
        this.setData({ presets, customs, loading: false });
      })
      .catch(err => {
        this.setData({ loading: false });
        wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
      });
  },

  /**
   * 搜索输入
   */
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  /**
   * 触发搜索
   */
  onSearch() {
    this._loadList();
  },

  /**
   * 清空搜索
   */
  onSearchClear() {
    this.setData({ keyword: '' });
    this._loadList();
  },

  /**
   * 点击模板项
   * 预设：弹 use-template-dialog
   * 自定义：跳详情页
   */
  onTapTemplate(e) {
    const { templateId } = e.currentTarget.dataset;
    const all = this.data.presets.concat(this.data.customs);
    const tpl = all.find(t => t.templateId === templateId);
    if (!tpl) return;

    if (tpl.isPreset) {
      this.setData({ activeTemplate: tpl, dialogVisible: true });
    } else {
      wx.navigateTo({ url: '/pages/template-detail/index?id=' + templateId });
    }
  },

  /**
   * 新建模板
   */
  onTapAdd() {
    wx.navigateTo({ url: '/pages/template-create/index' });
  },

  /**
   * 空态区"新建模板"按钮
   */
  onTapEmptyAdd() {
    this.onTapAdd();
  },

  /**
   * use-template-dialog 成功生成日程
   */
  onDialogSuccess(e) {
    this.setData({ dialogVisible: false });
    const { scheduleId } = (e && e.detail) || {};
    if (scheduleId) {
      wx.showToast({ title: '已生成日程', icon: 'success' });
      wx.redirectTo({ url: '/pages/schedule-detail/index?id=' + scheduleId });
    }
  },

  /**
   * use-template-dialog 关闭
   */
  onDialogClose() {
    this.setData({ dialogVisible: false });
  }
});
