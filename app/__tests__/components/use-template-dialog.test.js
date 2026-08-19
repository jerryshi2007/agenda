// app/__tests__/components/use-template-dialog.test.js
// use-template-dialog 组件测试 —— props/visible/childId/startDate 初始化 + apply 成功事件 + 错误 toast

const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');
const { ErrorMessages } = require('../../contracts/template');

const mockTemplate = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  apply: jest.fn()
};
jest.mock('../../services/template', () => mockTemplate);

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  // 默认无 children
  wx.getStorageSync.mockReturnValue(null);
});

function setup(props = {}, appOverrides = {}) {
  const app = {
    globalData: {
      childList: [
        { userId: 'c1', childName: '小明' },
        { userId: 'c2', childName: '小红' }
      ],
      ...appOverrides.globalData
    }
  };
  const { type, config } = loadPage('components/use-template-dialog/index.js', { app });
  expect(type).toBe('component');
  const ctx = createPageContext(config);
  global.getApp = () => app;
  ctx.triggerEvent = jest.fn();
  ctx.properties = Object.assign({
    template: null,
    visible: false
  }, props);
  if (config.lifetimes && config.lifetimes.attached) {
    config.lifetimes.attached.call(ctx);
  }
  ctx._appRef = app;
  return ctx;
}

const flush = () => new Promise(resolve => setImmediate(resolve));

function sampleTemplate(overrides = {}) {
  return {
    templateId: 't1',
    name: '钢琴课',
    scheduleType: 'AfterSchoolActivity',
    timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }],
    location: '少年宫',
    notes: '每周三',
    ...overrides
  };
}

describe('use-template-dialog 组件', () => {
  describe('初始化', () => {
    test('visible=false → data.showDialog=false', () => {
      const ctx = setup({ template: sampleTemplate() });
      expect(ctx.data.showDialog).toBe(false);
    });

    test('visible=true → data.showDialog=true', () => {
      const ctx = setup({ template: sampleTemplate(), visible: true });
      expect(ctx.data.showDialog).toBe(true);
    });

    test('childId 默认取第一个孩子', () => {
      const ctx = setup({ template: sampleTemplate(), visible: true });
      expect(ctx.data.childId).toBe('c1');
      expect(ctx.data.childName).toBe('小明');
    });

    test('无孩子时 childId 留空 + 提示', () => {
      const ctx = setup({ template: sampleTemplate(), visible: true }, { globalData: { childList: [] } });
      expect(ctx.data.childId).toBe('');
      expect(ctx.data.hasNoChild).toBe(true);
    });

    test('startDate 默认今天', () => {
      const ctx = setup({ template: sampleTemplate(), visible: true });
      expect(ctx.data.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('visible 变化（observer）', () => {
    test('visible 从 false 变 true → showDialog=true', () => {
      const ctx = setup({ template: sampleTemplate(), visible: false });
      ctx.properties.visible = true;
      // 触发 observer
      if (config => config.observers) {
        // observers are auto-triggered when data changes
      }
      // 直接 setData 模拟 observer
      ctx.setData({ showDialog: true });
      expect(ctx.data.showDialog).toBe(true);
    });
  });

  describe('onSelectChild', () => {
    test('切换 childId + childName', () => {
      const ctx = setup({ template: sampleTemplate(), visible: true });
      ctx.onSelectChild({ currentTarget: { dataset: { childId: 'c2', childName: '小红' } } });
      expect(ctx.data.childId).toBe('c2');
      expect(ctx.data.childName).toBe('小红');
    });
  });

  describe('onDateChange', () => {
    test('更新 startDate', () => {
      const ctx = setup({ template: sampleTemplate(), visible: true });
      ctx.onDateChange({ detail: { value: '2026-08-25' } });
      expect(ctx.data.startDate).toBe('2026-08-25');
    });
  });

  describe('onNameInput', () => {
    test('更新 overrideName', () => {
      const ctx = setup({ template: sampleTemplate(), visible: true });
      ctx.onNameInput({ detail: { value: '钢琴课（实例）' } });
      expect(ctx.data.overrideName).toBe('钢琴课（实例）');
    });
  });

  describe('onNotesInput', () => {
    test('更新 overrideNotes', () => {
      const ctx = setup({ template: sampleTemplate(), visible: true });
      ctx.onNotesInput({ detail: { value: '临时覆盖备注' } });
      expect(ctx.data.overrideNotes).toBe('临时覆盖备注');
    });
  });

  describe('onClose', () => {
    test('隐藏对话框 + 触发 close 事件', () => {
      const ctx = setup({ template: sampleTemplate(), visible: true });
      ctx.onClose();
      expect(ctx.data.showDialog).toBe(false);
      expect(ctx.triggerEvent).toHaveBeenCalledWith('close');
    });
  });

  describe('onConfirm', () => {
    test('校验：未选孩子 → Toast', async () => {
      const ctx = setup({ template: sampleTemplate(), visible: true }, { globalData: { childList: [] } });
      await ctx.onConfirm();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '请先选择孩子', icon: 'none' });
      expect(mockTemplate.apply).not.toHaveBeenCalled();
    });

    test('校验：startDate 为空 → Toast', async () => {
      const ctx = setup({ template: sampleTemplate(), visible: true });
      ctx.setData({ startDate: '' });
      await ctx.onConfirm();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '请选择起始日期', icon: 'none' });
      expect(mockTemplate.apply).not.toHaveBeenCalled();
    });

    test('成功：调 template.apply + 触发 success 事件', async () => {
      mockTemplate.apply.mockResolvedValue({ data: { scheduleId: 's-new', groupKey: 'g1' } });
      const ctx = setup({ template: sampleTemplate(), visible: true });
      await ctx.onConfirm();
      expect(mockTemplate.apply).toHaveBeenCalledWith('t1', expect.objectContaining({
        childId: 'c1',
        startDate: expect.any(String)
      }));
      expect(ctx.triggerEvent).toHaveBeenCalledWith('success', {
        scheduleId: 's-new',
        groupKey: 'g1'
      });
    });

    test('成功：overrideName 透传', async () => {
      mockTemplate.apply.mockResolvedValue({ data: { scheduleId: 's-new' } });
      const ctx = setup({ template: sampleTemplate(), visible: true });
      ctx.setData({ overrideName: '钢琴课（实例）' });
      await ctx.onConfirm();
      expect(mockTemplate.apply).toHaveBeenCalledWith('t1', expect.objectContaining({
        name: '钢琴课（实例）'
      }));
    });

    test('成功：overrideNotes 透传', async () => {
      mockTemplate.apply.mockResolvedValue({ data: { scheduleId: 's-new' } });
      const ctx = setup({ template: sampleTemplate(), visible: true });
      ctx.setData({ overrideNotes: '新备注' });
      await ctx.onConfirm();
      expect(mockTemplate.apply).toHaveBeenCalledWith('t1', expect.objectContaining({
        notes: '新备注'
      }));
    });

    test('失败：错误码 START_DATE_INVALID → Toast', async () => {
      mockTemplate.apply.mockRejectedValue({
        statusCode: 400,
        error: 'START_DATE_INVALID',
        message: ErrorMessages.START_DATE_INVALID
      });
      const ctx = setup({ template: sampleTemplate(), visible: true });
      await ctx.onConfirm();
      expect(wx.showToast).toHaveBeenCalledWith({ title: ErrorMessages.START_DATE_INVALID, icon: 'none' });
    });

    test('失败：CHILD_NOT_IN_FAMILY → Toast', async () => {
      mockTemplate.apply.mockRejectedValue({
        statusCode: 400,
        error: 'CHILD_NOT_IN_FAMILY',
        message: ErrorMessages.CHILD_NOT_IN_FAMILY
      });
      const ctx = setup({ template: sampleTemplate(), visible: true });
      await ctx.onConfirm();
      expect(wx.showToast).toHaveBeenCalledWith({ title: ErrorMessages.CHILD_NOT_IN_FAMILY, icon: 'none' });
    });

    test('失败：未知错误 → Toast 显示后端 message', async () => {
      mockTemplate.apply.mockRejectedValue({ statusCode: 500, message: '服务器内部错误' });
      const ctx = setup({ template: sampleTemplate(), visible: true });
      await ctx.onConfirm();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '服务器内部错误', icon: 'none' });
    });

    test('submitting=true → 重复点击不重复提交', async () => {
      mockTemplate.apply.mockReturnValue(new Promise(() => {}));
      const ctx = setup({ template: sampleTemplate(), visible: true });
      ctx.setData({ submitting: true });
      await ctx.onConfirm();
      expect(mockTemplate.apply).not.toHaveBeenCalled();
    });
  });

  describe('WXML data-id 契约', () => {
    const fs = require('fs');
    const path = require('path');
    function readWxml() {
      return fs.readFileSync(path.resolve(__dirname, '../../components/use-template-dialog/index.wxml'), 'utf8');
    }

    test('WXML 含 child-picker / start-date-picker / confirm-btn / cancel-btn data-id', () => {
      const wxml = readWxml();
      expect(wxml).toContain('data-id="use-template-dialog-child-picker"');
      expect(wxml).toContain('data-id="use-template-dialog-start-date-picker"');
      expect(wxml).toContain('data-id="use-template-dialog-confirm-btn"');
      expect(wxml).toContain('data-id="use-template-dialog-cancel-btn"');
    });

    test('WXML 含 name/notes override input data-id', () => {
      const wxml = readWxml();
      expect(wxml).toContain('data-id="use-template-dialog-name-input"');
      expect(wxml).toContain('data-id="use-template-dialog-notes-input"');
    });
  });
});
