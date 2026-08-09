// components/filter-bar/index.js

Component({
  properties: {
    selectedChildId: {
      type: String,
      value: '',
      observer: '_updateLabels'
    },
    selectedChildName: {
      type: String,
      value: ''
    },
    selectedScheduleTypes: {
      type: Array,
      value: [],
      observer: '_updateLabels'
    },
    childList: {
      type: Array,
      value: []
    }
  },

  data: {
    typesCount: 0,
    typesLabel: ''
  },

  methods: {
    _updateLabels() {
      const types = this.data.selectedScheduleTypes || [];
      let label = '';
      if (types.length === 1) {
        if (types[0] === 'AfterSchoolActivity') label = '课后活动';
        else if (types[0] === 'DailyRoutine') label = '日常作息';
        else if (types[0] === 'HomeworkTask') label = '作业任务';
      } else if (types.length >= 3) {
        label = '全部类型';
      }
      this.setData({ typesCount: types.length, typesLabel: label });
    },

    onChildFilterTap() {
      this.triggerEvent('childfiltertap');
    },

    onTypeFilterTap() {
      this.triggerEvent('typefiltertap');
    }
  }
});
