// app/__tests__/pages/family-display-mode.test.js
// family-display-mode 页面测试：默认从 URL query 读取初始 mode、三模式选择、保存调用 setDisplayMode

const mockFamily = require('../helpers/family-mock');
jest.mock('../../services/family', () => mockFamily);

const family = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { DisplayMode, DisplayModeLabels, ErrorMessages } = require('../../contracts/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  wx.getStorageSync.mockImplementation((k) => k === STORAGE_KEYS.CURRENT_FAMILY_ID ? 'f-current' : null);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(query = {}) {
  const { type, config } = loadPage('pages/family-display-mode/index.js', { query });
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('family-display-mode 页面', () => {
  test('onLoad 读取 query.mode 初始化', () => {
    const ctx = setup({ mode: 'Preschool' });
    ctx.onLoad({ mode: 'Preschool' });
    expect(ctx.data.currentMode).toBe('Preschool');
    expect(ctx.data.selectedMode).toBe('Preschool');
  });

  test('onLoad query.mode 缺失时默认 Primary', () => {
    const ctx = setup({});
    ctx.onLoad({});
    expect(ctx.data.currentMode).toBe(DisplayMode.Primary);
    expect(ctx.data.selectedMode).toBe(DisplayMode.Primary);
  });

  test('displayModes 列表含三种模式 + 中文标签', () => {
    const ctx = setup();
    expect(ctx.data.displayModes).toEqual(expect.arrayContaining([
      expect.objectContaining({ mode: DisplayMode.Preschool, label: DisplayModeLabels.Preschool }),
      expect.objectContaining({ mode: DisplayMode.Primary, label: DisplayModeLabels.Primary }),
      expect.objectContaining({ mode: DisplayMode.UpperGrades, label: DisplayModeLabels.UpperGrades })
    ]));
  });

  test('onSelectMode 切换 selectedMode', () => {
    const ctx = setup();
    ctx.onLoad({ mode: 'Preschool' });
    ctx.onSelectMode({ currentTarget: { dataset: { mode: 'UpperGrades' } } });
    expect(ctx.data.selectedMode).toBe('UpperGrades');
  });

  test('onSave 调 setDisplayMode，参数为 memberId 和 selectedMode', async () => {
    family.setDisplayMode.mockResolvedValue({ ok: true });
    const ctx = setup();
    ctx.onLoad({ mode: 'Primary', memberId: 'm-child-1' });
    ctx.onSelectMode({ currentTarget: { dataset: { mode: 'Preschool' } } });
    await ctx.onSave();
    expect(family.setDisplayMode).toHaveBeenCalledWith('m-child-1', 'Preschool');
  });

  test('onSave 未传 memberId 时不调 API（页面不直接决定）', async () => {
    const ctx = setup();
    ctx.onLoad({ mode: 'Primary' });
    await ctx.onSave();
    expect(family.setDisplayMode).not.toHaveBeenCalled();
  });

  test('onSave 失败时设置 errorMessage', async () => {
    family.setDisplayMode.mockRejectedValue({ message: ErrorMessages.PERMISSION_DENIED });
    const ctx = setup();
    ctx.onLoad({ mode: 'Primary', memberId: 'm1' });
    ctx.onSelectMode({ currentTarget: { dataset: { mode: 'Preschool' } } });
    await ctx.onSave();
    expect(ctx.data.errorMessage).toBe(ErrorMessages.PERMISSION_DENIED);
  });

  test('onSave 成功时设置 success=true', async () => {
    family.setDisplayMode.mockResolvedValue({ ok: true });
    const ctx = setup();
    ctx.onLoad({ mode: 'Primary', memberId: 'm1' });
    ctx.onSelectMode({ currentTarget: { dataset: { mode: 'Preschool' } } });
    await ctx.onSave();
    expect(ctx.data.success).toBe(true);
  });

  test('disabled = (selectedMode === currentMode) 且未选过新模式', () => {
    const ctx = setup();
    ctx.onLoad({ mode: 'Preschool' });
    expect(ctx.data.selectedMode).toBe('Preschool');
    expect(ctx.data.disabled).toBe(true);
  });

  test('切换到不同模式后 disabled 变为 false', () => {
    const ctx = setup();
    ctx.onLoad({ mode: 'Preschool' });
    ctx.onSelectMode({ currentTarget: { dataset: { mode: 'UpperGrades' } } });
    expect(ctx.data.disabled).toBe(false);
  });

  test('saving 期间防止重复保存', async () => {
    let resolveApi;
    family.setDisplayMode.mockImplementation(() => new Promise((r) => { resolveApi = r; }));
    const ctx = setup();
    ctx.onLoad({ mode: 'Primary', memberId: 'm1' });
    ctx.onSelectMode({ currentTarget: { dataset: { mode: 'Preschool' } } });
    const p1 = ctx.onSave();
    const p2 = ctx.onSave();
    expect(ctx.data.saving).toBe(true);
    resolveApi({ ok: true });
    await p1;
    await p2;
    expect(family.setDisplayMode).toHaveBeenCalledTimes(1);
  });
});
