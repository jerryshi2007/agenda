// app/__tests__/pages/template-create.test.js
// template-create 页面测试 —— 从零创建/编辑模式（基于 schedule-form 子组件）

const mockTemplate = require('../helpers/template-mock');
jest.mock('../../services/template', () => mockTemplate);

const template = require('../../services/template');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  template.create.mockResolvedValue({ data: { templateId: 't-new' } });
  template.update.mockResolvedValue({ data: { templateId: 't1' } });
  template.getById.mockResolvedValue({
    data: {
      templateId: 't1',
      name: '钢琴课',
      scheduleType: 'AfterSchoolActivity',
      timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }],
      location: '少年宫',
      notes: '每周三',
      isPreset: false
    }
  });
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const app = { globalData: { currentFamilyId: 'f1' } };
  const { type, config } = loadPage('pages/template-create/index.js', { app });
  expect(type).toBe('page');
  const ctx = createPageContext(config);
  global.getApp = () => app;
  ctx.selectComponent = jest.fn(() => ({
    onSubmit: jest.fn(),
    data: { formData: { name: 'X', scheduleType: 'AfterSchoolActivity', timeSlots: [] } },
    _validate: jest.fn(() => true)
  }));
  return ctx;
}

describe('template-create 页面', () => {
  describe('从零创建 mode', () => {
    test('无 id query → mode=template-create', () => {
      const ctx = setup();
      ctx.onLoad({});
      expect(ctx.data.mode).toBe('template-create');
      expect(ctx.data.title).toBe('新建模板');
      expect(ctx.data.editing).toBe(false);
    });

    test('未调 template.getById', () => {
      const ctx = setup();
      ctx.onLoad({});
      expect(template.getById).not.toHaveBeenCalled();
    });
  });

  describe('编辑 mode', () => {
    test('有 id query → mode=template-edit + 加载 initialValues', async () => {
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      expect(template.getById).toHaveBeenCalledWith('t1');
      expect(ctx.data.mode).toBe('template-edit');
      expect(ctx.data.title).toBe('编辑模板');
      expect(ctx.data.editing).toBe(true);
      expect(ctx.data.initialValues).toEqual(expect.objectContaining({
        name: '钢琴课',
        scheduleType: 'AfterSchoolActivity'
      }));
    });

    test('加载失败 → Toast', async () => {
      template.getById.mockRejectedValue({ statusCode: 404, message: '模板不存在' });
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '模板不存在', icon: 'none' });
    });
  });

  describe('提交', () => {
    test('从零创建：onFormSubmit 校验通过 → template.create + Toast + navigateBack', async () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.onFormSubmit({ detail: {
        formData: {
          name: '模板A',
          scheduleType: 'AfterSchoolActivity',
          timeSlots: [{ dayOfWeek: 1, startTime: '10:00', endTime: '11:00' }],
          location: '家',
          notes: '测试'
        },
        valid: true
      }});
      await flush();
      expect(template.create).toHaveBeenCalledWith(expect.objectContaining({
        name: '模板A',
        scheduleType: 'AfterSchoolActivity',
        timeSlots: expect.any(Array)
      }));
      expect(wx.showToast).toHaveBeenCalledWith({ title: '已保存模板', icon: 'success' });
      // 不验证 setTimeout 内的 navigateBack
    });

    test('编辑：onFormSubmit 校验通过 → template.update + Toast + navigateBack', async () => {
      const ctx = setup();
      ctx.onLoad({ id: 't1' });
      await flush();
      ctx.onFormSubmit({ detail: {
        formData: {
          name: '模板A-改',
          scheduleType: 'AfterSchoolActivity',
          timeSlots: [{ dayOfWeek: 1, startTime: '10:00', endTime: '11:00' }],
          location: '家',
          notes: '测试'
        },
        valid: true
      }});
      await flush();
      expect(template.update).toHaveBeenCalledWith('t1', expect.objectContaining({
        name: '模板A-改'
      }));
      // update 不传 scheduleType（dto 决定）
      const updateArg = template.update.mock.calls[0][1];
      expect(updateArg.scheduleType).toBeUndefined();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '已更新模板', icon: 'success' });
      // 不验证 setTimeout 内的 navigateBack
    });

    test('校验失败（valid=false）→ 不调 create/update', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.onFormSubmit({ detail: { formData: { name: '' }, valid: false } });
      expect(template.create).not.toHaveBeenCalled();
    });

    test('提交失败 → Toast 显示后端 message', async () => {
      template.create.mockRejectedValue({ statusCode: 500, message: '保存失败' });
      const ctx = setup();
      ctx.onLoad({});
      ctx.onFormSubmit({ detail: {
        formData: { name: 'A', scheduleType: 'AfterSchoolActivity', timeSlots: [] },
        valid: true
      }});
      await flush();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '保存失败', icon: 'none' });
      expect(wx.navigateBack).not.toHaveBeenCalled();
    });
  });

  describe('WXML data-id 契约', () => {
    const fs = require('fs');
    const path = require('path');
    function readWxml() {
      return fs.readFileSync(path.resolve(__dirname, '../../pages/template-create/index.wxml'), 'utf8');
    }

    test('WXML 使用 schedule-form 组件 + bind:submit', () => {
      const wxml = readWxml();
      expect(wxml).toMatch(/<schedule-form[^>]*bind:submit/);
    });

    test('schedule-form 配置 4 个关键 prop', () => {
      const wxml = readWxml();
      expect(wxml).toMatch(/mode="\{\{mode\}\}"/);
      expect(wxml).toMatch(/initial-values="\{\{initialValues\}\}"/);
      expect(wxml).toMatch(/child-selector-visible="\{\{false\}\}"/);
      expect(wxml).toMatch(/start-date-visible="\{\{false\}\}"/);
      expect(wxml).toMatch(/schedule-type-locked="\{\{true\}\}"/);
    });
  });
});
