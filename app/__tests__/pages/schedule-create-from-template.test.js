// app/__tests__/pages/schedule-create-from-template.test.js
// schedule-create 页面 —— "从模板创建" 入口

const mockSchedule = require('../helpers/schedule-mock');
jest.mock('../../services/schedule', () => mockSchedule);

const schedule = require('../../services/schedule');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  schedule.create.mockResolvedValue({ data: { scheduleId: 's-new' } });
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(appData = {}) {
  const app = { globalData: { childList: [{ userId: 'c1', childName: '小明' }], currentFamilyId: 'f1', ...appData } };
  const { type, config } = loadPage('pages/schedule-create/index.js', { app });
  expect(type).toBe('page');
  const ctx = createPageContext(config);
  global.getApp = () => app;
  return ctx;
}

describe('schedule-create 页面 - 从模板创建入口', () => {
  test('onTapFromTemplate → 跳 template-list 带 action=apply&returnTo=schedule-create', () => {
    const ctx = setup();
    ctx.onLoad({});
    ctx.onTapFromTemplate();
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringMatching(/\/pages\/template-list\/index\?action=apply&returnTo=schedule-create/)
    }));
  });
});

describe('WXML data-id 契约', () => {
  const fs = require('fs');
  const path = require('path');
  function readWxml() {
    return fs.readFileSync(path.resolve(__dirname, '../../pages/schedule-create/index.wxml'), 'utf8');
  }

  test('WXML 含"从模板创建"按钮 data-id', () => {
    const wxml = readWxml();
    expect(wxml).toContain('data-id="schedule-create-from-template-btn"');
  });
});
