// components/schedule-card/index.js

const TYPE_LABELS = {
  'AfterSchoolActivity': '课后活动',
  'DailyRoutine': '日常作息',
  'HomeworkTask': '作业任务'
};

Component({
  properties: {
    schedule: {
      type: Object,
      value: {}
    },
    viewType: {
      type: String,
      value: 'week'  // 'week' | 'day'
    }
  },

  computed: {
    stripeClass() {
      const t = (this.data.schedule && this.data.schedule.scheduleType) || '';
      if (t === 'AfterSchoolActivity') return 'activity';
      if (t === 'DailyRoutine') return 'routine';
      if (t === 'HomeworkTask') return 'homework';
      return 'activity';
    },

    typeLabel() {
      return TYPE_LABELS[this.data.schedule.scheduleType] || '';
    }
  },

  observers: {
    'schedule'(schedule) {
      let stripeClass = 'activity';
      if (schedule && schedule.scheduleType) {
        if (schedule.scheduleType === 'AfterSchoolActivity') stripeClass = 'activity';
        else if (schedule.scheduleType === 'DailyRoutine') stripeClass = 'routine';
        else if (schedule.scheduleType === 'HomeworkTask') stripeClass = 'homework';
      }
      const typeLabel = TYPE_LABELS[schedule.scheduleType] || '';
      this.setData({ stripeClass, typeLabel });
    }
  },

  methods: {
    onCardTap() {
      this.triggerEvent('cardtap', {
        scheduleId: this.data.schedule.scheduleId,
        date: this.data.schedule.instanceDate
      });
    },

    onCheckinTap() {
      this.triggerEvent('checkintap', {
        scheduleId: this.data.schedule.scheduleId,
        date: this.data.schedule.instanceDate,
        childId: this.data.schedule.childId
      });
    }
  }
});
