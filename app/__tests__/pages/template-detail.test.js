// app/__tests__/pages/template-detail.test.js
// template-detail 页面测试 —— 加载/展示/编辑/删除/预设只读

const mockTemplate = require('../helpers/template-mock');
jest.mock('../../services/template', () => mockTemplate);

const template = require('../../services/template');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  template.getById.mockResolvedValue({
    data: {
      templateId: 't1',
      name: '钢琴课',
      scheduleType: 'AfterSchoolActivity',
      timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }],
      location: '少年宫',
      notes: '每周三',
      isPreset: false,
      usageCount: 5
    }
  });
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const app = { globalData: { currentFamilyId: 'f1' } };
  const { type, config } = loadPage('pages/template-detail/index.js', { app });
  expect(type).toBe('page');
  const ctx = createPageContext(config);
  global.getApp = () => app;
  return ctx;
}

describe('template-detail 页面', () => {
  describe('onLoad 加载', () => {
    test('缺 id query → Toast + navigateBack', () => {
      const ctx = setup();
      ctx.onLoad({});
      expect(wx.showToast).toHaveBeenCalledWith({ title: '缺少模板 id', icon: 'none' });
      expect(wx.navigateBack).toHaveBeenCalled();
    });

    test('有 id → 调 template.getById', async () => {
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      expect(template.getById).toHaveBeenCalledWith('t1');
    });

    test('加载成功：填充 template + 时间槽摘要 + 类型 label', async () => {
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      expect(ctx.data.template.templateId).toBe('t1');
      expect(ctx.data.template.name).toBe('钢琴课');
      expect(ctx.data.timeSlotSummary).toContain('周三');
      expect(ctx.data.scheduleTypeLabel).toBe('课后活动');
      expect(ctx.data.isPreset).toBe(false);
    });

    test('加载失败 → Toast', async () => {
      template.getById.mockRejectedValue({ statusCode: 404, message: '模板不存在' });
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '加载失败', icon: 'none' });
    });
  });

  describe('预设模板', () => {
    test('isPreset=true → 不显示编辑/删除按钮', async () => {
      template.getById.mockResolvedValue({
        data: { templateId: 'tp1', name: '预设', isPreset: true, scheduleType: 'DailyRoutine', usageCount: 0 }
      });
      const ctx = setup();
      ctx.onLoad({ id: 'tp1' });
      await flush();
      expect(ctx.data.isPreset).toBe(true);
    });
  });

  describe('编辑', () => {
    test('onTapEdit → 跳 template-create?id=...', async () => {
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      ctx.onTapEdit();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/template-create/index?id=t1' });
    });
  });

  describe('删除', () => {
    test('onTapDelete → showModal 二次确认', async () => {
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      ctx.onTapDelete();
      expect(wx.showModal).toHaveBeenCalledWith(expect.objectContaining({
        title: '删除模板',
        content: expect.stringContaining('已有 5 个日程')
      }));
    });

    test('确认删除 → template.remove + Toast + navigateBack', async () => {
      template.remove.mockResolvedValue({ data: { deleted: true } });
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      // 模拟 showModal 确认
      wx.showModal.mockImplementation(opts => {
        if (opts.success) opts.success({ confirm: true });
      });
      await ctx.onTapDelete();
      expect(template.remove).toHaveBeenCalledWith('t1');
      expect(wx.showToast).toHaveBeenCalledWith({ title: '模板已删除', icon: 'success' });
      expect(wx.navigateBack).toHaveBeenCalled();
    });

    test('取消删除 → 不调 remove', async () => {
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      wx.showModal.mockImplementation(opts => {
        if (opts.success) opts.success({ confirm: false });
      });
      await ctx.onTapDelete();
      expect(template.remove).not.toHaveBeenCalled();
    });

    test('删除失败 → Toast', async () => {
      template.remove.mockRejectedValue({ statusCode: 500, message: '删除失败' });
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      wx.showModal.mockImplementation(opts => {
        if (opts.success) opts.success({ confirm: true });
      });
      await ctx.onTapDelete();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '删除失败', icon: 'none' });
    });
  });

  describe('使用模板（预设）', () => {
    test('onTapUse → 弹 use-template-dialog', async () => {
      template.getById.mockResolvedValue({
        data: { templateId: 'tp1', name: '预设', isPreset: true, scheduleType: 'DailyRoutine', usageCount: 0 }
      });
      const ctx = setup();
      ctx.onLoad({ id: 'tp1' });
      await flush();
      ctx.onTapUse();
      expect(ctx.data.dialogVisible).toBe(true);
      expect(ctx.data.activeTemplate.templateId).toBe('tp1');
    });
  });

  describe('WXML data-id 契约', () => {
    const fs = require('fs');
    const path = require('path');
    function readWxml() {
      return fs.readFileSync(path.resolve(__dirname, '../../pages/template-detail/index.wxml'), 'utf8');
    }

    test('WXML 含编辑/删除/使用按钮 data-id', () => {
      const wxml = readWxml();
      expect(wxml).toContain('data-id="template-detail-edit-btn"');
      expect(wxml).toContain('data-id="template-detail-delete-btn"');
      expect(wxml).toContain('data-id="template-detail-use-btn"');
    });
  });
});
