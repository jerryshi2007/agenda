// app/__tests__/pages/schedule-detail-save-as-template.test.js
// schedule-detail 页面 —— "保存为模板" 按钮功能

const mockCheckin = require('../helpers/checkin-mock');
const mockSchedule = require('../helpers/schedule-mock');
const mockTemplate = require('../helpers/template-mock');
jest.mock('../../services/checkin', () => mockCheckin);
jest.mock('../../services/schedule', () => mockSchedule);
jest.mock('../../services/template', () => mockTemplate);

const checkin = require('../../services/checkin');
const schedule = require('../../services/schedule');
const template = require('../../services/template');
const { CheckinStatus, Reason } = require('../../contracts/checkin');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  schedule.getById.mockResolvedValue({
    data: {
      scheduleId: 's1',
      name: '钢琴练习',
      scheduleType: 'AfterSchoolActivity',
      instanceStatus: 'incomplete',
      timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }],
      location: '家',
      notes: '练习一小时',
      canEdit: true,
      canDelete: true
    }
  });
  checkin.getWindow.mockResolvedValue({ data: {} });
  template.create.mockResolvedValue({ data: { templateId: 't-new' } });
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const app = { globalData: {} };
  const { type, config } = loadPage('pages/schedule-detail/index.js', { app });
  expect(type).toBe('page');
  const ctx = createPageContext(config);
  global.getApp = () => app;
  return ctx;
}

function load(ctx) {
  ctx.onLoad({ scheduleId: 's1', date: '2026-08-16' });
  ctx.onShow();
}

describe('schedule-detail 页面 - 保存为模板', () => {
  test('onSaveAsTemplate → 弹 showModal 二次确认', async () => {
    const ctx = setup();
    load(ctx);
    await flush();
    ctx.onSaveAsTemplate();
    expect(wx.showModal).toHaveBeenCalledWith(expect.objectContaining({
      title: '保存为模板',
      content: expect.stringContaining('钢琴练习')
    }));
  });

  test('确认 → 从 schedule 构造 payload 调 template.create + Toast', async () => {
    const ctx = setup();
    load(ctx);
    await flush();
    wx.showModal.mockImplementation(opts => {
      if (opts.success) opts.success({ confirm: true });
    });
    await ctx.onSaveAsTemplate();
    await flush();
    expect(template.create).toHaveBeenCalledWith(expect.objectContaining({
      name: '钢琴练习',
      scheduleType: 'AfterSchoolActivity',
      timeSlots: expect.any(Array)
    }));
    expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('已保存为模板')
    }));
  });

  test('取消 → 不调 template.create', async () => {
    const ctx = setup();
    load(ctx);
    await flush();
    wx.showModal.mockImplementation(opts => {
      if (opts.success) opts.success({ confirm: false });
    });
    await ctx.onSaveAsTemplate();
    expect(template.create).not.toHaveBeenCalled();
  });

  test('保存失败 → Toast 显示后端 message', async () => {
    template.create.mockRejectedValue({ statusCode: 500, message: '保存失败' });
    const ctx = setup();
    load(ctx);
    await flush();
    wx.showModal.mockImplementation(opts => {
      if (opts.success) opts.success({ confirm: true });
    });
    await ctx.onSaveAsTemplate();
    await flush();
    expect(wx.showToast).toHaveBeenCalledWith({ title: '保存失败', icon: 'none' });
  });
});

describe('WXML data-id 契约', () => {
  const fs = require('fs');
  const path = require('path');
  function readWxml() {
    return fs.readFileSync(path.resolve(__dirname, '../../pages/schedule-detail/index.wxml'), 'utf8');
  }

  test('WXML 含"保存为模板"按钮 data-id', () => {
    const wxml = readWxml();
    expect(wxml).toContain('data-id="schedule-detail-save-as-template-btn"');
  });
});
