// components/schedule-card/index.js

const { ScheduleType, getScheduleTypeLabel } = require('../../contracts/schedule');

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

  data: {
    memberName: '',
    memberAvatarUrl: ''
  },

  observers: {
    'schedule'(schedule) {
      let stripeClass = 'activity';
      if (schedule && schedule.scheduleType) {
        if (schedule.scheduleType === ScheduleType.AfterSchoolActivity) stripeClass = 'activity';
        else if (schedule.scheduleType === ScheduleType.DailyRoutine) stripeClass = 'routine';
        else if (schedule.scheduleType === ScheduleType.HomeworkTask) stripeClass = 'homework';
      }
      const typeLabel = getScheduleTypeLabel(schedule.scheduleType, schedule.assignedMemberRole) || '';
      const memberName = (schedule && (schedule.assignedMemberName || schedule.childName)) || '';
      const memberAvatarUrl = (schedule && (schedule.assignedMemberAvatarUrl || schedule.childAvatarUrl)) || '';
      this.setData({ stripeClass, typeLabel, memberName, memberAvatarUrl });
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
        date: this.data.schedule.instanceDate
      });
    }
  }
});
