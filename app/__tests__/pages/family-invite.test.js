// app/__tests__/pages/family-invite.test.js
// family-invite 页面测试：选择邀请类型（家长/孩子）、孩子需姓名+展示模式、生成邀请码展示

const mockFamily = require('../helpers/family-mock');
jest.mock('../../services/family', () => mockFamily);

const family = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ErrorCodes, ErrorMessages, UserRole, DisplayMode } = require('../../contracts/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  // 默认有 current family id
  wx.getStorageSync.mockImplementation((k) => k === STORAGE_KEYS.CURRENT_FAMILY_ID ? 'f-current' : null);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(opts = {}) {
  const { type, config } = loadPage('pages/family-invite/index.js', opts);
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('family-invite 页面', () => {
  test('onLoad 默认角色为 Parent（不展开孩子表单）', () => {
    const ctx = setup();
    ctx.onLoad();
    expect(ctx.data.targetRole).toBe('Parent');
    expect(ctx.data.childFormVisible).toBe(false);
  });

  test('onSelectType 切换为 Child 时展开孩子表单', () => {
    const ctx = setup();
    ctx.onSelectType({ currentTarget: { dataset: { role: 'Child' } } });
    expect(ctx.data.targetRole).toBe('Child');
    expect(ctx.data.childFormVisible).toBe(true);
  });

  test('onSelectType 切换为 Parent 时收起孩子表单', () => {
    const ctx = setup();
    ctx.onSelectType({ currentTarget: { dataset: { role: 'Child' } } });
    ctx.onSelectType({ currentTarget: { dataset: { role: 'Parent' } } });
    expect(ctx.data.childFormVisible).toBe(false);
  });

  test('onChildNameInput 同步姓名输入', () => {
    const ctx = setup();
    ctx.onChildNameInput({ detail: { value: '小明' } });
    expect(ctx.data.childName).toBe('小明');
  });

  test('onSelectDisplayMode 切换展示模式', () => {
    const ctx = setup();
    ctx.onSelectDisplayMode({ currentTarget: { dataset: { mode: 'UpperGrades' } } });
    expect(ctx.data.targetDisplayMode).toBe('UpperGrades');
    expect(ctx.data.displayModeLabel).toBe('高年级');
  });

  test('onSelectDisplayMode 切换为 Preschool', () => {
    const ctx = setup();
    ctx.onSelectDisplayMode({ currentTarget: { dataset: { mode: 'Preschool' } } });
    expect(ctx.data.displayModeLabel).toBe('学龄前');
  });

  test('valid 在 Parent 时为 true', () => {
    const ctx = setup();
    expect(ctx.data.valid).toBe(true);
  });

  test('valid 在 Child 且无姓名时为 false', () => {
    const ctx = setup();
    ctx.onSelectType({ currentTarget: { dataset: { role: 'Child' } } });
    expect(ctx.data.valid).toBe(false);
  });

  test('valid 在 Child 且有姓名时有默认展示模式为 true', () => {
    const ctx = setup();
    ctx.onSelectType({ currentTarget: { dataset: { role: 'Child' } } });
    ctx.onChildNameInput({ detail: { value: '小明' } });
    expect(ctx.data.valid).toBe(true);
  });

  test('onSubmit 校验未通过不调 API', async () => {
    const ctx = setup();
    ctx.onSelectType({ currentTarget: { dataset: { role: 'Child' } } });
    await ctx.onSubmit();
    expect(family.generateInviteCode).not.toHaveBeenCalled();
  });

  test('onSubmit Parent 模式调 generateInviteCode，body 仅含 targetRole', async () => {
    family.generateInviteCode.mockResolvedValue({ code: '234567', expiresAt: '2026-08-19T00:00:00Z' });
    const ctx = setup();
    await ctx.onSubmit();
    expect(family.generateInviteCode).toHaveBeenCalledWith('f-current', { targetRole: 'Parent' });
    expect(ctx.data.code).toBe('234567');
    expect(ctx.data.expiresAt).toBe('2026-08-19T00:00:00Z');
    expect(ctx.data.codeVisible).toBe(true);
  });

  test('onSubmit Child 模式调 generateInviteCode，body 含 childName + displayMode', async () => {
    family.generateInviteCode.mockResolvedValue({ code: '345678', expiresAt: '2026-08-19T00:00:00Z' });
    const ctx = setup();
    ctx.onSelectType({ currentTarget: { dataset: { role: 'Child' } } });
    ctx.onChildNameInput({ detail: { value: '小明' } });
    ctx.onSelectDisplayMode({ currentTarget: { dataset: { mode: 'UpperGrades' } } });
    await ctx.onSubmit();
    expect(family.generateInviteCode).toHaveBeenCalledWith('f-current', {
      targetRole: 'Child',
      targetChildName: '小明',
      targetDisplayMode: 'UpperGrades'
    });
  });

  test('FAMILY_MEMBER_LIMIT_EXCEEDED 错误展示 contracts 错误信息', async () => {
    family.generateInviteCode.mockRejectedValue({ error: ErrorCodes.FAMILY_MEMBER_LIMIT_EXCEEDED, message: ErrorMessages.FAMILY_MEMBER_LIMIT_EXCEEDED });
    const ctx = setup();
    await ctx.onSubmit();
    expect(ctx.data.error).toBe(ErrorMessages.FAMILY_MEMBER_LIMIT_EXCEEDED);
  });

  test('生成后点重新生成重置 codeVisible 并可重新生成', async () => {
    family.generateInviteCode.mockResolvedValueOnce({ code: '234567', expiresAt: '2026-08-19T00:00:00Z' });
    const ctx = setup();
    await ctx.onSubmit();
    expect(ctx.data.codeVisible).toBe(true);
    ctx.onRegenerate();
    expect(ctx.data.codeVisible).toBe(false);
  });

  test('onCopyCode 复制邀请码到剪贴板', () => {
    const ctx = setup();
    ctx.setData({ code: '234567' });
    ctx.onCopyCode();
    expect(wx.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: '234567' }));
  });

  test('onShareAppMessage 携带邀请码到分享路径', () => {
    const ctx = setup();
    ctx.setData({ code: '234567' });
    const share = ctx.onShareAppMessage();
    expect(share.path).toBe('/pages/family-welcome/index?inviteCode=234567');
  });

  test('onShareAppMessage 无邀请码时仅返回 welcome 路径', () => {
    const ctx = setup();
    const share = ctx.onShareAppMessage();
    expect(share.path).toBe('/pages/family-welcome/index');
  });
});
