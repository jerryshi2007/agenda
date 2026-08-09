// pages/schedule-create/index.js
// 创建日程页 —— 4 步向导 + 数据校验 + 冲突检测

const scheduleService = require('../../services/schedule');
const dateUtils = require('../../utils/date-utils');
const app = getApp();

const TYPE_LABELS = {
  'AfterSchoolActivity': '课后活动',
  'DailyRoutine': '日常作息',
  'HomeworkTask': '作业任务'
};

Page({
  data: {
    // Step state
    currentStep: 1,
    scheduleType: '',
    stripeClass: 'activity',
    typeLabel: '',

    // Child list
    childList: [],

    // Form
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

    // Confirm
    selectedChildNames: '',
    timeSlotSummary: '',

    // Conflict
    showConflictDialog: false,
    conflicts: [],
    conflictResolve: null, // 'continue' | 'back'

    // Submit
    submitting: false,
    ignoreConflict: false
  },

  onLoad() {
    const today = dateUtils.formatDate(new Date());
    this.setData({ minDate: today });

    // 恢复草稿
    const draft = wx.getStorageSync(require('../../utils/storage-keys').SCHEDULE_DRAFT);
    if (draft) {
      this.setData({
        scheduleType: draft.scheduleType || '',
        formData: Object.assign({}, this.data.formData, draft.formData || {}),
        currentStep: draft.currentStep || 1
      });
    }

    // 加载孩子列表
    this._loadChildList();
  },

  onShow() {
    this._loadChildList();
  },

  /**
   * 加载孩子列表
   */
  _loadChildList() {
    const children = app.globalData.childList || [];
    const list = children.map((c, i) => ({
      ...c,
      userId: c.userId || c.childId,
      childName: c.childName || c.name,
      _color: ['#10AEFF', '#FF9500', '#07C160', '#FA5151'][i % 4],
      _selected: false
    }));
    this.setData({ childList: list });
  },

  /**
   * 选择/取消选择孩子
   */
  onToggleChild(e) {
    const { index } = e.currentTarget.dataset;
    const childList = this.data.childList;
    childList[index]._selected = !childList[index]._selected;
    this.setData({ childList });
  },

  /**
   * 选择类型
   */
  onSelectType(e) {
    const type = e.currentTarget.dataset.type;
    let stripeClass = 'activity';
    if (type === 'AfterSchoolActivity') stripeClass = 'activity';
    else if (type === 'DailyRoutine') stripeClass = 'routine';
    else if (type === 'HomeworkTask') stripeClass = 'homework';

    this.setData({
      scheduleType: type,
      stripeClass: stripeClass,
      typeLabel: TYPE_LABELS[type]
    });
  },

  /**
   * 上一步
   */
  onPrevStep() {
    if (this.data.currentStep <= 1) return;
    this.setData({ currentStep: this.data.currentStep - 1 });
  },

  /**
   * 下一步
   */
  onNextStep() {
    const step = this.data.currentStep;

    if (step === 1) {
      // 校验 Step 1：至少选择一个孩子
      const selected = this.data.childList.filter(c => c._selected);
      if (selected.length === 0) {
        wx.showToast({ title: '请至少选择一个孩子', icon: 'none' });
        return;
      }
    }

    if (step === 2) {
      // 校验 Step 2：已选择类型
      if (!this.data.scheduleType) {
        wx.showToast({ title: '请选择日程类型', icon: 'none' });
        return;
      }
    }

    if (step === 3) {
      // 校验 Step 3：表单校验
      if (!this._validateForm()) return;
    }

    if (step === 4) {
      // 准备确认信息
      this._prepareConfirm();
    }

    this.setData({ currentStep: step + 1 });

    if (this.data.currentStep === 4) {
      this._prepareConfirm();
    }

    // 保存草稿
    this._saveDraft();
  },

  /**
   * 表单字段输入
   */
  onFieldInput(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    const formData = this.data.formData;
    formData[field] = value;
    this.setData({ formData });

    // 实时清除该字段错误
    if (this.data.errors[field]) {
      const errors = this.data.errors;
      errors[field] = '';
      this.setData({ errors });
    }
  },

  /**
   * 日期选择变更
   */
  onDateChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    const formData = this.data.formData;
    formData[field] = value;
    this.setData({ formData });
  },

  /**
   * 时间选择变更
   */
  onTimeChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    const formData = this.data.formData;
    formData[field] = value;
    this.setData({ formData });
  },

  /**
   * 时间槽变更（子组件事件）
   */
  onTimeSlotChange(e) {
    const timeSlots = e.detail.timeSlots;
    const formData = this.data.formData;
    formData.timeSlots = timeSlots;
    this.setData({ formData });
  },

  /**
   * 跳转家庭管理
   */
  onGoFamily() {
    wx.showToast({ title: '家庭管理模块待开发', icon: 'none' });
  },

  /**
   * 表单校验
   */
  _validateForm() {
    const errors = {};
    const fd = this.data.formData;

    // 名称
    if (!fd.name || !fd.name.trim()) {
      errors.name = '请输入日程名称';
    } else if (fd.name.length > 50) {
      errors.name = '名称长度不超过50个字符';
    }

    // 非作业任务需要时间槽
    if (this.data.scheduleType !== 'HomeworkTask') {
      if (!fd.timeSlots || fd.timeSlots.length === 0) {
        errors.timeSlots = '请至少选择一天';
      }
    }

    // 作业任务需要截止日期
    if (this.data.scheduleType === 'HomeworkTask') {
      if (!fd.dueDate) {
        errors.dueDate = '请选择截止日期';
      } else if (fd.dueDate < this.data.minDate) {
        errors.dueDate = '截止日期不能早于今天';
      }
    }

    // 备注长度
    if (fd.notes && fd.notes.length > 500) {
      errors.notes = '备注不超过500个字符';
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  /**
   * 准备确认信息
   */
  _prepareConfirm() {
    const selected = this.data.childList.filter(c => c._selected);
    const names = selected.map(c => c.childName || c.name).join('、');
    this.setData({ selectedChildNames: names });

    // 时间槽摘要
    if (this.data.scheduleType !== 'HomeworkTask') {
      const summary = dateUtils.toRepeatRuleText(this.data.formData.timeSlots);
      this.setData({ timeSlotSummary: summary || '未设置' });
    }
  },

  /**
   * 提交创建
   */
  onSubmit() {
    if (!this._validateForm()) return;
    if (this.data.currentStep < 4) return;

    const selected = this.data.childList.filter(c => c._selected);
    if (selected.length === 0) {
      wx.showToast({ title: '请至少选择一个孩子', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    const fd = this.data.formData;
    const requestData = {
      name: fd.name.trim(),
      scheduleType: this.data.scheduleType,
      childIds: selected.map(c => c.userId || c.childId),
      ignoreConflict: this.data.ignoreConflict
    };

    if (this.data.scheduleType !== 'HomeworkTask') {
      requestData.timeSlots = fd.timeSlots;
      if (fd.repeatEndDate) requestData.repeatEndDate = fd.repeatEndDate;
    }

    if (this.data.scheduleType === 'AfterSchoolActivity') {
      if (fd.location) requestData.location = fd.location;
    }

    if (this.data.scheduleType === 'HomeworkTask') {
      requestData.dueDate = fd.dueDate;
      if (fd.suggestedStartTime) requestData.suggestedStartTime = fd.suggestedStartTime;
      if (fd.suggestedEndTime) requestData.suggestedEndTime = fd.suggestedEndTime;
    }

    if (fd.notes) requestData.notes = fd.notes;

    scheduleService.create(requestData).then(res => {
      // 清除草稿
      wx.removeStorageSync(require('../../utils/storage-keys').SCHEDULE_DRAFT);
      wx.showToast({ title: '创建成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1000);
    }).catch(err => {
      this.setData({ submitting: false });

      if (err.statusCode === 409 && err.data && err.data.hasConflict) {
        // 冲突弹窗
        this.setData({
          showConflictDialog: true,
          conflicts: err.data.conflicts || []
        });
      } else if (err.error === 'CHILD_NOT_SELECTED') {
        wx.showToast({ title: '请选择孩子', icon: 'none' });
      } else if (err.error === 'SCHEDULE_NAME_EMPTY') {
        wx.showToast({ title: '名称为空', icon: 'none' });
      } else if (err.error === 'NO_DAY_SELECTED') {
        wx.showToast({ title: '未选日期', icon: 'none' });
      } else {
        wx.showToast({ title: err.message || '创建失败，请重试', icon: 'none' });
      }
    });
  },

  /**
   * 冲突弹窗 - 继续创建
   */
  onConflictContinue() {
    this.setData({ showConflictDialog: false, ignoreConflict: true, submitting: false });
    this.onSubmit();
  },

  /**
   * 冲突弹窗 - 返回修改
   */
  onConflictBack() {
    this.setData({ showConflictDialog: false, currentStep: 3, submitting: false });
  },

  /**
   * 保存草稿
   */
  _saveDraft() {
    wx.setStorageSync(require('../../utils/storage-keys').SCHEDULE_DRAFT, {
      scheduleType: this.data.scheduleType,
      formData: this.data.formData,
      currentStep: this.data.currentStep
    });
  }
});
