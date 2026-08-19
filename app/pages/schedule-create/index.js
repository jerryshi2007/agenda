// pages/schedule-create/index.js
// 创建日程页 —— 4 步向导 + schedule-form 子组件 + 数据校验 + 冲突检测
// 步骤：Step1 选孩子 → Step2 选类型 → Step3 填字段（schedule-form） → Step4 确认

const scheduleService = require('../../services/schedule');
const dateUtils = require('../../utils/date-utils');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ScheduleType, ScheduleTypeLabels } = require('../../contracts/template');

Page({
  data: {
    // Step state
    currentStep: 1,
    scheduleType: '',
    stripeClass: 'activity',
    typeLabel: '',

    // Child list
    childList: [],

    // Form（Step 3 由 schedule-form 子组件维护，进入 Step 4 时写入此 formData）
    formData: {
      name: '',
      scheduleType: '',
      timeSlots: [],
      repeatEndDate: '',
      location: '',
      dueDate: '',
      suggestedStartTime: '',
      suggestedEndTime: '',
      notes: '',
      childIds: [],
      startDate: ''
    },
    minDate: '',

    // Confirm
    selectedChildNames: '',
    timeSlotSummary: '',

    // Conflict
    showConflictDialog: false,
    conflicts: [],
    conflictResolve: null,

    // Submit
    submitting: false,
    ignoreConflict: false
  },

  onLoad() {
    // 缓存 getApp 引用（avoid per-call global lookup; tests inject via ctx._appRef）
    this._appRef = typeof getApp === 'function' ? getApp() : null;
    const today = dateUtils.formatDate(new Date());
    this.setData({ minDate: today });

    // 恢复草稿
    const draft = wx.getStorageSync(STORAGE_KEYS.SCHEDULE_DRAFT);
    if (draft) {
      this.setData({
        scheduleType: draft.scheduleType || '',
        formData: Object.assign({}, this.data.formData, draft.formData || {}),
        currentStep: draft.currentStep || 1
      });
    }

    this._loadChildList();
  },

  onShow() {
    this._loadChildList();
  },

  /**
   * 加载孩子列表
   */
  _loadChildList() {
    const app = this._appRef || (typeof getApp === 'function' ? getApp() : { globalData: {} });
    const children = (app && app.globalData && app.globalData.childList) || [];
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
   * 切换孩子选中
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
    if (type === ScheduleType.AfterSchoolActivity) stripeClass = 'activity';
    else if (type === ScheduleType.DailyRoutine) stripeClass = 'routine';
    else if (type === ScheduleType.HomeworkTask) stripeClass = 'homework';

    this.setData({
      scheduleType: type,
      stripeClass: stripeClass,
      typeLabel: ScheduleTypeLabels[type] || ''
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
   * Step 1/2 在本页内校验
   * Step 3 委托给 schedule-form 子组件（onSubmit 触发 submit 事件）
   * Step 4 由 onSubmit 接管
   */
  onNextStep() {
    const step = this.data.currentStep;

    if (step === 1) {
      const selected = this.data.childList.filter(c => c._selected);
      if (selected.length === 0) {
        wx.showToast({ title: '请至少选择一个孩子', icon: 'none' });
        return;
      }
    } else if (step === 2) {
      if (!this.data.scheduleType) {
        wx.showToast({ title: '请选择日程类型', icon: 'none' });
        return;
      }
    } else if (step === 3) {
      // 委托给 schedule-form 子组件：触发其 submit 事件
      const formComp = this.selectComponent('#schedule-form');
      if (formComp && typeof formComp.onSubmit === 'function') {
        formComp.onSubmit();
      }
      return; // 等待 onFormSubmit 回调决定是否进入 Step 4
    }

    this.setData({ currentStep: step + 1 });

    if (step === 3) {
      this._prepareConfirm();
    }

    this._saveDraft();
  },

  /**
   * schedule-form 子组件 submit 事件回调
   * detail = { formData, valid }
   */
  onFormSubmit(e) {
    const { formData, valid } = e.detail || {};
    if (!valid) {
      // 校验失败：schedule-form 自身已显示 errors，留在 Step 3
      return;
    }
    this.setData({
      formData: Object.assign({}, this.data.formData, formData),
      currentStep: 4
    });
    this._prepareConfirm();
    this._saveDraft();
  },

  /**
   * 准备确认信息
   */
  _prepareConfirm() {
    const selected = this.data.childList.filter(c => c._selected);
    const names = selected.map(c => c.childName || c.name).join('、');
    this.setData({ selectedChildNames: names });

    if (this.data.scheduleType !== ScheduleType.HomeworkTask) {
      const summary = dateUtils.toRepeatRuleText(this.data.formData.timeSlots);
      this.setData({ timeSlotSummary: summary || '未设置' });
    }
  },

  /**
   * 提交创建
   */
  onSubmit() {
    if (this.data.submitting) return Promise.resolve();
    if (this.data.currentStep < 4) return Promise.resolve();

    const selected = this.data.childList.filter(c => c._selected);
    if (selected.length === 0) {
      wx.showToast({ title: '请至少选择一个孩子', icon: 'none' });
      return Promise.resolve();
    }

    this.setData({ submitting: true });

    const fd = this.data.formData;
    const requestData = {
      name: (fd.name || '').trim(),
      scheduleType: this.data.scheduleType,
      childIds: selected.map(c => c.userId || c.childId),
      ignoreConflict: this.data.ignoreConflict
    };

    if (this.data.scheduleType !== ScheduleType.HomeworkTask) {
      if (fd.timeSlots && fd.timeSlots.length) requestData.timeSlots = fd.timeSlots;
      if (fd.repeatEndDate) requestData.repeatEndDate = fd.repeatEndDate;
    }

    if (this.data.scheduleType === ScheduleType.AfterSchoolActivity) {
      if (fd.location) requestData.location = fd.location;
    }

    if (this.data.scheduleType === ScheduleType.HomeworkTask) {
      if (fd.dueDate) requestData.dueDate = fd.dueDate;
      if (fd.suggestedStartTime) requestData.suggestedStartTime = fd.suggestedStartTime;
      if (fd.suggestedEndTime) requestData.suggestedEndTime = fd.suggestedEndTime;
    }

    if (fd.notes) requestData.notes = fd.notes;

    return scheduleService.create(requestData).then(() => {
      wx.removeStorageSync(STORAGE_KEYS.SCHEDULE_DRAFT);
      wx.showToast({ title: '创建成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1000);
    }).catch(err => {
      this.setData({ submitting: false });

      if (err.statusCode === 409 && err.data && err.data.hasConflict) {
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
   * 跳转家庭管理
   */
  onGoFamily() {
    wx.showToast({ title: '家庭管理模块待开发', icon: 'none' });
  },

  /**
   * 保存草稿
   */
  _saveDraft() {
    wx.setStorageSync(STORAGE_KEYS.SCHEDULE_DRAFT, {
      scheduleType: this.data.scheduleType,
      formData: this.data.formData,
      currentStep: this.data.currentStep
    });
  }
});
