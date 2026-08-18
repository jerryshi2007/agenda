// app/__tests__/pages/family-create.test.js
// family-create 页面测试：onLoad 校验无家庭、onNameInput 同步输入、role 切换、onSubmit 提交创建、成功跳日历、失败按错误码提示

const mockFamily = require('../helpers/family-mock');
jest.mock('../../services/family', () => mockFamily);

const family = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ErrorCodes, ErrorMessages, UserRole } = require('../../contracts/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  // 默认无 current family
  wx.getStorageSync.mockReturnValue(null);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(opts = {}) {
  const { type, config } = loadPage('pages/family-create/index.js', opts);
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('family-create 页面', () => {
  test('onLoad 校验无家庭后初始化表单（默认角色为 Parent）', () => {
    const ctx = setup();
    expect(ctx.data.role).toBe('Parent');
    expect(ctx.data.name).toBe('');
  });

  test('onNameInput 同步输入并触发 charCount 更新', () => {
    const ctx = setup();
    ctx.onNameInput({ detail: { value: '我的家' } });
    expect(ctx.data.name).toBe('我的家');
    expect(ctx.data.charCount).toBe(3);
  });

  test('onSelectRole 切换为 Child 角色', () => {
    const ctx = setup();
    ctx.onSelectRole({ currentTarget: { dataset: { role: 'Child' } } });
    expect(ctx.data.role).toBe('Child');
  });

  // 回归防护：role 卡片直接绑定 onSelectRole，避免再次出现"role-mask + onRolePicker/onCloseRolePicker 死链"模式
  test('role card 切换为 Child 时 WXML 数据契约：dataset.role=Child → role=Child', () => {
    const ctx = setup();
    // 模拟 WXML 中 data-role="Child" 的卡片点击事件
    ctx.onSelectRole({ currentTarget: { dataset: { role: 'Child' } } });
    expect(ctx.data.role).toBe('Child');
    expect(ctx.data.roleLabel).toBe('孩子');
  });

  test('role card 切换为 Parent 时：role=Parent 且 roleHint 被清空', () => {
    const ctx = setup();
    ctx.onSelectRole({ currentTarget: { dataset: { role: 'Child' } } });
    expect(ctx.data.roleHint).not.toBe('');
    ctx.onSelectRole({ currentTarget: { dataset: { role: 'Parent' } } });
    expect(ctx.data.role).toBe('Parent');
    expect(ctx.data.roleHint).toBe('');
  });

  test('JS 未定义 onRolePicker / onCloseRolePicker / rolePickerVisible（防止死链回流）', () => {
    const ctx = setup();
    expect(typeof ctx.onRolePicker).toBe('undefined');
    expect(typeof ctx.onCloseRolePicker).toBe('undefined');
    expect(ctx.data.rolePickerVisible).toBeUndefined();
  });

  test('valid = false 当 name 长度 < 2', () => {
    const ctx = setup();
    ctx.onNameInput({ detail: { value: '我' } });
    expect(ctx.data.valid).toBe(false);
  });

  test('valid = true 当 name 长度 2-20', () => {
    const ctx = setup();
    ctx.onNameInput({ detail: { value: '我的家' } });
    expect(ctx.data.valid).toBe(true);
  });

  test('valid = false 当 name 长度 > 20', () => {
    const ctx = setup();
    ctx.onNameInput({ detail: { value: '一二三四五六七八九十一二三四五六七八九十一' } });
    expect(ctx.data.valid).toBe(false);
  });

  test('onSubmit 校验未通过不调 API', async () => {
    const ctx = setup();
    ctx.onNameInput({ detail: { value: '我' } });
    await ctx.onSubmit();
    expect(family.createFamily).not.toHaveBeenCalled();
  });

  test('onSubmit 校验通过调 createFamily，成功后存 current family id 并 switchTab 到日历', async () => {
    family.createFamily.mockResolvedValue({ familyId: 'f-new' });
    const ctx = setup();
    ctx.onNameInput({ detail: { value: '我的家' } });
    ctx.onSelectRole({ currentTarget: { dataset: { role: 'Parent' } } });
    await ctx.onSubmit();
    expect(family.createFamily).toHaveBeenCalledWith({ name: '我的家', role: 'Parent' });
    expect(wx.setStorageSync).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_FAMILY_ID, 'f-new');
    expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' });
  });

  test('FAMILY_NAME_INVALID_LENGTH 错误展示 contracts 错误信息', async () => {
    family.createFamily.mockRejectedValue({ error: ErrorCodes.FAMILY_NAME_INVALID_LENGTH, message: ErrorMessages.FAMILY_NAME_INVALID_LENGTH });
    const ctx = setup();
    ctx.onNameInput({ detail: { value: '我的家' } });
    await ctx.onSubmit();
    expect(ctx.data.error).toBe(ErrorMessages.FAMILY_NAME_INVALID_LENGTH);
    expect(wx.switchTab).not.toHaveBeenCalled();
  });

  test('其他错误展示 contracts 通用 message（不硬编码）', async () => {
    family.createFamily.mockRejectedValue({ error: 'SOME_OTHER', message: '其他错误' });
    const ctx = setup();
    ctx.onNameInput({ detail: { value: '我的家' } });
    await ctx.onSubmit();
    expect(ctx.data.error).toBe('其他错误');
  });
});
