// components/week-view/index.js

Component({
  properties: {
    weekDays: {
      type: Array,
      value: []
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

  methods: {
    onWeekDayTap(e) {
      const { date } = e.currentTarget.dataset;
      this.triggerEvent('daytap', { date });
    },

    onCardTap(e) {
      this.triggerEvent('scheduletap', e.detail);
    },

    onCheckinTap(e) {
      this.triggerEvent('checkintap', e.detail);
    }
  }
});
