// app/__tests__/pages/family-invite-list.test.js
// family-invite-list 页面测试：拉取邀请记录列表、按状态分组、撤销待使用邀请、显示错误态

const mockFamily = require('../helpers/family-mock');
jest.mock('../../services/family', () => mockFamily);

const family = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { InvitationCodeStatus, ErrorCodes, ErrorMessages } = require('../../contracts/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  wx.getStorageSync.mockImplementation((k) => k === STORAGE_KEYS.CURRENT_FAMILY_ID ? 'f-current' : null);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(opts = {}) {
  const { type, config } = loadPage('pages/family-invite-list/index.js', opts);
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('family-invite-list 页面', () => {
  test('onLoad 拉取邀请列表并按状态分组', async () => {
    family.getInvites.mockResolvedValue({
      invites: [
        { id: 'c1', code: '234567', status: 'Pending', canRevoke: true, createdAt: '2026-08-18T00:00:00Z', expiresAt: '2026-08-19T00:00:00Z' },
        { id: 'c2', code: '345678', status: 'Used', canRevoke: false, createdAt: '2026-08-18T00:00:00Z', expiresAt: '2026-08-19T00:00:00Z' },
        { id: 'c3', code: '456789', status: 'Redeemed', canRevoke: false, createdAt: '2026-08-18T00:00:00Z', expiresAt: '2026-08-19T00:00:00Z' }
      ]
    });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(family.getInvites).toHaveBeenCalled();
    expect(ctx.data.groups.pending.length).toBe(1);
    expect(ctx.data.groups.used.length).toBe(1);
    expect(ctx.data.groups.redeemed.length).toBe(1);
    expect(ctx.data.groups.expired.length).toBe(0);
  });

  test('过期（expiresAt < now）的 Pending 移到 expired 分组', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60).toISOString();
    family.getInvites.mockResolvedValue({
      invites: [
        { id: 'c1', code: '234567', status: 'Pending', canRevoke: true, createdAt: '2026-08-18T00:00:00Z', expiresAt: past }
      ]
    });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.groups.pending.length).toBe(0);
    expect(ctx.data.groups.expired.length).toBe(1);
  });

  test('拉取失败时显示错误态', async () => {
    family.getInvites.mockRejectedValue({ error: 'NETWORK_ERROR' });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.error).toBe(true);
  });

  test('空列表时各分组均为空数组', async () => {
    family.getInvites.mockResolvedValue({ invites: [] });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.groups.pending).toEqual([]);
    expect(ctx.data.groups.used).toEqual([]);
    expect(ctx.data.groups.redeemed).toEqual([]);
    expect(ctx.data.groups.expired).toEqual([]);
  });

  test('onRevoke 撤销邀请后刷新列表', async () => {
    family.getInvites
      .mockResolvedValueOnce({
        invites: [{ id: 'c1', code: '234567', status: 'Pending', canRevoke: true, createdAt: '2026-08-18T00:00:00Z', expiresAt: '2026-08-19T00:00:00Z' }]
      })
      .mockResolvedValueOnce({ invites: [] });
    family.revokeInvite.mockResolvedValue({ revoked: true });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.groups.pending.length).toBe(1);
    await ctx.onRevoke({ currentTarget: { dataset: { codeId: 'c1' } } });
    expect(family.revokeInvite).toHaveBeenCalledWith('f-current', 'c1');
    expect(family.getInvites).toHaveBeenCalledTimes(2);
  });

  test('INVITATION_CANNOT_REVOKE 错误展示 contracts 错误信息', async () => {
    family.getInvites.mockResolvedValue({ invites: [] });
    family.revokeInvite.mockRejectedValue({ error: ErrorCodes.INVITATION_CANNOT_REVOKE, message: ErrorMessages.INVITATION_CANNOT_REVOKE });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    await ctx.onRevoke({ currentTarget: { dataset: { codeId: 'c1' } } });
    expect(ctx.data.errorMessage).toBe(ErrorMessages.INVITATION_CANNOT_REVOKE);
  });

  test('onRetry 重新拉取列表', async () => {
    family.getInvites.mockRejectedValueOnce({ error: 'NETWORK_ERROR' });
    const ctx = setup();
    ctx.onLoad();
    await flush();
    expect(ctx.data.error).toBe(true);
    family.getInvites.mockResolvedValue({ invites: [] });
    ctx.onRetry();
    await flush();
    expect(ctx.data.error).toBe(false);
  });
});
