// pages/schedule-create/index.js
// 创建日程页 —— 4 步向导 + schedule-form 子组件 + 数据校验 + 冲突检测
// 步骤：Step1 选成员 → Step2 选类型 → Step3 填字段（schedule-form） → Step4 确认

const scheduleService = require('../../services/schedule');
const dateUtils = require('../../utils/date-utils');
const STORAGE_KEYS = require('../../utils/storage-keys');
const {
  ScheduleType,
  getScheduleTypeLabel,
  UserRole,
  ErrorCodes,
  ErrorMessages
} = require('../../contracts/schedule');

// HomeworkTask 卡片默认文案：未选成员时按孩子语义「作业任务」展示，
// 选中成员后由 _updateHomeworkLabel 按角色切换到「待办事项(家长)/作业任务(孩子)」。
const HOMEWORK_DEFAULT_LABEL = getScheduleTypeLabel(ScheduleType.HomeworkTask, UserRole.Child);

Page({
  data: {
    // Step state
    currentStep: 1,
    scheduleType: '',
    stripeClass: 'activity',
    typeLabel: '',

    // Member list（含家长 + 孩子，每项 userId/role/name）
    memberList: [],
    // 当前用户角色/ID（供 member-selector 判定家长/孩子视角）
    userRole: '',
    userId: '',
    // 已选成员（受控组件 selectedIds 回传）
    selectedMemberIds: [],
    selectedMembers: [],
    homeworkTypeLabel: HOMEWORK_DEFAULT_LABEL, // HomeworkTask 卡片按选中成员角色切换「作业任务/待办事项」

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
      memberIds: [],
      startDate: ''
    },
    minDate: '',

    // Confirm
    selectedMemberNames: '',
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
      const restoredFormData = Object.assign({}, this.data.formData, draft.formData || {});
      // 旧草稿可能缺 formData.scheduleType（历史 bug 未写入），从 draft.scheduleType 回填
      if (draft.scheduleType && !restoredFormData.scheduleType) {
        restoredFormData.scheduleType = draft.scheduleType;
      }
      this.setData({
        scheduleType: draft.scheduleType || '',
        formData: restoredFormData,
        currentStep: draft.currentStep || 1
      });
    }

    this._loadMemberList();
  },

  onShow() {
    this._loadMemberList();
  },

  /**
   * 加载成员列表（家长 + 孩子）
   */
  _loadMemberList() {
    const app = this._appRef || (typeof getApp === 'function' ? getApp() : { globalData: {} });
    const gd = (app && app.globalData) || {};
    const members = gd.memberList || gd.childList || [];
    this.setData({
      memberList: members,
      userRole: gd.userRole || '',
      userId: gd.userId || ''
    });
  },

  /**
   * member-selector change 事件回调
   * detail = { memberIds, selectedMembers }
   */
  onMemberChange(e) {
    const { memberIds, selectedMembers } = e.detail || {};
    const memberIdsArr = memberIds || [];
    const selectedMembersArr = selectedMembers || [];
    this.setData({
      selectedMemberIds: memberIdsArr,
      selectedMembers: selectedMembersArr,
      selectedMemberNames: selectedMembersArr.map(m => m.name).join('、')
    });
    this._updateHomeworkLabel();
  },

  /**
   * 选中成员的角色代表（全为家长 → Parent，否则 Child）。
   * 混合关联（家长 + 孩子同时选中）时，单张 Step-2 类型卡片只能显示一个 label，
   * 回退为孩子语义「作业任务」；per-member 的精确双文案由日历/列表层的 N 行模型保证。
   */
  _representativeRole() {
    const members = this.data.selectedMembers || [];
    const allParents = members.length > 0 && members.every(m => m.role === UserRole.Parent);
    return allParents ? UserRole.Parent : UserRole.Child;
  },

  /**
   * 更新 HomeworkTask 卡片双文案（按选中成员角色）
   */
  _updateHomeworkLabel() {
    const label = getScheduleTypeLabel(ScheduleType.HomeworkTask, this._representativeRole());
    this.setData({ homeworkTypeLabel: label });
    if (this.data.scheduleType === ScheduleType.HomeworkTask) {
      this.setData({ typeLabel: label });
    }
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
      typeLabel: getScheduleTypeLabel(type, this._representativeRole()) || '',
      // 同步写入 formData.scheduleType：Step 3 的 schedule-form 通过
      // initial-values 初始化 data.scheduleType 并据此校验，缺写则校验静默失败
      'formData.scheduleType': type
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
      if (this.data.selectedMemberIds.length === 0) {
        wx.showToast({ title: ErrorMessages.MEMBER_NOT_SELECTED, icon: 'none' });
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
    this.setData({ selectedMemberNames: this.data.selectedMemberNames });

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

    const memberIds = this.data.selectedMemberIds;
    if (memberIds.length === 0) {
      wx.showToast({ title: ErrorMessages.MEMBER_NOT_SELECTED, icon: 'none' });
      return Promise.resolve();
    }

    this.setData({ submitting: true });

    const fd = this.data.formData;
    const requestData = {
      name: (fd.name || '').trim(),
      scheduleType: this.data.scheduleType,
      memberIds: memberIds,
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
      } else if (err.error === ErrorCodes.MEMBER_NOT_SELECTED || err.error === ErrorCodes.CHILD_NOT_SELECTED) {
        wx.showToast({ title: ErrorMessages.MEMBER_NOT_SELECTED, icon: 'none' });
      } else if (err.error === ErrorCodes.SCHEDULE_NAME_EMPTY) {
        wx.showToast({ title: ErrorMessages.SCHEDULE_NAME_EMPTY, icon: 'none' });
      } else if (err.error === ErrorCodes.NO_DAY_SELECTED) {
        wx.showToast({ title: ErrorMessages.NO_DAY_SELECTED, icon: 'none' });
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
   * 从模板创建入口：跳到模板列表页（action=apply 触发 use-template-dialog 弹窗而非跳详情）
   */
  onTapFromTemplate() {
    wx.navigateTo({
      url: '/pages/template-list/index?action=apply&returnTo=schedule-create'
    });
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
