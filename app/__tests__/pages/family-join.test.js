// app/__tests__/pages/family-join.test.js
// family-join 页面测试：6 位邀请码输入（仅 2-9）、提交 join-by-code、成功跳日历、失败按错误码提示

const mockFamily = require('../helpers/family-mock');
jest.mock('../../services/family', () => mockFamily);

const family = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ErrorCodes, ErrorMessages } = require('../../contracts/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  wx.getStorageSync.mockReturnValue(null);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(opts = {}) {
  const { type, config } = loadPage('pages/family-join/index.js', opts);
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('family-join 页面', () => {
  test('onLoad 从 query.inviteCode 预填（来自分享卡片）', () => {
    const ctx = setup({ app: { globalData: {} } });
    ctx.onLoad({ inviteCode: '234567' });
    expect(ctx.data.code).toBe('234567');
    expect(ctx.data.codeLength).toBe(6);
    expect(ctx.data.valid).toBe(true);
  });

  test('onLoad 无 inviteCode 时初始为空', () => {
    const ctx = setup();
    ctx.onLoad({});
    expect(ctx.data.code).toBe('');
    expect(ctx.data.valid).toBe(false);
  });

  test('onCodeInput 拼接数字并校验格式（仅 2-9）', () => {
    const ctx = setup();
    ctx.onCodeInput({ detail: { value: '234ab8' } });
    expect(ctx.data.code).toBe('2348');
    expect(ctx.data.codeLength).toBe(4);
    expect(ctx.data.valid).toBe(false);
  });

  test('onCodeInput 排除 0/1（避免孩子输入混淆）', () => {
    const ctx = setup();
    ctx.onCodeInput({ detail: { value: '012345' } });
    expect(ctx.data.code).toBe('2345');
  });

  test('code 满 6 位且为 2-9 时 valid=true', () => {
    const ctx = setup();
    ctx.onCodeInput({ detail: { value: '234567' } });
    expect(ctx.data.valid).toBe(true);
  });

  test('onBack 返回上一页', () => {
    const ctx = setup();
    ctx.onBack();
    expect(wx.navigateBack).toHaveBeenCalled();
  });

  test('onSubmit 校验未通过不调 API', async () => {
    const ctx = setup();
    ctx.onCodeInput({ detail: { value: '234' } });
    await ctx.onSubmit();
    expect(family.joinByCode).not.toHaveBeenCalled();
  });

  test('onSubmit 校验通过调 joinByCode，成功后存 current family id 并 switchTab', async () => {
    family.joinByCode.mockResolvedValue({ familyId: 'f-joined' });
    const ctx = setup();
    ctx.onCodeInput({ detail: { value: '234567' } });
    await ctx.onSubmit();
    expect(family.joinByCode).toHaveBeenCalledWith('234567');
    expect(wx.setStorageSync).toHaveBeenCalledWith(STORAGE_KEYS.CURRENT_FAMILY_ID, 'f-joined');
    expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' });
  });

  test('INVALID_INVITATION_CODE 错误展示 contracts 错误信息', async () => {
    family.joinByCode.mockRejectedValue({ error: ErrorCodes.INVALID_INVITATION_CODE, message: ErrorMessages.INVALID_INVITATION_CODE });
    const ctx = setup();
    ctx.onCodeInput({ detail: { value: '234567' } });
    await ctx.onSubmit();
    expect(ctx.data.error).toBe(ErrorMessages.INVALID_INVITATION_CODE);
    expect(wx.switchTab).not.toHaveBeenCalled();
  });

  test('INVITATION_CODE_EXPIRED 错误展示 contracts 错误信息', async () => {
    family.joinByCode.mockRejectedValue({ error: ErrorCodes.INVITATION_CODE_EXPIRED, message: ErrorMessages.INVITATION_CODE_EXPIRED });
    const ctx = setup();
    ctx.onCodeInput({ detail: { value: '234567' } });
    await ctx.onSubmit();
    expect(ctx.data.error).toBe(ErrorMessages.INVITATION_CODE_EXPIRED);
  });

  test('USER_ALREADY_IN_FAMILY 错误展示 contracts 错误信息', async () => {
    family.joinByCode.mockRejectedValue({ error: ErrorCodes.USER_ALREADY_IN_FAMILY, message: ErrorMessages.USER_ALREADY_IN_FAMILY });
    const ctx = setup();
    ctx.onCodeInput({ detail: { value: '234567' } });
    await ctx.onSubmit();
    expect(ctx.data.error).toBe(ErrorMessages.USER_ALREADY_IN_FAMILY);
  });

  test('FAMILY_MEMBER_LIMIT_EXCEEDED 错误展示 contracts 错误信息', async () => {
    family.joinByCode.mockRejectedValue({ error: ErrorCodes.FAMILY_MEMBER_LIMIT_EXCEEDED, message: ErrorMessages.FAMILY_MEMBER_LIMIT_EXCEEDED });
    const ctx = setup();
    ctx.onCodeInput({ detail: { value: '234567' } });
    await ctx.onSubmit();
    expect(ctx.data.error).toBe(ErrorMessages.FAMILY_MEMBER_LIMIT_EXCEEDED);
  });

  test('其他错误展示 err.message（透传 contracts）', async () => {
    family.joinByCode.mockRejectedValue({ error: 'OTHER_ERR', message: '其他错误' });
    const ctx = setup();
    ctx.onCodeInput({ detail: { value: '234567' } });
    await ctx.onSubmit();
    expect(ctx.data.error).toBe('其他错误');
  });
});
