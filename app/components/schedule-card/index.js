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

      // 时间列：优先时间段（起/止两行），其次截止日期（日期 + "截止"标签）
      let timeMain = '';
      let timeSub = '';
      if (schedule && schedule.startTime && schedule.endTime) {
        timeMain = schedule.startTime;
        timeSub = schedule.endTime;
      } else if (schedule && schedule.dueDate) {
        timeMain = schedule.dueDate;
        timeSub = '截止';
      } else if (schedule && schedule.startTime) {
        timeMain = schedule.startTime;
        timeSub = '';
      }

      this.setData({ stripeClass, typeLabel, memberName, memberAvatarUrl, timeMain, timeSub });
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
