// pages/index/index.js
// 日历首页 —— 视图切换、数据获取、手势交互、筛选联动

const calendarService = require('../../services/calendar');
const scheduleService = require('../../services/schedule');
const checkinService = require('../../services/checkin');
const dateUtils = require('../../utils/date-utils');
const app = getApp();

Page({
  data: {
    currentView: 'week',       // 'month' | 'week' | 'day'
    currentDate: '',           // yyyy-MM-dd
    navTitle: '',              // 导航栏标题
    selectedChildId: null,
    selectedChildName: '',
    selectedScheduleTypes: [],
    selectedTypeLabel: '',
    monthCells: [],            // 月视图 42 格数据
    weekDays: [],              // 周视图 7 天数据
    schedules: [],             // 当前视图的日程列表
    loading: true,
    error: false,
    isEmpty: false,

    // 手势防抖
    _lastSwipeTime: 0,

    // 子组件数据
    childList: []
  },

  onLoad() {
    // 恢复全局日历状态
    const state = app.globalData.calendarState;
    this.setData({
      currentView: state.currentView || 'week',
      currentDate: state.currentDate || dateUtils.formatDate(new Date()),
      selectedChildId: state.selectedChildId || null,
      selectedScheduleTypes: state.selectedScheduleTypes || []
    });
    this.setData({ navTitle: this._buildNavTitle() });
  },

  onShow() {
    // 每次显示时恢复状态 + 刷新数据
    const state = app.globalData.calendarState;
    const needsRefresh = this.data.currentView !== state.currentView ||
                         this.data.currentDate !== state.currentDate ||
                         this.data.selectedChildId !== state.selectedChildId ||
                         JSON.stringify(this.data.selectedScheduleTypes) !== JSON.stringify(state.selectedScheduleTypes);

    this.setData({
      currentView: state.currentView || this.data.currentView,
      currentDate: state.currentDate || this.data.currentDate,
      selectedChildId: state.selectedChildId,
      selectedScheduleTypes: state.selectedScheduleTypes || []
    });

    if (needsRefresh || this.data.schedules.length === 0) {
      this._fetchData();
    }
    this.setData({ navTitle: this._buildNavTitle() });
    this._updateSelectedLabels();
  },

  onHide() {
    app.updateCalendarState({
      currentView: this.data.currentView,
      currentDate: this.data.currentDate,
      selectedChildId: this.data.selectedChildId,
      selectedScheduleTypes: this.data.selectedScheduleTypes
    });
  },

  /**
   * 日期范围触底加载（上下滑动加载更多日期）
   * 左右滑动手势
   */
  onTouchStart(e) {
    this._touchStartX = e.touches[0].pageX;
  },

  onTouchEnd(e) {
    const now = Date.now();
    if (now - this.data._lastSwipeTime < 300) return; // 300ms 防抖

    const deltaX = e.changedTouches[0].pageX - this._touchStartX;
    if (Math.abs(deltaX) < 50) return; // 最小滑动距离

    this.data._lastSwipeTime = now;
    if (deltaX > 0) {
      this.onPrev();
    } else {
      this.onNext();
    }
  },

  /**
   * 视图切换
   */
  onSwitchView(e) {
    const view = e.currentTarget.dataset.view;
    if (view === this.data.currentView) return;

    app.updateCalendarState({ currentView: view });
    this.setData({ currentView: view, loading: true, error: false });
    this.setData({ navTitle: this._buildNavTitle() });
    this._fetchData();
  },

  /**
   * 上一周期
   */
  onPrev() {
    const cur = dateUtils.toDate(this.data.currentDate);
    let newDate;
    if (this.data.currentView === 'month') {
      newDate = dateUtils.addMonths(cur, -1);
    } else if (this.data.currentView === 'week') {
      newDate = dateUtils.addDays(cur, -7);
    } else {
      newDate = dateUtils.addDays(cur, -1);
    }
    this._jumpToDate(newDate);
  },

  /**
   * 下一周期
   */
  onNext() {
    const cur = dateUtils.toDate(this.data.currentDate);
    let newDate;
    if (this.data.currentView === 'month') {
      newDate = dateUtils.addMonths(cur, 1);
    } else if (this.data.currentView === 'week') {
      newDate = dateUtils.addDays(cur, 7);
    } else {
      newDate = dateUtils.addDays(cur, 1);
    }
    this._jumpToDate(newDate);
  },

  /**
   * 回到今天
   */
  onToday() {
    this._jumpToDate(new Date());
  },

  /**
   * 日期选择器
   */
  onDatePicker() {
    const that = this;
    const fields = this.data.currentView === 'month' ? 'month' : 'day';
    wx.showModal({
      title: '选择日期',
      content: '使用微信原生日期选择器',
      showCancel: true
    });
    // 实际应调用 wx 日期选择器或自定义日历
  },

  /**
   * 点击月视图日期格 → 跳转日视图
   */
  onMonthCellTap(e) {
    const { date, current } = e.detail;
    app.updateCalendarState({
      currentView: 'day',
      currentDate: date
    });
    this.setData({
      currentView: 'day',
      currentDate: date,
      loading: true
    });
    this.setData({ navTitle: this._buildNavTitle() });
    this._fetchData();
  },

  /**
   * 点击日程卡片 → 跳转详情
   */
  onScheduleTap(e) {
    const { scheduleId } = e.detail;
    const date = this.data.currentDate;
    wx.navigateTo({
      url: `/pages/schedule-detail/index?scheduleId=${scheduleId}&date=${date}`
    });
  },

  /**
   * 快捷打卡（日/周视图卡片上）
   */
  onQuickCheckin(e) {
    const { scheduleId, date } = e.detail;

    checkinService.checkin(scheduleId, date).then(() => {
      wx.showToast({ title: '打卡成功', icon: 'success', duration: 1500 });
      this._fetchData(); // 刷新视图
    }).catch(err => {
      wx.showToast({ title: err.message || '打卡失败', icon: 'none' });
    });
  },

  /**
   * 孩子筛选
   */
  onChildFilter() {
    const that = this;
    const items = ['全部孩子'];
    const childList = app.globalData.childList || [];
    const names = childList.map(c => c.childName || c.name);
    items.push(...names);

    wx.showActionSheet({
      itemList: items,
      success(res) {
        let childId = null;
        let childName = '';
        if (res.tapIndex > 0) {
          const child = childList[res.tapIndex - 1];
          childId = child.childId || child.userId;
          childName = child.childName || child.name;
        }
        app.updateCalendarState({ selectedChildId: childId });
        that.setData({
          selectedChildId: childId,
          selectedChildName: childName,
          loading: true,
          error: false
        });
        that._fetchData();
      }
    });
  },

  /**
   * 类型筛选
   */
  onTypeFilter() {
    const that = this;
    wx.showActionSheet({
      itemList: ['全部类型', '课后活动', '日常作息', '作业任务'],
      success(res) {
        let types = [];
        let label = '';
        switch (res.tapIndex) {
          case 1: types = ['AfterSchoolActivity']; label = '课后活动'; break;
          case 2: types = ['DailyRoutine']; label = '日常作息'; break;
          case 3: types = ['HomeworkTask']; label = '作业任务'; break;
          default: types = []; label = '';
        }
        app.updateCalendarState({ selectedScheduleTypes: types });
        that.setData({
          selectedScheduleTypes: types,
          selectedTypeLabel: label,
          loading: true,
          error: false
        });
        that._fetchData();
      }
    });
  },

  /**
   * 重试
   */
  onRetry() {
    this.setData({ loading: true, error: false });
    this._fetchData();
  },

  /**
   * 跳转创建页
   */
  onCreate() {
    wx.navigateTo({
      url: '/pages/schedule-create/index'
    });
  },

  /**
   * 跳转到指定日期
   */
  _jumpToDate(date) {
    const dateStr = dateUtils.formatDate(date);
    app.updateCalendarState({ currentDate: dateStr });
    this.setData({
      currentDate: dateStr,
      loading: true,
      error: false
    });
    this.setData({ navTitle: this._buildNavTitle() });
    this._fetchData();
  },

  /**
   * 构建导航栏标题
   */
  _buildNavTitle() {
    const date = dateUtils.toDate(this.data.currentDate);
    if (this.data.currentView === 'month') {
      return dateUtils.formatMonthTitle(date);
    } else if (this.data.currentView === 'week') {
      const monday = dateUtils.getFirstDayOfWeek(date);
      const sunday = dateUtils.getLastDayOfWeek(date);
      return dateUtils.formatDateRange(monday, sunday);
    } else {
      return dateUtils.formatDateChinese(date);
    }
  },

  /**
   * 获取日历数据
   */
  _fetchData() {
    this.setData({ loading: true, error: false });

    // 计算日期范围
    let startDate, endDate;
    const cur = dateUtils.toDate(this.data.currentDate);
    if (this.data.currentView === 'month') {
      // 当月 + 前后各一周
      const firstDay = dateUtils.getFirstDayOfMonth(cur);
      startDate = dateUtils.formatDate(dateUtils.addDays(firstDay, -7));
      const lastDay = dateUtils.getLastDayOfMonth(cur);
      endDate = dateUtils.formatDate(dateUtils.addDays(lastDay, 7));
    } else if (this.data.currentView === 'week') {
      // 当前周 + 前后各一周
      const monday = dateUtils.getFirstDayOfWeek(cur);
      startDate = dateUtils.formatDate(dateUtils.addDays(monday, -7));
      const sunday = dateUtils.getLastDayOfWeek(cur);
      endDate = dateUtils.formatDate(dateUtils.addDays(sunday, 7));
    } else {
      // 日视图
      startDate = this.data.currentDate;
      endDate = this.data.currentDate;
    }

    calendarService.query({
      view: this.data.currentView,
      startDate: startDate,
      endDate: endDate,
      childId: this.data.selectedChildId || undefined,
      eventTypes: this.data.selectedScheduleTypes.length > 0
        ? this.data.selectedScheduleTypes.join(',')
        : undefined
    }).then(res => {
      const data = res.data;
      let schedules = [];
      let isEmpty = true;

      if (data && data.dates) {
        // 展开所有日期的 schedules 到一个扁平数组
        data.dates.forEach(d => {
          if (d.schedules && d.schedules.length > 0) {
            schedules = schedules.concat(d.schedules.map(s => ({
              ...s,
              instanceDate: d.date
            })));
            isEmpty = false;
          }
        });
      }

      // 月视图特殊处理：构建 cells 数据
      if (this.data.currentView === 'month') {
        const curDate = dateUtils.toDate(this.data.currentDate);
        const cells = dateUtils.generateMonthCells(curDate.getFullYear(), curDate.getMonth());
        // 将 dots 数据注入 cells
        if (data && data.dates) {
          const dateMap = {};
          data.dates.forEach(d => {
            dateMap[d.date] = { dots: d.dots || [], scheduleCount: d.scheduleCount || 0 };
          });
          cells.forEach(cell => {
            const info = dateMap[cell.date];
            cell.dots = info ? info.dots.slice(0, 3) : [];
            cell.scheduleCount = info ? info.scheduleCount : 0;
            cell.showMore = info && info.dots && info.dots.length > 3;
            cell.moreCount = cell.showMore ? info.dots.length - 3 : 0;
          });
        }
        this.setData({ monthCells: cells, schedules: schedules, loading: false, isEmpty: isEmpty, error: false });
      } else if (this.data.currentView === 'week') {
        const weekDays = dateUtils.generateWeekDays(cur);
        this.setData({ weekDays: weekDays, schedules: schedules, loading: false, isEmpty: isEmpty, error: false });
      } else {
        this.setData({ schedules: schedules, loading: false, isEmpty: isEmpty, error: false });
      }
    }).catch(err => {
      wx.showToast({ title: '加载失败，请下拉重试', icon: 'none' });
      this.setData({ loading: false, error: true });
    });
  },

  /**
   * 更新筛选标签文本
   */
  _updateSelectedLabels() {
    if (this.data.selectedChildId && app.globalData.childList) {
      const child = app.globalData.childList.find(c =>
        (c.childId || c.userId) === this.data.selectedChildId
      );
      if (child) {
        this.setData({ selectedChildName: child.childName || child.name });
      }
    }
  }
});
