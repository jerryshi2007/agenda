// components/calendar-view/index.js

Component({
  properties: {
    view: {
      type: String,
      value: 'week'  // 'month' | 'week' | 'day'
    },
    cells: {
      type: Array,
      value: []
    },
    weekDays: {
      type: Array,
      value: []
    },
    schedules: {
      type: Array,
      value: []
    },
    currentDate: {
      type: String,
      value: ''
    },
    loading: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onCellTap(e) {
      this.triggerEvent('celltap', e.detail);
    },

    onScheduleTap(e) {
      this.triggerEvent('scheduletap', e.detail);
    },

    onCheckinTap(e) {
      this.triggerEvent('checkintap', e.detail);
    }
  }
});
