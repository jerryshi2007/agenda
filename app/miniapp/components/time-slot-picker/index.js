// components/time-slot-picker/index.js

const DAY_CONFIG = [
  { dayOfWeek: 0, dayLabel: '日', dayName: '周日', isWeekend: true },
  { dayOfWeek: 1, dayLabel: '一', dayName: '周一', isWeekend: false },
  { dayOfWeek: 2, dayLabel: '二', dayName: '周二', isWeekend: false },
  { dayOfWeek: 3, dayLabel: '三', dayName: '周三', isWeekend: false },
  { dayOfWeek: 4, dayLabel: '四', dayName: '周四', isWeekend: false },
  { dayOfWeek: 5, dayLabel: '五', dayName: '周五', isWeekend: false },
  { dayOfWeek: 6, dayLabel: '六', dayName: '周六', isWeekend: true }
];

Component({
  properties: {
    timeSlots: {
      type: Array,
      value: [],
      observer: '_onTimeSlotsChange'
    }
  },

  data: {
    dayList: [],
    defaultStartTime: '16:00',
    defaultEndTime: '17:00',
    selectedCount: 0,
    showTunePanel: false,
    error: ''
  },

  lifetimes: {
    attached() {
      this._initDayList();
    }
  },

  methods: {
    _initDayList() {
      const dayList = DAY_CONFIG.map(d => ({
        ...d,
        _selected: false,
        _customStart: '',
        _customEnd: ''
      }));

      // 从现有 timeSlots 恢复选中状态
      if (this.data.timeSlots && this.data.timeSlots.length > 0) {
        const slots = this.data.timeSlots;
        slots.forEach(slot => {
          const dayIndex = dayList.findIndex(d => d.dayOfWeek === slot.dayOfWeek);
          if (dayIndex >= 0) {
            dayList[dayIndex]._selected = true;
            dayList[dayIndex]._customStart = slot.startTime || '';
            dayList[dayIndex]._customEnd = slot.endTime || '';
          }
        });
        if (slots[0]) {
          this.setData({
            defaultStartTime: slots[0].startTime || '16:00',
            defaultEndTime: slots[0].endTime || '17:00'
          });
        }
      }

      const selectedCount = dayList.filter(d => d._selected).length;
      this.setData({ dayList, selectedCount });
    },

    _onTimeSlotsChange(newVal) {
      if (newVal && newVal.length > 0) {
        this._initDayList();
      }
    },

    /**
     * 选择/取消选择某天
     */
    onToggleDay(e) {
      const { index } = e.currentTarget.dataset;
      const dayList = this.data.dayList;
      dayList[index]._selected = !dayList[index]._selected;
      const selectedCount = dayList.filter(d => d._selected).length;
      this.setData({ dayList, selectedCount });
      this._emitChange();
    },

    /**
     * 默认开始时间变更
     */
    onStartTimeChange(e) {
      this.setData({ defaultStartTime: e.detail.value });
      this._emitChange();
    },

    /**
     * 默认结束时间变更
     */
    onEndTimeChange(e) {
      this.setData({ defaultEndTime: e.detail.value });
      this._emitChange();
    },

    /**
     * 逐天微调开始时间
     */
    onTuneStart(e) {
      const { index } = e.currentTarget.dataset;
      const dayList = this.data.dayList;
      dayList[index]._customStart = e.detail.value;
      this.setData({ dayList });
      this._emitChange();
    },

    /**
     * 逐天微调结束时间
     */
    onTuneEnd(e) {
      const { index } = e.currentTarget.dataset;
      const dayList = this.data.dayList;
      dayList[index]._customEnd = e.detail.value;
      this.setData({ dayList });
      this._emitChange();
    },

    /**
     * 展开/收起逐天微调面板
     */
    onToggleTunePanel() {
      this.setData({ showTunePanel: !this.data.showTunePanel });
    },

    /**
     * 构建并触发 timeSlots 变更事件
     */
    _emitChange() {
      const timeSlots = [];
      const errors = [];

      this.data.dayList.forEach(d => {
        if (!d._selected) return;
        const start = d._customStart || this.data.defaultStartTime;
        const end = d._customEnd || this.data.defaultEndTime;

        if (!start || !end) {
          errors.push(`${d.dayName}时间不完整`);
          return;
        }

        if (start >= end) {
          errors.push(`${d.dayName}开始时间需早于结束时间`);
          return;
        }

        timeSlots.push({
          dayOfWeek: d.dayOfWeek,
          startTime: start,
          endTime: end
        });
      });

      this.setData({ error: errors.length > 0 ? errors[0] : '' });
      this.triggerEvent('timeslotchange', { timeSlots });
    }
  }
});
