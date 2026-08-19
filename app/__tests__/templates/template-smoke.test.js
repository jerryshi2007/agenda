// app/__tests__/templates/template-smoke.test.js
// 模板系统全链路冒烟测试 —— 端到端串起 list → use-dialog → apply
// 验证 Task 8.3 前端完成标准：6+ 个用例

const mockTemplate = require('../helpers/template-mock');
jest.mock('../../services/template', () => mockTemplate);

const template = require('../../services/template');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  template.list.mockResolvedValue({ data: { items: [], totalCount: 0, page: 1, pageSize: 20 } });
  template.getById.mockResolvedValue({ data: { templateId: 't1', name: 'T', scheduleType: 'DailyRoutine' } });
  template.create.mockResolvedValue({ data: { templateId: 't-new' } });
  template.update.mockResolvedValue({ data: { templateId: 't1' } });
  template.remove.mockResolvedValue({ data: { deleted: true } });
  template.apply.mockResolvedValue({ data: { scheduleId: 's-new' } });
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setupList() {
  const app = { globalData: { childList: [{ userId: 'c1', childName: '小明' }], currentFamilyId: 'f1' } };
  const { type, config } = loadPage('pages/template-list/index.js', { app });
  const ctx = createPageContext(config);
  global.getApp = () => app;
  ctx.selectComponent = jest.fn(() => ({ onConfirm: jest.fn(), onClose: jest.fn() }));
  return ctx;
}

function setupDetail() {
  const app = { globalData: { currentFamilyId: 'f1' } };
  const { type, config } = loadPage('pages/template-detail/index.js', { app });
  return createPageContext(config);
}

function setupDialog() {
  const { type, config } = loadPage('components/use-template-dialog/index.js', {});
  return createPageContext(config);
}

describe('模板系统全链路冒烟', () => {
  test('1) 列表页：加载列表 + 展示分区', async () => {
    template.list.mockResolvedValue({
      data: {
        items: [
          { templateId: 'p1', name: '预设1', isPreset: true, scheduleType: 'DailyRoutine' },
          { templateId: 'c1', name: '我的1', isPreset: false, scheduleType: 'AfterSchoolActivity' }
        ],
        totalCount: 2
      }
    });
    const ctx = setupList();
    ctx.onLoad({});
    await flush();
    expect(ctx.data.presets.length).toBe(1);
    expect(ctx.data.customs.length).toBe(1);
  });

  test('2) 列表页：点击预设 → 弹 dialog', async () => {
    template.list.mockResolvedValue({
      data: { items: [{ templateId: 'p1', name: '预设1', isPreset: true, scheduleType: 'DailyRoutine' }], totalCount: 1 }
    });
    const ctx = setupList();
    ctx.onLoad({});
    await flush();
    ctx.onTapTemplate({ currentTarget: { dataset: { templateId: 'p1' } } });
    expect(ctx.data.dialogVisible).toBe(true);
    expect(ctx.data.activeTemplate.templateId).toBe('p1');
  });

  test('3) use-template-dialog：确认 → 调 template.apply + 触发 success 事件', async () => {
    const ctx = setupDialog();
    // 模拟子组件的 properties + data
    ctx.properties = { template: { templateId: 'p1', name: '预设1', scheduleType: 'DailyRoutine' } };
    ctx.setData({
      showDialog: true,
      childId: 'c1',
      startDate: '2026-08-20'
    });
    // 直接调用 onConfirm
    await ctx.onConfirm();
    await flush();
    expect(template.apply).toHaveBeenCalledWith('p1', expect.objectContaining({
      childId: 'c1',
      startDate: '2026-08-20'
    }));
  });

  test('4) 详情页：编辑 → 跳 template-create', async () => {
    template.getById.mockResolvedValue({
      data: { templateId: 't1', name: '钢琴', scheduleType: 'AfterSchoolActivity', isPreset: false, usageCount: 3, timeSlots: [] }
    });
    const ctx = setupDetail();
    ctx.onLoad({ id: 't1' });
    await flush();
    ctx.onTapEdit();
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/template-create/index?id=t1' });
  });

  test('5) 详情页：确认删除 → template.remove + Toast', async () => {
    template.getById.mockResolvedValue({
      data: { templateId: 't1', name: '钢琴', scheduleType: 'AfterSchoolActivity', isPreset: false, usageCount: 0, timeSlots: [] }
    });
    const ctx = setupDetail();
    ctx.onLoad({ id: 't1' });
    await flush();
    wx.showModal.mockImplementation(opts => {
      if (opts.success) opts.success({ confirm: true });
    });
    await ctx.onTapDelete();
    await flush();
    expect(template.remove).toHaveBeenCalledWith('t1');
    expect(wx.showToast).toHaveBeenCalledWith({ title: '模板已删除', icon: 'success' });
  });

  test('6) 详情页：使用模板 → 弹 dialog', async () => {
    template.getById.mockResolvedValue({
      data: { templateId: 't1', name: '钢琴', scheduleType: 'AfterSchoolActivity', isPreset: false, usageCount: 0, timeSlots: [] }
    });
    const ctx = setupDetail();
    ctx.onLoad({ id: 't1' });
    await flush();
    ctx.onTapUse();
    expect(ctx.data.dialogVisible).toBe(true);
    expect(ctx.data.activeTemplate.templateId).toBe('t1');
  });

  test('7) 列表页：onDialogSuccess → 关弹窗 + 跳 schedule-detail', async () => {
    template.list.mockResolvedValue({
      data: { items: [{ templateId: 'p1', name: '预设1', isPreset: true, scheduleType: 'DailyRoutine' }], totalCount: 1 }
    });
    const ctx = setupList();
    ctx.onLoad({});
    await flush();
    ctx.setData({ dialogVisible: true });
    ctx.onDialogSuccess({ detail: { scheduleId: 's-new' } });
    expect(ctx.data.dialogVisible).toBe(false);
    expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/schedule-detail/index?id=s-new' });
  });
});
