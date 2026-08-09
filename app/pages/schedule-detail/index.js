// pages/schedule-detail/index.js
// 日程详情页 —— 完整信息展示 + 操作按钮状态机 + 打卡倒计时

const scheduleService = require('../../services/schedule');
const checkinService = require('../../services/checkin');
const dateUtils = require('../../utils/date-utils');
const app = getApp();

const TYPE_LABELS = {
  'AfterSchoolActivity': '课后活动',
  'DailyRoutine': '日常作息',
  'HomeworkTask': '作业任务'
};

const STATUS_TEXT = {
  'incomplete': '未完成',
  'Incomplete': '未完成',
  'completed': '已完成',
  'Completed': '已完成',
  'cancelled': 'Cancelled',
  'Cancelled': '已取消',
  'overdue': '已逾期',
  'Overdue': '已逾期',
  'ended': '已结束',
  'Ended': '已结束'
};

Page({
  data: {
    scheduleId: '',
    targetDate: '',
    schedule: {},
    scheduleType: '',
    isHomework: false,
    stripeClass: 'activity',
    typeLabel: '',
    statusClass: 'pending',
    statusText: '未完成',
    targetDateText: '',

    // Operation permissions
    canEdit: false,
    canCancel: false,
    canDelete: false,
    canCheckin: false,
    canUndo: false,
    canRestore: false,

    // Checkin countdown
    countdownActive: false,
    countdownText: '',

    // Dialogs
    showDeleteDialog: false,
    showCancelDialog: false,
    deleteScope: 'ThisOnly',

    // State
    loading: true,
    error: false,
    isDeleted: false,

    // Time
    timeText: '',

    // Timer ref
    _countdownTimer: null
  },

  onLoad(options) {
    const { scheduleId, date } = options;
    if (!scheduleId) {
      wx.showToast({ title: '缺少日程信息', icon: 'none' });
      wx.navigateBack();
      return;
    }

    const today = dateUtils.formatDate(new Date());
    this.setData({
      scheduleId: scheduleId,
      targetDate: date || today,
      targetDateText: date ? dateUtils.formatDateChinese(date) : ''
    });

    this._loadDetail();
    this._loadCheckinWindow();
  },

  onHide() {
    // 清除倒计时定时器
    if (this.data._countdownTimer) {
      clearInterval(this.data._countdownTimer);
      this.data._countdownTimer = null;
    }
  },

  onUnload() {
    if (this.data._countdownTimer) {
      clearInterval(this.data._countdownTimer);
      this.data._countdownTimer = null;
    }
  },

  /**
   * 加载日程详情
   */
  _loadDetail() {
    this.setData({ loading: true, error: false });

    scheduleService.getById(this.data.scheduleId, this.data.targetDate)
      .then(res => {
        const d = res.data;
        const scheduleType = d.scheduleType || '';
        const isHomework = scheduleType === 'HomeworkTask';
        let stripeClass = 'activity';
        if (scheduleType === 'AfterSchoolActivity') stripeClass = 'activity';
        else if (scheduleType === 'DailyRoutine') stripeClass = 'routine';
        else if (scheduleType === 'HomeworkTask') stripeClass = 'homework';

        let statusClass = 'pending';
        let statusText = '未完成';
        const istatus = d.instanceStatus || '';
        if (istatus === 'completed' || istatus === 'Completed') {
          statusClass = 'done';
          statusText = '已完成';
        } else if (istatus === 'cancelled' || istatus === 'Cancelled') {
          statusClass = 'cancelled';
          statusText = '已取消';
        } else if (istatus === 'overdue' || istatus === 'Overdue') {
          statusClass = 'overdue';
          statusText = '已逾期';
        } else if (istatus === 'ended' || istatus === 'Ended') {
          statusClass = 'overdue';
          statusText = '已结束';
        }

        // 时间文本
        let timeText = '';
        if (!isHomework && d.timeSlots && d.timeSlots.length > 0) {
          const ts = d.timeSlots[0];
          timeText = `${ts.startTime || ''} - ${ts.endTime || ''}`;
        } else if (isHomework && d.suggestedStartTime) {
          timeText = `${d.suggestedStartTime} - ${d.suggestedEndTime || ''}`;
        }

        this.setData({
          schedule: d,
          scheduleType: scheduleType,
          isHomework: isHomework,
          stripeClass: stripeClass,
          typeLabel: TYPE_LABELS[scheduleType] || '',
          statusClass: statusClass,
          statusText: statusText,
          timeText: timeText,
          canEdit: d.canEdit || false,
          canCancel: d.canCancel || false,
          canDelete: d.canDelete || false,
          canRestore: (d.isCancelled || d.isExcluded) && (app.globalData.userRole !== 'Child'),
          loading: false,
          targetDateText: dateUtils.formatDateChinese(this.data.targetDate)
        });
      })
      .catch(err => {
        this.setData({ loading: false });
        if (err.statusCode === 404) {
          this.setData({ isDeleted: true });
        } else {
          this.setData({ error: true });
        }
      });
  },

  /**
   * 查询打卡窗口状态
   */
  _loadCheckinWindow() {
    checkinService.getWindow(this.data.scheduleId, this.data.targetDate)
      .then(res => {
        const w = res.data || {};
        this.setData({
          canCheckin: w.canCheckin || false,
          canUndo: w.canUndo || false
        });

        // 如果在打卡窗口前，启动倒计时
        if (w.canCheckin && w.waitSeconds > 0) {
          this._startCountdown(w.waitSeconds);
        }
      })
      .catch(() => {
        // checkin module 可能不可用，容错
        const istatus = (this.data.schedule.instanceStatus || '').toLowerCase();
        this.setData({
          canCheckin: !this.data.isDeleted && istatus !== 'completed' && istatus !== 'cancelled',
          canUndo: istatus === 'completed'
        });
      });
  },

  /**
   * 打卡倒计时
   */
  _startCountdown(seconds) {
    this.setData({ countdownActive: true });
    const updateCountdown = () => {
      if (seconds <= 0) {
        clearInterval(this.data._countdownTimer);
        this.setData({ countdownActive: false, countdownText: '' });
        return;
      }
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      this.setData({ countdownText: `${m}:${String(s).padStart(2, '0')}` });
      seconds--;
    };
    updateCountdown();
    this.data._countdownTimer = setInterval(updateCountdown, 1000);
  },

  /**
   * 打卡
   */
  onCheckin() {
    wx.showLoading({ title: '打卡中...' });
    checkinService.checkin(this.data.scheduleId, this.data.targetDate)
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '打卡成功', icon: 'success' });
        // 刷新详情
        setTimeout(() => {
          this._loadDetail();
          this._loadCheckinWindow();
        }, 800);
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '打卡失败', icon: 'none' });
      });
  },

  /**
   * 撤销打卡
   */
  onUndo() {
    wx.showLoading({ title: '撤销中...' });
    checkinService.undo(this.data.scheduleId, this.data.targetDate)
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '已撤销打卡', icon: 'success' });
        setTimeout(() => {
          this._loadDetail();
          this._loadCheckinWindow();
        }, 800);
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '撤销失败', icon: 'none' });
      });
  },

  /**
   * 跳转编辑页
   */
  onEdit() {
    wx.navigateTo({
      url: `/pages/schedule-edit/index?scheduleId=${this.data.scheduleId}&date=${this.data.targetDate}`
    });
  },

  /**
   * 取消本次确认弹窗
   */
  onCancelDialog() {
    this.setData({ showCancelDialog: true });
  },

  onCancelCancelDialog() {
    this.setData({ showCancelDialog: false });
  },

  /**
   * 确认取消本次
   */
  onConfirmCancel() {
    this.setData({ showCancelDialog: false });
    wx.showLoading({ title: '取消中...' });
    scheduleService.cancel(this.data.scheduleId, this.data.targetDate)
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '已取消', icon: 'success' });
        this._loadDetail();
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.data?.error === 'HOMEWORK_NO_CANCEL' ? '作业不支持取消' : '操作失败', icon: 'none' });
      });
  },

  /**
   * 恢复本次
   */
  onRestore() {
    wx.showLoading({ title: '恢复中...' });
    scheduleService.restore(this.data.scheduleId, this.data.targetDate)
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '已恢复', icon: 'success' });
        this._loadDetail();
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '恢复失败', icon: 'none' });
      });
  },

  /**
   * 删除确认弹窗
   */
  onDeleteDialog() {
    this.setData({ showDeleteDialog: true, deleteScope: 'ThisOnly' });
  },

  onCancelDeleteDialog() {
    this.setData({ showDeleteDialog: false });
  },

  onSelectDeleteScope(e) {
    this.setData({ deleteScope: e.currentTarget.dataset.scope });
  },

  /**
   * 确认删除
   */
  onConfirmDelete() {
    this.setData({ showDeleteDialog: false });
    const scope = this.data.isHomework ? 'ThisAndFuture' : this.data.deleteScope;
    wx.showLoading({ title: '删除中...' });
    scheduleService.remove(this.data.scheduleId, scope, this.data.targetDate)
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '已删除', icon: 'success' });
        // 通知首页刷新
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage) {
          prevPage._needRefresh = true;
        }
        setTimeout(() => wx.navigateBack(), 1000);
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '删除失败', icon: 'none' });
      });
  },

  /**
   * 重试
   */
  onRetry() {
    this._loadDetail();
    this._loadCheckinWindow();
  },

  /**
   * 返回
   */
  onGoBack() {
    wx.navigateBack();
  }
});
