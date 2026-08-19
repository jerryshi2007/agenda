// pages/schedule-detail/index.js
// 日程详情页 —— 完整信息展示 + 操作按钮状态机 + 打卡倒计时

const scheduleService = require('../../services/schedule');
const checkinService = require('../../services/checkin');
const templateService = require('../../services/template');
const dateUtils = require('../../utils/date-utils');
const { CheckinStatus, Reason } = require('../../contracts/checkin');
const { ErrorMessages } = require('../../contracts/template');
const app = getApp();

const TYPE_LABELS = {
  'AfterSchoolActivity': '课后活动',
  'DailyRoutine': '日常作息',
  'HomeworkTask': '作业任务'
};

// 状态中文标签（fallback；窗口返回的 statusLabel 为权威值）
const STATUS_LABELS = {
  [CheckinStatus.Incomplete]: '未完成',
  [CheckinStatus.Completed]: '已完成',
  [CheckinStatus.Cancelled]: '已取消',
  [CheckinStatus.Ended]: '已结束',
  [CheckinStatus.Overdue]: '逾期未完成'
};

// 终态集合：仅展示状态文本，无打卡/撤销按钮
const TERMINAL_STATUSES = [
  CheckinStatus.Ended,
  CheckinStatus.Overdue,
  CheckinStatus.Cancelled
];

const PRESCHOOL_MODE = 'preschool';

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
    statusLabel: '未完成',
    checkinStatus: CheckinStatus.Incomplete,
    isCompleted: false,
    isEnded: false,
    isIncomplete: true,
    isOverdue: false,
    isCancelled: false,
    isTerminal: false,
    targetDateText: '',

    // Operation permissions
    canEdit: false,
    canCancel: false,
    canDelete: false,
    canCheckin: false,
    canUndo: false,
    canRestore: false,

    // Checkin state
    isEarly: false,
    isPreschoolMode: false,
    countdownText: '',
    checkinLoading: false,
    checkinError: false,

    // Dialogs
    showDeleteDialog: false,
    showCancelDialog: false,
    deleteScope: 'ThisOnly',

    // State
    loading: true,
    error: false,
    isDeleted: false,

    // Time
    timeText: ''
  },

  onLoad(options) {
    const { scheduleId, date, displayMode } = options;
    if (!scheduleId) {
      wx.showToast({ title: '缺少日程信息', icon: 'none' });
      wx.navigateBack();
      return;
    }

    const today = dateUtils.formatDate(new Date());
    const mode = displayMode || app.globalData.displayMode;
    this.setData({
      scheduleId: scheduleId,
      targetDate: date || today,
      targetDateText: date ? dateUtils.formatDateChinese(date) : '',
      isPreschoolMode: mode === PRESCHOOL_MODE
    });

    this._loadDetail();
  },

  onShow() {
    if (!this.data.scheduleId) return;
    this._loadCheckinWindow();
  },

  onHide() {
    this._stopCountdown();
  },

  onUnload() {
    this._stopCountdown();
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
   * 查询打卡窗口状态（权威状态来源，onShow 时刷新）
   */
  _loadCheckinWindow() {
    checkinService.getWindow(this.data.scheduleId, this.data.targetDate)
      .then(res => {
        this._applyCheckinWindow(res.data || {});
      })
      .catch(() => {
        // 窗口查询失败：不臆测按钮，展示错误态 + 停倒计时
        this._stopCountdown();
        this.setData({
          checkinError: true,
          canCheckin: false,
          canUndo: false,
          isEarly: false
        });
      });
  },

  /**
   * 应用打卡窗口状态 → 按钮状态机 + 倒计时
   */
  _applyCheckinWindow(w) {
    const canCheckin = !!w.canCheckin;
    const canUndo = !!w.canUndo;
    const reason = w.reason || null;
    const remainingSeconds = w.remainingSeconds || 0;
    const isEarly = reason === Reason.Early;

    this._setStatus(w.status, w.statusLabel);
    this.setData({
      canCheckin: canCheckin,
      canUndo: canUndo,
      isEarly: isEarly,
      checkinError: false
    });

    if (isEarly && remainingSeconds > 0) {
      this._startCountdown(remainingSeconds);
    } else {
      this._stopCountdown();
    }
  },

  /**
   * 状态归一化 + 派生布尔标志（供 WXML 条件渲染）
   */
  _setStatus(status, label) {
    const normalized = (status || CheckinStatus.Incomplete).toLowerCase();
    const isCompleted = normalized === CheckinStatus.Completed;
    const isCancelled = normalized === CheckinStatus.Cancelled;
    const isEnded = normalized === CheckinStatus.Ended;
    const isOverdue = normalized === CheckinStatus.Overdue;
    const isIncomplete = normalized === CheckinStatus.Incomplete;
    const isTerminal = TERMINAL_STATUSES.indexOf(normalized) !== -1;

    let statusClass = 'pending';
    if (isCompleted) statusClass = 'done';
    else if (isCancelled) statusClass = 'cancelled';
    else if (isOverdue || isEnded) statusClass = 'overdue';

    this.setData({
      checkinStatus: normalized,
      statusLabel: label || STATUS_LABELS[normalized] || STATUS_LABELS[CheckinStatus.Incomplete],
      statusClass: statusClass,
      isCompleted: isCompleted,
      isCancelled: isCancelled,
      isEnded: isEnded,
      isOverdue: isOverdue,
      isIncomplete: isIncomplete,
      isTerminal: isTerminal
    });
  },

  /**
   * 启动打卡倒计时（每 30s 递减，归零后重新查询窗口）
   */
  _startCountdown(seconds) {
    this._stopCountdown();
    this._remainingSeconds = seconds;
    this.setData({ countdownText: this._formatCountdown(seconds) });

    this._countdownTimer = setInterval(() => {
      this._remainingSeconds -= 30;
      if (this._remainingSeconds <= 0) {
        this._stopCountdown();
        this._loadCheckinWindow();
        return;
      }
      this.setData({ countdownText: this._formatCountdown(this._remainingSeconds) });
    }, 30000);
  },

  /**
   * 停止倒计时（仅管理定时器；countdownText 由 _applyCheckinWindow 维护）
   */
  _stopCountdown() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
    this._remainingSeconds = 0;
  },

  /**
   * 秒数 → 「N 分钟」展示文本（向下取整，最少 1 分钟）
   */
  _formatCountdown(seconds) {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return `${minutes} 分钟`;
  },

  /**
   * 打卡
   */
  onCheckin() {
    if (this.data.checkinLoading) return;
    this.setData({ checkinLoading: true });
    checkinService.checkin(this.data.scheduleId, this.data.targetDate)
      .then(() => {
        this.setData({ checkinLoading: false });
        wx.showToast({ title: '打卡成功', icon: 'success' });
        this._loadCheckinWindow();
      })
      .catch(err => {
        this.setData({ checkinLoading: false });
        wx.showToast({ title: err.message || '打卡失败', icon: 'none' });
      });
  },

  /**
   * 撤销打卡
   */
  onUndo() {
    if (this.data.checkinLoading) return;
    this.setData({ checkinLoading: true });
    checkinService.undo(this.data.scheduleId, this.data.targetDate)
      .then(() => {
        this.setData({ checkinLoading: false });
        wx.showToast({ title: '已撤销打卡', icon: 'success' });
        this._loadCheckinWindow();
      })
      .catch(err => {
        this.setData({ checkinLoading: false });
        wx.showToast({ title: err.message || '撤销失败', icon: 'none' });
      });
  },

  /**
   * 打卡窗口加载失败后重试
   */
  onRetryCheckin() {
    this.setData({ checkinError: false });
    this._loadCheckinWindow();
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
   * 保存为模板（弹二次确认 + 从 schedule 构造 payload 调 template.create）
   */
  onSaveAsTemplate() {
    const sched = this.data.schedule;
    if (!sched || !sched.scheduleId) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      wx.showModal({
        title: '保存为模板',
        content: `确定将 "${sched.name || '此日程'}" 保存为模板吗？保存后可在模板管理中查看和使用。`,
        confirmText: '保存',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this._doSaveAsTemplate(sched).then(resolve);
          } else {
            resolve();
          }
        },
        fail: () => resolve()
      });
    });
  },

  _doSaveAsTemplate(sched) {
    const data = {
      name: (sched.name || '').trim() || '未命名模板',
      scheduleType: sched.scheduleType,
      timeSlots: sched.timeSlots || []
    };
    if (sched.location) data.location = sched.location;
    if (sched.notes) data.notes = sched.notes;
    if (sched.dueDate) data.dueDate = sched.dueDate;
    if (sched.suggestedStartTime) data.suggestedStartTime = sched.suggestedStartTime;
    if (sched.suggestedEndTime) data.suggestedEndTime = sched.suggestedEndTime;
    return templateService.create(data)
      .then(() => {
        wx.showToast({ title: '已保存为模板，可在模板管理中查看', icon: 'success' });
      })
      .catch(err => {
        const code = err && err.error;
        const msg = (code && ErrorMessages[code]) || (err && err.message) || '保存失败';
        wx.showToast({ title: msg, icon: 'none' });
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
   * 重试（整页）
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
