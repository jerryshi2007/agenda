// components/schedule-form/index.js
// 日程/模板共用表单组件 —— 4 mode (create/edit/template-create/template-edit)
// mode 控制是否显示 childSelector / startDate / scheduleTypeLocked
// 内部维护 formData + 校验状态，submit 事件 detail = { formData, valid }

const { ScheduleType, ScheduleTypeLabels } = require('../../contracts/template');
const dateUtils = require('../../utils/date-utils');

const TYPE_LABELS = ScheduleTypeLabels;

const DEFAULT_FORM_DATA = {
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
};

Component({
  properties: {
    mode: {
      type: String,
      value: 'create'  // 'create' | 'edit' | 'template-create' | 'template-edit'
    },
    initialValues: {
      type: Object,
      value: null
    },
    childSelectorVisible: {
      type: Boolean,
      value: true
    },
    startDateVisible: {
      type: Boolean,
      value: true
    },
    scheduleTypeLocked: {
      type: Boolean,
      value: false
    }
  },

  data: {
    scheduleType: '',
    stripeClass: 'activity',
    typeLabel: '',
    formData: Object.assign({}, DEFAULT_FORM_DATA),
    errors: {},
    minDate: '',
    childList: []
  },

  lifetimes: {
    attached() {
      // 缓存 getApp() 引用（avoid per-call global lookup; tests need a stable handle）
      this._appRef = typeof getApp === 'function' ? getApp() : null;
      this._initialize();
    }
  },

  observers: {
    'initialValues': function (val) {
      if (val) {
        this._initialize();
      }
    }
  },

  methods: {
    /**
     * 初始化：根据 initialValues + props 填充 data
     */
    _initialize() {
      const props = this.properties || this.data;
      const initial = props.initialValues || {};
      const scheduleType = initial.scheduleType || '';
      const formData = Object.assign({}, DEFAULT_FORM_DATA, initial);

      const today = dateUtils.formatDate(new Date());
      const childList = this._buildChildList(formData.childIds || []);

      this.setData({
        scheduleType: scheduleType,
        typeLabel: TYPE_LABELS[scheduleType] || '',
        stripeClass: _typeToStripeClass(scheduleType),
        formData: formData,
        minDate: today,
        childList: childList,
        errors: {}
      });
    },

    /**
     * 构建 childList（带 _selected 标记）
     */
    _buildChildList(selectedIds) {
      const app = this._appRef || (typeof getApp === 'function' ? getApp() : { globalData: {} });
      const children = (app && app.globalData && app.globalData.childList) || [];
      const sel = Array.isArray(selectedIds) ? selectedIds : [];
      return children.map((c, i) => ({
        userId: c.userId || c.childId,
        childName: c.childName || c.name,
        _color: ['#10AEFF', '#FF9500', '#07C160', '#FA5151'][i % 4],
        _selected: sel.indexOf(c.userId || c.childId) >= 0
      }));
    },

    /**
     * 重新加载 childList（外部更新 globalData.childList 后调用）
     */
    _loadChildList() {
      const selectedIds = (this.data.formData.childIds || []).slice();
      this.setData({ childList: this._buildChildList(selectedIds) });
    },

    /**
     * 选择类型
     */
    onSelectType(e) {
      if (this.properties.scheduleTypeLocked) return;
      const type = e.currentTarget.dataset.type;
      this.setData({
        scheduleType: type,
        typeLabel: TYPE_LABELS[type] || '',
        stripeClass: _typeToStripeClass(type),
        // 同步写入 formData
        'formData.scheduleType': type
      });
      // 切换类型时清除 timeSlots 错误
      if (this.data.errors.timeSlots) {
        this.setData({ 'errors.timeSlots': '' });
      }
    },

    /**
     * 通用文本字段输入
     */
    onFieldInput(e) {
      const { field } = e.currentTarget.dataset;
      const value = e.detail.value;
      this._setFormField(field, value);
    },

    /**
     * 日期选择
     */
    onDateChange(e) {
      const { field } = e.currentTarget.dataset;
      this._setFormField(field, e.detail.value);
    },

    /**
     * 时间选择
     */
    onTimeChange(e) {
      const { field } = e.currentTarget.dataset;
      this._setFormField(field, e.detail.value);
    },

    /**
     * 时间槽变更（time-slot-picker 子组件事件）
     */
    onTimeSlotChange(e) {
      this._setFormField('timeSlots', e.detail.timeSlots || []);
      if (this.data.errors.timeSlots) {
        this.setData({ 'errors.timeSlots': '' });
      }
    },

    /**
     * 切换孩子选中
     */
    onToggleChild(e) {
      const { index } = e.currentTarget.dataset;
      const childList = this.data.childList;
      childList[index]._selected = !childList[index]._selected;
      // 同步 formData.childIds
      const childIds = childList.filter(c => c._selected).map(c => c.userId);
      this.setData({
        childList: childList,
        'formData.childIds': childIds
      });
      if (this.data.errors.childIds) {
        this.setData({ 'errors.childIds': '' });
      }
    },

    /**
     * 设置 formData 字段（同时清除该字段错误）
     */
    _setFormField(field, value) {
      this.setData({ [`formData.${field}`]: value });
      if (this.data.errors[field]) {
        this.setData({ [`errors.${field}`]: '' });
      }
    },

    /**
     * 校验
     * @returns {boolean} valid
     */
    _validate() {
      const errors = {};
      const fd = this.data.formData;
      const type = this.data.scheduleType;

      // Name: 必填 1-50 字符
      if (!fd.name || !String(fd.name).trim()) {
        errors.name = '请输入名称';
      } else if (String(fd.name).length > 50) {
        errors.name = '名称长度不超过50个字符';
      }

      // ScheduleType: 必选
      if (!type) {
        errors.scheduleType = '请选择类型';
      }

      // TimeSlots: 按 type 校验
      if (type === ScheduleType.HomeworkTask) {
        if (fd.timeSlots && fd.timeSlots.length > 0) {
          errors.timeSlots = '作业任务不能配置时间槽';
        }
        // dueDate 必填
        if (!fd.dueDate) {
          errors.dueDate = '请选择截止日期';
        } else if (fd.dueDate < this.data.minDate) {
          errors.dueDate = '截止日期不能早于今天';
        }
      } else if (type === ScheduleType.AfterSchoolActivity || type === ScheduleType.DailyRoutine) {
        if (!fd.timeSlots || fd.timeSlots.length === 0) {
          errors.timeSlots = '请至少选择一天';
        }
      }

      // ChildIds（childSelectorVisible=true 时必选）
      if (this.properties.childSelectorVisible) {
        if (!fd.childIds || fd.childIds.length === 0) {
          errors.childIds = '请至少选择一个孩子';
        }
      }

      // StartDate（startDateVisible=true 时必选）
      if (this.properties.startDateVisible) {
        if (!fd.startDate) {
          errors.startDate = '请选择起始日期';
        } else if (fd.startDate < this.data.minDate) {
          errors.startDate = '起始日期不能早于今天';
        }
      }

      this.setData({ errors });
      return Object.keys(errors).length === 0;
    },

    /**
     * 提交：触发 submit 事件，detail = { formData, valid }
     */
    onSubmit() {
      const valid = this._validate();
      this.triggerEvent('submit', {
        formData: this.data.formData,
        valid: valid
      });
    }
  }
});

/**
 * 工具函数：ScheduleType → 样式 stripeClass
 */
function _typeToStripeClass(type) {
  if (type === ScheduleType.AfterSchoolActivity) return 'activity';
  if (type === ScheduleType.DailyRoutine) return 'routine';
  if (type === ScheduleType.HomeworkTask) return 'homework';
  return 'activity';
}
