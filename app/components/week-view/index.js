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
    onCardTap(e) {
      this.triggerEvent('scheduletap', e.detail);
    },

    onCheckinTap(e) {
      this.triggerEvent('checkintap', e.detail);
    }
  }
});
