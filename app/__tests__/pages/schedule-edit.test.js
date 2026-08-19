// app/__tests__/pages/schedule-edit.test.js
// schedule-edit 页面测试 —— 复用 schedule-form 子组件 + editScope + rowVersion 乐观锁

const mockSchedule = require('../helpers/schedule-mock');
jest.mock('../../services/schedule', () => mockSchedule);

const schedule = require('../../services/schedule');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(appDataOverrides = {}) {
  const appData = { childList: [{ userId: 'c1', childName: '小明' }], ...appDataOverrides };
  const app = { globalData: appData };
  const { type, config } = loadPage('pages/schedule-edit/index.js', { app });
  expect(type).toBe('page');
  const ctx = createPageContext(config);
  global.getApp = () => app;
  // mock selectComponent：返回 schedule-form 子组件的桩
  // form.onSubmit 模拟 triggerEvent('submit', { detail: { formData, valid } })
  ctx.selectComponent = jest.fn(() => {
    const formComp = {
      onSubmit: jest.fn(),
      _validate: jest.fn(() => true),
      data: { formData: {} }
    };
    formComp.onSubmit = jest.fn(() => {
      if (typeof ctx.onFormSubmit === 'function') {
        ctx.onFormSubmit({ detail: { formData: formComp.data.formData, valid: true } });
      }
    });
    return formComp;
  });
  return ctx;
}

function mockLoad(extra = {}) {
  schedule.getById.mockResolvedValue({
    data: {
      scheduleId: 's1',
      name: '钢琴课',
      scheduleType: 'AfterSchoolActivity',
      timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }],
      location: '少年宫',
      notes: '带教材',
      rowVersion: 'v1',
      ...extra
    }
  });
}

describe('schedule-edit 页面', () => {
  describe('onLoad 初始化', () => {
    test('缺少 scheduleId 时 Toast + navigateBack', async () => {
      const ctx = setup();
      ctx.onLoad({});
      expect(wx.showToast).toHaveBeenCalledWith({ title: '缺少日程信息', icon: 'none' });
      expect(wx.navigateBack).toHaveBeenCalled();
    });

    test('scheduleService.getById 调用含 scheduleId + targetDate', async () => {
      mockLoad();
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1', date: '2026-08-20' });
      await flush();
      expect(schedule.getById).toHaveBeenCalledWith('s1', '2026-08-20');
    });

    test('targetDate 为空时用今天', async () => {
      mockLoad();
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1' });
      await flush();
      const callArgs = schedule.getById.mock.calls[0];
      expect(callArgs[0]).toBe('s1');
      expect(callArgs[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('加载成功：填充 formData + rowVersion + isHomework', async () => {
      mockLoad();
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1' });
      await flush();
      expect(ctx.data.formData.name).toBe('钢琴课');
      expect(ctx.data.formData.timeSlots.length).toBe(1);
      expect(ctx.data.rowVersion).toBe('v1');
      expect(ctx.data.isHomework).toBe(false);
      expect(ctx.data.scheduleType).toBe('AfterSchoolActivity');
    });

    test('HomeworkTask 类型：isHomework=true', async () => {
      mockLoad({ scheduleType: 'HomeworkTask', timeSlots: [], dueDate: '2026-08-30' });
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1' });
      await flush();
      expect(ctx.data.isHomework).toBe(true);
      expect(ctx.data.formData.dueDate).toBe('2026-08-30');
    });

    test('加载失败 SCHEDULE_NOT_FOUND：Toast + navigateBack', async () => {
      schedule.getById.mockRejectedValue({ data: { error: 'SCHEDULE_NOT_FOUND' } });
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1' });
      await flush();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '该日程已被删除', icon: 'none' });
      expect(wx.navigateBack).toHaveBeenCalled();
    });

    test('加载失败（其他错误）：Toast 加载失败', async () => {
      schedule.getById.mockRejectedValue({ statusCode: 500, message: '服务器错误' });
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1' });
      await flush();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '加载失败', icon: 'none' });
    });
  });

  describe('onScopeChange', () => {
    test('更新 editScope', async () => {
      mockLoad();
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1' });
      await flush();
      ctx.onScopeChange({ detail: { scope: 'ThisAndFuture' } });
      expect(ctx.data.editScope).toBe('ThisAndFuture');
    });
  });

  describe('onFormSubmit 回调', () => {
    test('校验通过：进入"待保存"态，缓存 formData', async () => {
      mockLoad();
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1' });
      await flush();
      const formData = {
        name: '钢琴课（修改）',
        scheduleType: 'AfterSchoolActivity',
        timeSlots: [{ dayOfWeek: 3, startTime: '16:30', endTime: '17:30' }],
        location: '少年宫',
        notes: ''
      };
      ctx.onFormSubmit({ detail: { formData, valid: true } });
      expect(ctx.data.formData.name).toBe('钢琴课（修改）');
      expect(ctx.data.formData.location).toBe('少年宫');
      expect(ctx.data.formData.timeSlots[0].startTime).toBe('16:30');
    });

    test('校验失败：保留 formData 不变', async () => {
      mockLoad();
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1' });
      await flush();
      const originalName = ctx.data.formData.name;
      ctx.onFormSubmit({ detail: { formData: { name: '' }, valid: false } });
      expect(ctx.data.formData.name).toBe(originalName);
    });
  });

  describe('onSave', () => {
    async function setupLoaded() {
      mockLoad();
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1' });
      await flush();
      // 把页面 formData 同步给 form mock（模拟 schedule-form 的 initialValues 注入）
      const fd = Object.assign({}, ctx.data.formData);
      ctx.selectComponent = jest.fn(() => {
        const formComp = {
          onSubmit: jest.fn(),
          _validate: jest.fn(() => true),
          data: { formData: fd }
        };
        formComp.onSubmit = jest.fn(() => {
          if (typeof ctx.onFormSubmit === 'function') {
            ctx.onFormSubmit({ detail: { formData: formComp.data.formData, valid: true } });
          }
        });
        return formComp;
      });
      return ctx;
    }

    test('调 scheduleService.update 完整请求体（含 scope/date/rowVersion）', async () => {
      schedule.update.mockResolvedValue({});
      const ctx = await setupLoaded();
      await ctx.onSave();
      expect(schedule.update).toHaveBeenCalledWith('s1', expect.objectContaining({
        scope: 'ThisOnly',
        date: expect.any(String),
        name: '钢琴课',
        rowVersion: 'v1',
        timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }],
        location: '少年宫',
        notes: '带教材'
      }));
    });

    test('HomeworkTask 请求体不含 timeSlots，含 dueDate', async () => {
      mockLoad({ scheduleType: 'HomeworkTask', timeSlots: [], dueDate: '2026-08-30' });
      schedule.update.mockResolvedValue({});
      const ctx = setup();
      ctx.onLoad({ scheduleId: 's1' });
      await flush();
      await ctx.onSave();
      const req = schedule.update.mock.calls[0][1];
      expect(req.dueDate).toBe('2026-08-30');
      expect(req.timeSlots).toBeUndefined();
    });

    test('editScope=ThisAndFuture 透传', async () => {
      schedule.update.mockResolvedValue({});
      const ctx = await setupLoaded();
      ctx.data.editScope = 'ThisAndFuture';
      await ctx.onSave();
      expect(schedule.update.mock.calls[0][1].scope).toBe('ThisAndFuture');
    });

    test('成功：Toast 保存成功 + navigateBack', async () => {
      schedule.update.mockResolvedValue({});
      const ctx = await setupLoaded();
      await ctx.onSave();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '保存成功', icon: 'success' });
    });

    test('saving=true 时不重复提交', async () => {
      schedule.update.mockReturnValue(new Promise(() => {}));
      const ctx = await setupLoaded();
      ctx.data.saving = true;
      await ctx.onSave();
      expect(schedule.update).not.toHaveBeenCalled();
    });

    test('CONCURRENT_EDIT_CONFLICT (409) → 弹窗 + 刷新后重新编辑', async () => {
      schedule.update.mockRejectedValue({ statusCode: 409, data: { error: 'CONCURRENT_EDIT_CONFLICT' } });
      const ctx = await setupLoaded();
      await ctx.onSave();
      expect(wx.showModal).toHaveBeenCalledWith(expect.objectContaining({
        title: '编辑冲突'
      }));
    });

    test('CHILD_NOT_IN_FAMILY → Toast', async () => {
      schedule.update.mockRejectedValue({ statusCode: 400, data: { error: 'CHILD_NOT_IN_FAMILY' } });
      const ctx = await setupLoaded();
      await ctx.onSave();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '关联孩子已不在家庭中', icon: 'none' });
    });

    test('其他错误：Toast 显示后端 message', async () => {
      schedule.update.mockRejectedValue({ statusCode: 500, message: '服务器内部错误' });
      const ctx = await setupLoaded();
      await ctx.onSave();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '服务器内部错误', icon: 'none' });
    });
  });

  describe('WXML data-id 契约', () => {
    const fs = require('fs');
    const path = require('path');
    function readWxml() {
      return fs.readFileSync(path.resolve(__dirname, '../../pages/schedule-edit/index.wxml'), 'utf8');
    }

    test('WXML 含编辑范围/保存按钮 data-id', () => {
      const wxml = readWxml();
      expect(wxml).toContain('data-id="schedule-edit-scope"');
      expect(wxml).toContain('data-id="schedule-edit-save-btn"');
    });

    test('WXML 含 schedule-form 组件引用', () => {
      const wxml = readWxml();
      expect(wxml).toMatch(/<schedule-form[\s>]/);
    });
  });
});
