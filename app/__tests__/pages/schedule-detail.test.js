// app/__tests__/pages/schedule-detail.test.js
const mockCheckin = require('../helpers/checkin-mock');
const mockSchedule = require('../helpers/schedule-mock');
jest.mock('../../services/checkin', () => mockCheckin);
jest.mock('../../services/schedule', () => mockSchedule);

const checkin = require('../../services/checkin');
const schedule = require('../../services/schedule');
const { CheckinStatus, Reason } = require('../../contracts/checkin');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  schedule.getById.mockResolvedValue({
    data: { scheduleType: 'DailyRoutine', instanceStatus: 'incomplete', timeSlots: [], canEdit: false }
  });
});

afterEach(() => {
  jest.useRealTimers();
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(app = { globalData: {} }) {
  const { type, config } = loadPage('pages/schedule-detail/index.js', { app });
  expect(type).toBe('page');
  return createPageContext(config);
}

function load(ctx, options = {}) {
  ctx.onLoad({ scheduleId: 's1', date: '2026-08-16', ...options });
  ctx.onShow();
}

describe('schedule-detail 打卡窗口与按钮状态机', () => {
  test('canCheckin=true → 可打卡（非 early/终态）', async () => {
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: true, canUndo: false, reason: null, remainingSeconds: null, status: CheckinStatus.Incomplete, statusLabel: '未完成' } });
    const ctx = setup();
    load(ctx);
    await flush();
    expect(ctx.data.canCheckin).toBe(true);
    expect(ctx.data.canUndo).toBe(false);
    expect(ctx.data.isEarly).toBe(false);
    expect(ctx.data.isIncomplete).toBe(true);
    expect(ctx.data.isTerminal).toBe(false);
  });

  test('reason=EARLY → 灰色倒计时（isEarly + countdownText）', async () => {
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: false, canUndo: false, reason: Reason.Early, remainingSeconds: 120, status: CheckinStatus.Incomplete, statusLabel: '未完成' } });
    const ctx = setup();
    load(ctx);
    await flush();
    expect(ctx.data.canCheckin).toBe(false);
    expect(ctx.data.isEarly).toBe(true);
    expect(ctx.data.countdownText).toBe('2 分钟');
    ctx.onHide(); // 清理真实倒计时定时器，避免泄漏
  });

  test('canUndo=true → 撤销态（completed）', async () => {
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: false, canUndo: true, reason: null, remainingSeconds: null, status: CheckinStatus.Completed, statusLabel: '已完成' } });
    const ctx = setup();
    load(ctx);
    await flush();
    expect(ctx.data.canUndo).toBe(true);
    expect(ctx.data.isCompleted).toBe(true);
    expect(ctx.data.isTerminal).toBe(false);
  });

  test('status=ended → 终态（isTerminal=true，无按钮）', async () => {
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: false, canUndo: false, reason: Reason.TerminalState, remainingSeconds: null, status: CheckinStatus.Ended, statusLabel: '已结束' } });
    const ctx = setup();
    load(ctx);
    await flush();
    expect(ctx.data.isTerminal).toBe(true);
    expect(ctx.data.isEnded).toBe(true);
    expect(ctx.data.canCheckin).toBe(false);
    expect(ctx.data.canUndo).toBe(false);
  });

  test('status=cancelled → 终态 isCancelled=true', async () => {
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: false, canUndo: false, reason: Reason.TerminalState, remainingSeconds: null, status: CheckinStatus.Cancelled, statusLabel: '已取消' } });
    const ctx = setup();
    load(ctx);
    await flush();
    expect(ctx.data.isCancelled).toBe(true);
    expect(ctx.data.isTerminal).toBe(true);
  });

  test('窗口查询失败 → checkinError=true 且不臆测按钮', async () => {
    checkin.getWindow.mockRejectedValue({ error: 'NETWORK_ERROR' });
    const ctx = setup();
    load(ctx);
    await flush();
    expect(ctx.data.checkinError).toBe(true);
    expect(ctx.data.canCheckin).toBe(false);
    expect(ctx.data.canUndo).toBe(false);
  });
});

describe('schedule-detail 展示模式控制', () => {
  test('全局 displayMode=preschool → isPreschoolMode=true', async () => {
    const ctx = setup({ globalData: { displayMode: 'preschool' } });
    ctx.onLoad({ scheduleId: 's1', date: '2026-08-16' });
    await flush();
    expect(ctx.data.isPreschoolMode).toBe(true);
  });

  test('页面参数 displayMode=preschool → isPreschoolMode=true', async () => {
    const ctx = setup();
    ctx.onLoad({ scheduleId: 's1', date: '2026-08-16', displayMode: 'preschool' });
    await flush();
    expect(ctx.data.isPreschoolMode).toBe(true);
  });

  test('默认非学龄前 → isPreschoolMode=false', async () => {
    const ctx = setup();
    ctx.onLoad({ scheduleId: 's1', date: '2026-08-16' });
    await flush();
    expect(ctx.data.isPreschoolMode).toBe(false);
  });
});

describe('schedule-detail 打卡/撤销交互', () => {
  test('onCheckin 调 checkin + 成功 Toast 打卡成功', async () => {
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: true, canUndo: false, status: CheckinStatus.Incomplete, statusLabel: '未完成' } });
    checkin.checkin.mockResolvedValue({ data: { checkinId: 1 } });
    const ctx = setup();
    load(ctx);
    await flush();

    ctx.onCheckin();
    await flush();
    expect(checkin.checkin).toHaveBeenCalledWith('s1', '2026-08-16');
    expect(wx.showToast).toHaveBeenCalledWith({ title: '打卡成功', icon: 'success' });
  });

  test('onCheckin 失败 → 错误 Toast（展示后端提示）', async () => {
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: true, canUndo: false, status: CheckinStatus.Incomplete, statusLabel: '未完成' } });
    checkin.checkin.mockRejectedValue({ message: '打卡时间窗口已关闭' });
    const ctx = setup();
    load(ctx);
    await flush();

    ctx.onCheckin();
    await flush();
    expect(checkin.checkin).toHaveBeenCalledWith('s1', '2026-08-16');
    expect(wx.showToast).toHaveBeenCalledWith({ title: '打卡时间窗口已关闭', icon: 'none' });
  });

  test('onUndo 调 undo + 成功 Toast 已撤销', async () => {
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: false, canUndo: true, status: CheckinStatus.Completed, statusLabel: '已完成' } });
    checkin.undo.mockResolvedValue({ data: { undone: true } });
    const ctx = setup();
    load(ctx);
    await flush();

    ctx.onUndo();
    await flush();
    expect(checkin.undo).toHaveBeenCalledWith('s1', '2026-08-16');
    expect(wx.showToast).toHaveBeenCalledWith({ title: '已撤销打卡', icon: 'success' });
  });

  test('onUndo 失败（TERMINAL_STATE 映射文案）→ 错误 Toast', async () => {
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: false, canUndo: true, status: CheckinStatus.Completed, statusLabel: '已完成' } });
    checkin.undo.mockRejectedValue({ message: '已结算，不可撤销' });
    const ctx = setup();
    load(ctx);
    await flush();

    ctx.onUndo();
    await flush();
    expect(checkin.undo).toHaveBeenCalledWith('s1', '2026-08-16');
    expect(wx.showToast).toHaveBeenCalledWith({ title: '已结算，不可撤销', icon: 'none' });
  });
});

describe('schedule-detail 倒计时生命周期', () => {
  test('EARLY 每 30s 递减，归零后重新查询窗口', async () => {
    jest.useFakeTimers();
    checkin.getWindow
      .mockResolvedValueOnce({ data: { canCheckin: false, canUndo: false, reason: Reason.Early, remainingSeconds: 120, status: CheckinStatus.Incomplete, statusLabel: '未完成' } })
      .mockResolvedValue({ data: { canCheckin: true, canUndo: false, reason: null, status: CheckinStatus.Incomplete, statusLabel: '未完成' } });
    const ctx = setup();
    ctx.onLoad({ scheduleId: 's1', date: '2026-08-16' });
    ctx.onShow();
    await jest.advanceTimersByTimeAsync(0);
    expect(ctx.data.isEarly).toBe(true);
    expect(ctx.data.countdownText).toBe('2 分钟');

    await jest.advanceTimersByTimeAsync(30000);
    expect(ctx.data.countdownText).toBe('2 分钟');

    await jest.advanceTimersByTimeAsync(30000);
    expect(ctx.data.countdownText).toBe('1 分钟');

    await jest.advanceTimersByTimeAsync(60000);
    await jest.advanceTimersByTimeAsync(0);
    expect(checkin.getWindow).toHaveBeenCalledTimes(2);
    expect(ctx.data.isEarly).toBe(false);
    jest.useRealTimers();
  });

  test('onHide 后倒计时停止（不再递减、不再重查）', async () => {
    jest.useFakeTimers();
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: false, canUndo: false, reason: Reason.Early, remainingSeconds: 120, status: CheckinStatus.Incomplete, statusLabel: '未完成' } });
    const ctx = setup();
    ctx.onLoad({ scheduleId: 's1', date: '2026-08-16' });
    ctx.onShow();
    await jest.advanceTimersByTimeAsync(0);
    expect(ctx.data.countdownText).toBe('2 分钟');

    ctx.onHide();
    await jest.advanceTimersByTimeAsync(120000);
    expect(ctx.data.countdownText).toBe('2 分钟');
    expect(checkin.getWindow).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('onUnload 清除倒计时（离开页面无泄漏）', async () => {
    jest.useFakeTimers();
    checkin.getWindow.mockResolvedValue({ data: { canCheckin: false, canUndo: false, reason: Reason.Early, remainingSeconds: 120, status: CheckinStatus.Incomplete, statusLabel: '未完成' } });
    const ctx = setup();
    ctx.onLoad({ scheduleId: 's1', date: '2026-08-16' });
    ctx.onShow();
    await jest.advanceTimersByTimeAsync(0);

    ctx.onUnload();
    await jest.advanceTimersByTimeAsync(120000);
    expect(ctx.data.countdownText).toBe('2 分钟');
    expect(checkin.getWindow).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
