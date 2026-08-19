// pages/schedule-edit/index.js
// 编辑日程页 —— 复用 schedule-form 子组件 + editScope + 乐观锁

const scheduleService = require('../../services/schedule');
const dateUtils = require('../../utils/date-utils');
const { ScheduleType, ScheduleTypeLabels } = require('../../contracts/template');

Page({
  data: {
    scheduleId: '',
    scheduleType: '',
    isHomework: false,
    editScope: 'ThisOnly',    // 'ThisOnly' | 'ThisAndFuture'
    targetDate: '',
    rowVersion: '',

    // Form（schedule-form 子组件内部维护，进入"待保存"态时同步写入此 formData）
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
    typeLabel: '',
    minDate: '',

    saving: false
  },

  onLoad(options) {
    const { scheduleId, date } = options || {};
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
        const d = (res && res.data) || {};
        const isHomework = d.scheduleType === ScheduleType.HomeworkTask;
        this.setData({
          scheduleType: d.scheduleType || '',
          isHomework: isHomework,
          typeLabel: ScheduleTypeLabels[d.scheduleType] || '',
          rowVersion: d.rowVersion || '',
          formData: {
            name: d.name || '',
            scheduleType: d.scheduleType || '',
            timeSlots: d.timeSlots || [],
            repeatEndDate: d.repeatEndDate || '',
            location: d.location || '',
            dueDate: d.dueDate || '',
            suggestedStartTime: d.suggestedStartTime || '',
            suggestedEndTime: d.suggestedEndTime || '',
            notes: d.notes || '',
            childIds: d.childIds || [],
            startDate: d.startDate || ''
          }
        });
      })
      .catch(err => {
        if (err && err.data && err.data.error === 'SCHEDULE_NOT_FOUND') {
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
   * schedule-form 子组件 submit 事件回调
   * 仅做缓存（onSave 走 selectComponent 直接读 form data 并调 API）
   */
  onFormSubmit(e) {
    const { formData, valid } = e.detail || {};
    if (!valid) {
      // 校验失败：保留原 formData，schedule-form 自身已显示 errors
      return;
    }
    this.setData({ formData: Object.assign({}, this.data.formData, formData) });
  },

  /**
   * 保存按钮：先同步 form 最新数据到页面，再调 API
   * 走 selectComponent 直接读 form.data.formData（覆盖用户在 form 中未触发 submit 的修改）
   * 走 form._validate() 校验
   */
  onSave() {
    if (this.data.saving) return Promise.resolve();
    const formComp = this.selectComponent('#schedule-form');
    if (formComp) {
      if (typeof formComp._validate === 'function' && !formComp._validate()) {
        return Promise.resolve();
      }
      const formData = formComp.data && formComp.data.formData;
      if (formData) {
        this.setData({ formData: Object.assign({}, this.data.formData, formData) });
      }
    }
    return this._callUpdateAPI();
  },

  /**
   * 调 scheduleService.update
   */
  _callUpdateAPI() {
    if (this.data.saving) return Promise.resolve();

    this.setData({ saving: true });

    const fd = this.data.formData;
    const isHomework = this.data.isHomework;
    const requestData = {
      scope: this.data.editScope,
      date: this.data.targetDate,
      name: (fd.name || '').trim(),
      rowVersion: this.data.rowVersion
    };

    if (!isHomework) {
      if (fd.timeSlots && fd.timeSlots.length) requestData.timeSlots = fd.timeSlots;
      if (fd.repeatEndDate) requestData.repeatEndDate = fd.repeatEndDate;
      if (fd.location) requestData.location = fd.location;
    }

    if (isHomework) {
      if (fd.dueDate) requestData.dueDate = fd.dueDate;
      if (fd.suggestedStartTime) requestData.suggestedStartTime = fd.suggestedStartTime;
      if (fd.suggestedEndTime) requestData.suggestedEndTime = fd.suggestedEndTime;
    }

    if (fd.notes) requestData.notes = fd.notes;

    return scheduleService.update(this.data.scheduleId, requestData)
      .then(() => {
        wx.showToast({ title: '保存成功', icon: 'success' });
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
          wx.showToast({ title: (err && err.message) || '保存失败，请刷新重试', icon: 'none' });
        }
      });
  }
});
