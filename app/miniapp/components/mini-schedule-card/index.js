// components/mini-schedule-card/index.js
// 周视图迷你卡片 —— 颜色条 + 时间 + 名称 + 头像 + 完成状态图标（紧凑，7 列网格用）

const { ScheduleType } = require('../../contracts/schedule');

Component({
  properties: {
    schedule: {
      type: Object,
      value: {}
    }
  },

  data: {
    stripeClass: 'activity',
    timeText: '',
    memberName: '',
    memberInitial: '',
    statusKey: '' // 'completed' | 'incomplete' | 'cancelled' | 'overdue' | ''
  },

  observers: {
    'schedule'(schedule) {
      let stripeClass = 'activity';
      if (schedule && schedule.scheduleType) {
        if (schedule.scheduleType === ScheduleType.AfterSchoolActivity) stripeClass = 'activity';
        else if (schedule.scheduleType === ScheduleType.DailyRoutine) stripeClass = 'routine';
        else if (schedule.scheduleType === ScheduleType.HomeworkTask) stripeClass = 'homework';
      }

      let timeText = '';
      if (schedule && schedule.startTime && schedule.endTime) {
        timeText = `${schedule.startTime} - ${schedule.endTime}`;
      } else if (schedule && schedule.dueDate) {
        timeText = `截止 ${schedule.dueDate}`;
      }

      const memberName = (schedule && (schedule.assignedMemberName || schedule.childName)) || '';
      const memberInitial = memberName ? memberName.charAt(0) : '';

      const statusKey = schedule && schedule.status
        ? String(schedule.status).toLowerCase()
        : '';

      this.setData({ stripeClass, timeText, memberName, memberInitial, statusKey });
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
