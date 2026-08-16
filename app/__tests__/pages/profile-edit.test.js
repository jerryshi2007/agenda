// app/__tests__/pages/profile-edit.test.js
const mockAuth = require('../helpers/auth-mock');
jest.mock('../../services/auth', () => mockAuth);

const auth = require('../../services/auth');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const { type, config } = loadPage('pages/profile-edit/index.js');
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('profile-edit 页面', () => {
  test('onLoad 加载当前资料', async () => {
    auth.getProfile.mockResolvedValue({ userId: 'u', nickname: '小明', avatarUrl: 'https://x/1.png' });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.loading).toBe(false);
    expect(ctx.data.nickname).toBe('小明');
    expect(ctx.data.avatarUrl).toBe('https://x/1.png');
  });

  test('onChooseAvatar 记录本地待上传路径并标记变更', () => {
    const ctx = setup();
    ctx.onChooseAvatar({ detail: { avatarUrl: '/tmp/a.png' } });
    expect(ctx.data.avatarChanged).toBe(true);
    expect(ctx.data.avatarTempPath).toBe('/tmp/a.png');
  });

  test('昵称为空时拦截并显示错误', () => {
    const ctx = setup();
    ctx.data.nickname = '   ';
    ctx.onSave();
    expect(ctx.data.error).toBe('昵称不能为空');
    expect(auth.updateProfile).not.toHaveBeenCalled();
  });

  test('昵称超长时拦截并显示错误', () => {
    const ctx = setup();
    ctx.data.nickname = '超'.repeat(21);
    ctx.onSave();
    expect(ctx.data.error).toBe('昵称不能超过 20 个字符');
    expect(auth.updateProfile).not.toHaveBeenCalled();
  });

  test('头像未变更时仅调用 updateProfile 后返回', async () => {
    auth.updateProfile.mockResolvedValue({ nickname: '小明' });
    const ctx = setup();
    ctx.data.nickname = '小明';
    ctx.data.avatarUrl = 'https://x/old.png';
    ctx.data.avatarChanged = false;
    ctx.onSave();
    await flush();
    expect(auth.uploadAvatar).not.toHaveBeenCalled();
    expect(auth.updateProfile).toHaveBeenCalledWith({ nickname: '小明', avatarUrl: 'https://x/old.png' });
    expect(wx.navigateBack).toHaveBeenCalled();
  });

  test('头像变更时先上传再更新资料（事务一致）', async () => {
    auth.uploadAvatar.mockResolvedValue({ url: 'https://x/new.png' });
    auth.updateProfile.mockResolvedValue({ nickname: '小明' });
    const ctx = setup();
    ctx.data.nickname = '小明';
    ctx.data.avatarTempPath = '/tmp/new.png';
    ctx.data.avatarChanged = true;
    ctx.onSave();
    await flush();
    expect(auth.uploadAvatar).toHaveBeenCalledWith('/tmp/new.png');
    expect(auth.updateProfile).toHaveBeenCalledWith({ nickname: '小明', avatarUrl: 'https://x/new.png' });
    expect(wx.navigateBack).toHaveBeenCalled();
  });

  test('头像上传失败时不保存昵称修改', async () => {
    auth.uploadAvatar.mockRejectedValue({ error: 'FILE_TOO_LARGE', message: '头像文件过大' });
    const ctx = setup();
    ctx.data.nickname = '小明';
    ctx.data.avatarTempPath = '/tmp/big.png';
    ctx.data.avatarChanged = true;
    ctx.onSave();
    await flush();
    expect(auth.updateProfile).not.toHaveBeenCalled();
    expect(wx.navigateBack).not.toHaveBeenCalled();
    expect(wx.showToast).toHaveBeenCalled();
  });

  test('onCancel 返回上一页', () => {
    const ctx = setup();
    ctx.onCancel();
    expect(wx.navigateBack).toHaveBeenCalled();
  });
});
