// components/schedule-card/index.js

const { ScheduleType, getScheduleTypeLabel } = require('../../contracts/schedule');
const api = require('../../services/api');

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
    memberAvatarUrl: '',
    statusKey: '',   // completed / incomplete / cancelled / overdue（归一化小写）
    timeText: ''     // "16:00 - 16:30" / "16:00" / "截止 2026-09-05"
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
      const memberAvatarUrl = api.resolveAssetUrl(
        (schedule && (schedule.assignedMemberAvatarUrl || schedule.childAvatarUrl)) || ''
      );

      // 状态 key：归一化大小写（Completed → completed）
      let statusKey = (schedule && schedule.status) || '';
      if (statusKey) {
        statusKey = statusKey.charAt(0).toLowerCase() + statusKey.slice(1);
      }

      // 时间文本：优先起止时间范围，其次截止日期（作业任务），再次仅开始时间
      let timeText = '';
      if (schedule && schedule.startTime && schedule.endTime) {
        timeText = `${schedule.startTime} - ${schedule.endTime}`;
      } else if (schedule && schedule.dueDate) {
        timeText = `截止 ${schedule.dueDate}`;
      } else if (schedule && schedule.startTime) {
        timeText = schedule.startTime;
      }

      this.setData({ stripeClass, typeLabel, memberName, memberAvatarUrl, statusKey, timeText });
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
