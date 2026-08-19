// components/use-template-dialog/index.js
// 使用模板弹窗组件 —— 选择孩子 + 起始日期 + 可覆盖名称/备注，提交后调 template.apply

const templateService = require('../../services/template');
const dateUtils = require('../../utils/date-utils');
const { ScheduleTypeLabels, ErrorMessages } = require('../../contracts/template');

Component({
  properties: {
    template: {
      type: Object,
      value: null
    },
    visible: {
      type: Boolean,
      value: false
    }
  },

  data: {
    showDialog: false,
    childId: '',
    childName: '',
    hasNoChild: false,
    startDate: '',
    minDate: '',
    overrideName: '',
    overrideNotes: '',
    scheduleTypeLabel: '',
    timeSlotSummary: '',
    submitting: false
  },

  lifetimes: {
    attached() {
      this._appRef = typeof getApp === 'function' ? getApp() : null;
      this.setData({ showDialog: !!this.properties.visible });
      this._initializeFromTemplate();
    }
  },

  observers: {
    'visible': function (val) {
      this.setData({ showDialog: !!val });
      if (val) {
        this._initializeFromTemplate();
      }
    },
    'template': function () {
      this._initializeFromTemplate();
    }
  },

  methods: {
    /**
     * 从 template 初始化 childId / startDate / override 字段
     */
    _initializeFromTemplate() {
      const app = this._appRef || (typeof getApp === 'function' ? getApp() : { globalData: {} });
      const children = (app && app.globalData && app.globalData.childList) || [];
      const first = children[0];
      const template = this.properties.template || {};
      const today = dateUtils.formatDate(new Date());
      const timeSlotSummary = template.timeSlots && template.timeSlots.length
        ? dateUtils.toRepeatRuleText(template.timeSlots)
        : '';

      this.setData({
        minDate: today,
        startDate: today,
        childId: first ? (first.userId || first.childId) : '',
        childName: first ? (first.childName || first.name) : '',
        hasNoChild: !first,
        overrideName: template.name || '',
        overrideNotes: template.notes || '',
        scheduleTypeLabel: ScheduleTypeLabels[template.scheduleType] || '',
        timeSlotSummary: timeSlotSummary || '未设置'
      });
    },

    /**
     * 关闭弹窗
     */
    onClose() {
      this.setData({ showDialog: false });
      this.triggerEvent('close');
    },

    /**
     * 切换孩子
     */
    onSelectChild(e) {
      const { childId, childName } = e.currentTarget.dataset;
      this.setData({
        childId: childId,
        childName: childName
      });
    },

    /**
     * 起始日期变更
     */
    onDateChange(e) {
      this.setData({ startDate: e.detail.value });
    },

    /**
     * 名称覆盖输入
     */
    onNameInput(e) {
      this.setData({ overrideName: e.detail.value });
    },

    /**
     * 备注覆盖输入
     */
    onNotesInput(e) {
      this.setData({ overrideNotes: e.detail.value });
    },

    /**
     * 提交：调 template.apply
     */
    onConfirm() {
      if (this.data.submitting) return Promise.resolve();

      if (!this.data.childId) {
        wx.showToast({ title: '请先选择孩子', icon: 'none' });
        return Promise.resolve();
      }
      if (!this.data.startDate) {
        wx.showToast({ title: '请选择起始日期', icon: 'none' });
        return Promise.resolve();
      }

      this.setData({ submitting: true });

      const template = this.properties.template || {};
      const requestData = {
        childId: this.data.childId,
        startDate: this.data.startDate
      };
      // 可选覆盖字段：仅在用户实际修改时透传（避免无意义覆盖）
      if (this.data.overrideName && this.data.overrideName !== template.name) {
        requestData.name = this.data.overrideName.trim();
      }
      if (this.data.overrideNotes && this.data.overrideNotes !== (template.notes || '')) {
        requestData.notes = this.data.overrideNotes.trim();
      }

      return templateService.apply(template.templateId, requestData)
        .then(res => {
          this.setData({ submitting: false, showDialog: false });
          const data = (res && res.data) || {};
          this.triggerEvent('success', {
            scheduleId: data.scheduleId,
            groupKey: data.groupKey
          });
        })
        .catch(err => {
          this.setData({ submitting: false });
          // 错误码 → 中文提示优先取契约 ErrorMessages
          const code = err && err.error;
          const message = (code && ErrorMessages[code]) || (err && err.message) || '生成失败，请重试';
          wx.showToast({ title: message, icon: 'none' });
        });
    }
  }
});
