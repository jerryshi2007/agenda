// pages/template-create/index.js
// 模板创建/编辑页 —— 基于 schedule-form 子组件
// mode: 'template-create' (无 id query) | 'template-edit' (有 id query)

const templateService = require('../../services/template');
const { ErrorMessages } = require('../../contracts/template');

Page({
  data: {
    mode: 'template-create',
    title: '新建模板',
    editing: false,
    templateId: null,
    initialValues: null,
    submitting: false
  },

  onLoad(options) {
    const { id } = options || {};
    if (id) {
      this.setData({
        mode: 'template-edit',
        title: '编辑模板',
        editing: true,
        templateId: id
      });
      this._loadTemplate(id);
    } else {
      this.setData({
        mode: 'template-create',
        title: '新建模板',
        editing: false,
        templateId: null,
        initialValues: null
      });
    }
  },

  _loadTemplate(id) {
    templateService.getById(id)
      .then(res => {
        const tpl = (res && res.data) || {};
        this.setData({
          initialValues: {
            name: tpl.name || '',
            scheduleType: tpl.scheduleType || '',
            timeSlots: tpl.timeSlots || [],
            location: tpl.location || '',
            notes: tpl.notes || ''
          }
        });
      })
      .catch(err => {
        const code = err && err.error;
        const msg = (code && ErrorMessages[code]) || (err && err.message) || '加载失败';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },

  /**
   * schedule-form 子组件 submit 事件
   * detail = { formData, valid }
   */
  onFormSubmit(e) {
    if (this.data.submitting) return;
    const { formData, valid } = e.detail || {};
    if (!valid) {
      // 校验失败：schedule-form 自身已展示 errors
      return;
    }
    if (!formData) return;
    this.setData({ submitting: true });

    if (this.data.editing) {
      this._doUpdate(this.data.templateId, formData);
    } else {
      this._doCreate(formData);
    }
  },

  _doCreate(formData) {
    const requestData = this._buildRequestData(formData);
    templateService.create(requestData)
      .then(() => {
        wx.showToast({ title: '已保存模板', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1000);
      })
      .catch(err => {
        this.setData({ submitting: false });
        this._showError(err, '保存失败');
      });
  },

  _doUpdate(id, formData) {
    const requestData = this._buildUpdateData(formData);
    templateService.update(id, requestData)
      .then(() => {
        wx.showToast({ title: '已更新模板', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1000);
      })
      .catch(err => {
        this.setData({ submitting: false });
        this._showError(err, '更新失败');
      });
  },

  /**
   * 构造 create 请求体（DTO：包含 scheduleType、timeSlots、name）
   */
  _buildRequestData(formData) {
    const data = {
      name: (formData.name || '').trim(),
      scheduleType: formData.scheduleType,
      timeSlots: formData.timeSlots || []
    };
    if (formData.location) data.location = formData.location;
    if (formData.notes) data.notes = formData.notes;
    if (formData.repeatEndDate) data.repeatEndDate = formData.repeatEndDate;
    return data;
  },

  /**
   * 构造 update 请求体（DTO：不含 scheduleType —— 创建后类型不可变）
   */
  _buildUpdateData(formData) {
    const data = {
      name: (formData.name || '').trim(),
      timeSlots: formData.timeSlots || []
    };
    if (formData.location) data.location = formData.location;
    if (formData.notes) data.notes = formData.notes;
    if (formData.repeatEndDate) data.repeatEndDate = formData.repeatEndDate;
    return data;
  },

  _showError(err, fallback) {
    const code = err && err.error;
    const msg = (code && ErrorMessages[code]) || (err && err.message) || fallback;
    wx.showToast({ title: msg, icon: 'none' });
  }
});
