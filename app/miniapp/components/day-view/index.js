// components/day-view/index.js

const dateUtils = require('../../utils/date-utils');

Component({
  properties: {
    currentDate: {
      type: String,
      value: ''
    },
    schedules: {
      type: Array,
      value: []
    },
    loading: {
      type: Boolean,
      value: false
    },
    selectedScheduleTypes: {
      type: Array,
      value: []
    }
  },

  data: {
    sortedSchedules: [],
    dateText: ''    // 空态展示用："今天" / "9月2日 周三"
  },

  observers: {
    'schedules'(schedules) {
      // 按时间排序
      const sorted = (schedules || []).slice().sort((a, b) => {
        const sa = a.startTime || '';
        const sb = b.startTime || '';
        return sa.localeCompare(sb);
      });
      this.setData({ sortedSchedules: sorted });
    },

    'currentDate'(currentDate) {
      const today = new Date();
      const dateText = currentDate && dateUtils.isSameDay(currentDate, today)
        ? '今天'
        : dateUtils.formatDateChinese(currentDate || today);
      this.setData({ dateText });
    }
  },

  methods: {
    onCardTap(e) {
      this.triggerEvent('scheduletap', e.detail);
    },

    onCheckinTap(e) {
      this.triggerEvent('checkintap', e.detail);
    },

    onCreate() {
      wx.navigateTo({
        url: '/pages/schedule-create/index'
      });
    }
  }
});
