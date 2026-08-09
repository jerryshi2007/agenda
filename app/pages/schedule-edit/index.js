// pages/schedule-edit/index.js
// 编辑日程页 —— 复用创建页表单 + 编辑范围开关 + 乐观锁

const scheduleService = require('../../services/schedule');
const dateUtils = require('../../utils/date-utils');
const app = getApp();

Page({
  data: {
    scheduleId: '',
    scheduleType: '',
    isHomework: false,
    editScope: 'ThisOnly',    // 'ThisOnly' | 'ThisAndFuture'
    targetDate: '',           // 编辑目标日期
    rowVersion: '',           // 乐观锁版本号

    // Form data
    formData: {
      name: '',
      timeSlots: [],
      repeatEndDate: '',
      location: '',
      dueDate: '',
      suggestedStartTime: '',
      suggestedEndTime: '',
      notes: ''
    },
    errors: {},
    minDate: '',

    saving: false
  },

  onLoad(options) {
    const { scheduleId, date } = options;
    if (!scheduleId) {
      wx.showToast({ title: '缺少日程信息', icon: 'none' });
      wx.navigateBack();
      return;
    }

    const today = dateUtils.formatDate(new Date());
    this.setData({
      scheduleId: scheduleId,
      targetDate: date || today,
      minDate: today
    });

    this._loadSchedule();
  },

  /**
   * 加载现有日程数据
   */
  _loadSchedule() {
    scheduleService.getById(this.data.scheduleId, this.data.targetDate)
      .then(res => {
        const d = res.data;
        const isHomework = d.scheduleType === 'HomeworkTask';
        this.setData({
          scheduleType: d.scheduleType,
          isHomework: isHomework,
          rowVersion: d.rowVersion || '',
          formData: {
            name: d.name || '',
            timeSlots: d.timeSlots || [],
            repeatEndDate: d.repeatEndDate || '',
            location: d.location || '',
            dueDate: d.dueDate || '',
            suggestedStartTime: d.suggestedStartTime || '',
            suggestedEndTime: d.suggestedEndTime || '',
            notes: d.notes || ''
          }
        });
      })
      .catch(err => {
        if (err.data && err.data.error === 'SCHEDULE_NOT_FOUND') {
          wx.showToast({ title: '该日程已被删除', icon: 'none' });
          wx.navigateBack();
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      });
  },

  /**
   * 编辑范围变更
   */
  onScopeChange(e) {
    this.setData({ editScope: e.detail.scope });
  },

  /**
   * 表单字段输入
   */
  onFieldInput(e) {
    const { field } = e.currentTarget.dataset;
    const formData = this.data.formData;
    formData[field] = e.detail.value;
    this.setData({ formData });

    if (this.data.errors[field]) {
      const errors = this.data.errors;
      errors[field] = '';
      this.setData({ errors });
    }
  },

  onDateChange(e) {
    const { field } = e.currentTarget.dataset;
    const formData = this.data.formData;
    formData[field] = e.detail.value;
    this.setData({ formData });
  },

  onTimeChange(e) {
    const { field } = e.currentTarget.dataset;
    const formData = this.data.formData;
    formData[field] = e.detail.value;
    this.setData({ formData });
  },

  onTimeSlotChange(e) {
    const formData = this.data.formData;
    formData.timeSlots = e.detail.timeSlots;
    this.setData({ formData });
  },

  /**
   * 保存
   */
  onSave() {
    if (!this._validateForm()) return;

    this.setData({ saving: true });

    const fd = this.data.formData;
    const requestData = {
      scope: this.data.editScope,
      date: this.data.targetDate,
      name: fd.name.trim(),
      rowVersion: this.data.rowVersion
    };

    if (!this.data.isHomework) {
      requestData.timeSlots = fd.timeSlots;
      if (fd.repeatEndDate) requestData.repeatEndDate = fd.repeatEndDate;
      if (fd.location) requestData.location = fd.location;
    }

    if (this.data.isHomework) {
      if (fd.dueDate) requestData.dueDate = fd.dueDate;
      if (fd.suggestedStartTime) requestData.suggestedStartTime = fd.suggestedStartTime;
      if (fd.suggestedEndTime) requestData.suggestedEndTime = fd.suggestedEndTime;
    }

    if (fd.notes) requestData.notes = fd.notes;
    if (this.data.scheduleType === 'AfterSchoolActivity' && fd.location) {
      requestData.location = fd.location;
    }

    scheduleService.update(this.data.scheduleId, requestData)
      .then(() => {
        wx.showToast({ title: '保存成功', icon: 'success' });
        // 返回并通知首页刷新
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage) {
          prevPage._needRefresh = true;
        }
        setTimeout(() => wx.navigateBack(), 1000);
      })
      .catch(err => {
        this.setData({ saving: false });

        if (err.statusCode === 409 || (err.data && err.data.error === 'CONCURRENT_EDIT_CONFLICT')) {
          // 乐观锁冲突 — reload to get fresh rowVersion
          wx.showModal({
            title: '编辑冲突',
            content: '该日程已被其他用户修改，请刷新后重新编辑',
            showCancel: false,
            confirmText: '刷新',
            success: () => {
              this._loadSchedule();
            }
          });
        } else if (err.data && err.data.error === 'CHILD_NOT_IN_FAMILY') {
          wx.showToast({ title: '关联孩子已不在家庭中', icon: 'none' });
        } else {
          wx.showToast({ title: err.message || '保存失败，请刷新重试', icon: 'none' });
        }
      });
  },

  /**
   * 表单校验
   */
  _validateForm() {
    const errors = {};
    const fd = this.data.formData;

    if (!fd.name || !fd.name.trim()) {
      errors.name = '请输入日程名称';
    } else if (fd.name.length > 50) {
      errors.name = '名称长度不超过50个字符';
    }

    if (!this.data.isHomework && (!fd.timeSlots || fd.timeSlots.length === 0)) {
      errors.timeSlots = '请至少选择一天';
    }

    if (this.data.isHomework && !fd.dueDate) {
      errors.dueDate = '请选择截止日期';
    }

    if (fd.notes && fd.notes.length > 500) {
      errors.notes = '备注不超过500个字符';
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  }
});
