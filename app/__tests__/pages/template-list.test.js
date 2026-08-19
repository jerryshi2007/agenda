// app/__tests__/pages/template-list.test.js
// template-list 页面测试 —— 预设/自定义分区 + 搜索 + 新建入口 + use-template-dialog 弹窗

const mockTemplate = require('../helpers/template-mock');
jest.mock('../../services/template', () => mockTemplate);

const template = require('../../services/template');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  // 默认 list 返回空列表（避免未 mock 时 undefined）
  template.list.mockResolvedValue({
    data: { items: [], totalCount: 0, page: 1, pageSize: 20 }
  });
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(appDataOverrides = {}) {
  const appData = {
    childList: [{ userId: 'c1', childName: '小明' }],
    currentFamilyId: 'f1',
    ...appDataOverrides
  };
  const app = { globalData: appData };
  const { type, config } = loadPage('pages/template-list/index.js', { app });
  expect(type).toBe('page');
  const ctx = createPageContext(config);
  global.getApp = () => app;
  ctx.selectComponent = jest.fn(() => ({
    onConfirm: jest.fn(),
    onClose: jest.fn()
  }));
  return ctx;
}

function mockListResponse(presets = [], customs = [], total = presets.length + customs.length) {
  template.list.mockResolvedValue({
    data: { items: [...presets, ...customs], totalCount: total, page: 1, pageSize: 20 }
  });
}

function sampleTemplate(overrides = {}) {
  return {
    templateId: 't' + Math.random().toString(36).slice(2, 6),
    name: '模板',
    scheduleType: 'AfterSchoolActivity',
    isPreset: false,
    ...overrides
  };
}

describe('template-list 页面', () => {
  describe('onLoad/onShow', () => {
    test('onLoad 调 template.list 加载（带当前 familyId）', async () => {
      mockListResponse();
      const ctx = setup();
      ctx.onLoad({});
      await flush();
      expect(template.list).toHaveBeenCalled();
    });

    test('onLoad 解析 list 响应 → presets/customs 分区', async () => {
      const t1 = sampleTemplate({ templateId: 't1', isPreset: true, name: '预设1' });
      const t2 = sampleTemplate({ templateId: 't2', isPreset: false, name: '我的模板1' });
      mockListResponse([t1], [t2]);
      const ctx = setup();
      ctx.onLoad({});
      await flush();
      expect(ctx.data.presets.length).toBe(1);
      expect(ctx.data.customs.length).toBe(1);
      expect(ctx.data.presets[0].name).toBe('预设1');
      expect(ctx.data.customs[0].name).toBe('我的模板1');
    });

    test('onShow 重新加载（家庭切换后）', async () => {
      mockListResponse();
      const ctx = setup();
      ctx.onLoad({});
      await flush();
      template.list.mockClear();
      ctx.onShow();
      await flush();
      expect(template.list).toHaveBeenCalledTimes(1);
    });

    test('加载失败 → Toast', async () => {
      template.list.mockRejectedValue({ statusCode: 500, message: '加载失败' });
      const ctx = setup();
      ctx.onLoad({});
      await flush();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '加载失败', icon: 'none' });
    });
  });

  describe('搜索', () => {
    test('onSearchInput 更新 keyword', async () => {
      mockListResponse();
      const ctx = setup();
      ctx.onLoad({});
      await flush();
      ctx.onSearchInput({ detail: { value: '钢琴' } });
      expect(ctx.data.keyword).toBe('钢琴');
    });

    test('onSearch 触发 list 带 keyword', async () => {
      mockListResponse();
      const ctx = setup();
      ctx.onLoad({});
      await flush();
      template.list.mockClear();
      ctx.setData({ keyword: '钢琴' });
      ctx.onSearch();
      await flush();
      expect(template.list).toHaveBeenCalledWith(expect.objectContaining({ keyword: '钢琴' }));
    });

    test('onSearchClear 清空 keyword + 重新加载', async () => {
      mockListResponse();
      const ctx = setup();
      ctx.onLoad({});
      await flush();
      ctx.setData({ keyword: '钢琴' });
      ctx.onSearchClear();
      await flush();
      expect(ctx.data.keyword).toBe('');
    });
  });

  describe('模板点击', () => {
    test('点击预设模板 → 弹 use-template-dialog（不跳详情）', async () => {
      const t1 = sampleTemplate({ templateId: 't1', isPreset: true });
      mockListResponse([t1], []);
      const ctx = setup();
      ctx.onLoad({});
      await flush();
      ctx.onTapTemplate({ currentTarget: { dataset: { templateId: 't1' } } });
      expect(ctx.data.activeTemplate.templateId).toBe('t1');
      expect(ctx.data.dialogVisible).toBe(true);
    });

    test('点击自定义模板 → 跳详情页', async () => {
      const t2 = sampleTemplate({ templateId: 't2', isPreset: false });
      mockListResponse([], [t2]);
      const ctx = setup();
      ctx.onLoad({});
      await flush();
      ctx.onTapTemplate({ currentTarget: { dataset: { templateId: 't2' } } });
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/template-detail/index?id=t2' });
    });

    test('action=apply 模式：点击自定义模板 → 弹 dialog（不跳详情）', async () => {
      const t2 = sampleTemplate({ templateId: 't2', isPreset: false });
      mockListResponse([], [t2]);
      const ctx = setup();
      ctx.onLoad({ action: 'apply' });
      await flush();
      expect(ctx.data.actionApply).toBe(true);
      ctx.onTapTemplate({ currentTarget: { dataset: { templateId: 't2' } } });
      expect(ctx.data.activeTemplate.templateId).toBe('t2');
      expect(ctx.data.dialogVisible).toBe(true);
      expect(wx.navigateTo).not.toHaveBeenCalled();
    });
  });

  describe('新建/入口', () => {
    test('onTapAdd → 跳 template-create', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.onTapAdd();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/template-create/index' });
    });

    test('onTapEmptyAdd → 跳 template-create', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.onTapEmptyAdd();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/template-create/index' });
    });
  });

  describe('use-template-dialog 成功回调', () => {
    test('onDialogSuccess → 关弹窗 + 跳详情 + Toast', async () => {
      const t1 = sampleTemplate({ templateId: 't1', isPreset: true });
      mockListResponse([t1], []);
      const ctx = setup();
      ctx.onLoad({});
      await flush();
      ctx.setData({ dialogVisible: true });
      ctx.onDialogSuccess({ detail: { scheduleId: 's-new' } });
      expect(ctx.data.dialogVisible).toBe(false);
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('已生成') }));
      expect(wx.redirectTo).toHaveBeenCalledWith({ url: '/pages/schedule-detail/index?id=s-new' });
    });

    test('onDialogClose → 关弹窗', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.setData({ dialogVisible: true });
      ctx.onDialogClose();
      expect(ctx.data.dialogVisible).toBe(false);
    });
  });

  describe('WXML data-id 契约', () => {
    const fs = require('fs');
    const path = require('path');
    function readWxml() {
      return fs.readFileSync(path.resolve(__dirname, '../../pages/template-list/index.wxml'), 'utf8');
    }

    test('WXML 含搜索框/新建按钮 data-id', () => {
      const wxml = readWxml();
      expect(wxml).toContain('data-id="template-list-search-input"');
      expect(wxml).toContain('data-id="template-list-add-btn"');
      expect(wxml).toContain('data-id="template-list-empty-add-btn"');
    });

    test('WXML 含预设/自定义分区 data-id', () => {
      const wxml = readWxml();
      expect(wxml).toContain('data-id="template-list-preset-section"');
      expect(wxml).toContain('data-id="template-list-custom-section"');
    });

    test('WXML 含模板行 data-id（含 templateId 变量）', () => {
      const wxml = readWxml();
      expect(wxml).toMatch(/data-id="template-list-(preset|custom)-row-\{\{item\.templateId\}\}"/);
    });
  });
});
