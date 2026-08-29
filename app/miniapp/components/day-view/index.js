// components/day-view/index.js

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
    }
  },

  data: {
    sortedSchedules: []
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
    }
  },

  computed: {
    dateText() {
      // 通过 wxs 或 observer 设置
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
