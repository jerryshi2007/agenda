// pages/template-detail/index.js
// 模板详情页 —— 查看/编辑/删除/使用（仅自定义模板可编辑删除）

const templateService = require('../../services/template');
const dateUtils = require('../../utils/date-utils');
const { ScheduleTypeLabels, ErrorMessages } = require('../../contracts/template');

Page({
  data: {
    template: null,
    isPreset: false,
    scheduleTypeLabel: '',
    timeSlotSummary: '',
    dialogVisible: false,
    activeTemplate: null,
    loading: false
  },

  onLoad(options) {
    const { id } = options || {};
    if (!id) {
      wx.showToast({ title: '缺少模板 id', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this._templateId = id;
    this._loadTemplate(id);
  },

  _loadTemplate(id) {
    this.setData({ loading: true });
    templateService.getById(id)
      .then(res => {
        const tpl = (res && res.data) || {};
        const timeSlotSummary = tpl.timeSlots && tpl.timeSlots.length
          ? dateUtils.toRepeatRuleText(tpl.timeSlots)
          : '未设置';
        this.setData({
          template: tpl,
          isPreset: !!tpl.isPreset,
          scheduleTypeLabel: ScheduleTypeLabels[tpl.scheduleType] || '',
          timeSlotSummary: timeSlotSummary,
          loading: false
        });
      })
      .catch(err => {
        this.setData({ loading: false });
        wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
      });
  },

  /**
   * 编辑（仅自定义模板）
   */
  onTapEdit() {
    if (!this.data.template) return;
    wx.navigateTo({ url: '/pages/template-create/index?id=' + this.data.template.templateId });
  },

  /**
   * 删除（仅自定义模板）
   */
  onTapDelete() {
    const tpl = this.data.template;
    if (!tpl) return;
    const usageCount = tpl.usageCount || 0;
    const content = usageCount > 0
      ? `已有 ${usageCount} 个日程使用过此模板，删除模板不会影响这些日程。确定删除吗？`
      : '确定删除该模板吗？';
    wx.showModal({
      title: '删除模板',
      content: content,
      confirmText: '删除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this._doDelete(tpl.templateId);
        }
      }
    });
  },

  _doDelete(id) {
    templateService.remove(id)
      .then(() => {
        wx.showToast({ title: '模板已删除', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1000);
      })
      .catch(err => {
        const code = err && err.error;
        const msg = (code && ErrorMessages[code]) || (err && err.message) || '删除失败';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },

  /**
   * 使用模板（预设/自定义都可弹 dialog）
   */
  onTapUse() {
    if (!this.data.template) return;
    this.setData({
      activeTemplate: this.data.template,
      dialogVisible: true
    });
  },

  /**
   * use-template-dialog 成功
   */
  onDialogSuccess(e) {
    this.setData({ dialogVisible: false });
    const { scheduleId } = (e && e.detail) || {};
    if (scheduleId) {
      wx.showToast({ title: '已生成日程', icon: 'success' });
      wx.redirectTo({ url: '/pages/schedule-detail/index?id=' + scheduleId });
    }
  },

  onDialogClose() {
    this.setData({ dialogVisible: false });
  }
});
