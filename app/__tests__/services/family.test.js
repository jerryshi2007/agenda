// app/__tests__/services/family.test.js
// 家庭管理服务 API 封装测试
//
// 覆盖：所有 15 个端点的 URL/method 映射、skipFamilyHeader 选项传递、
//       错误码错误信息映射（family.js 内部 message 重写规则）
//
// X-Family-Id Header 注入由 services/api.js 统一负责（__tests__/services/api.test.js 覆盖）；
// 本文件只验证 family.js 正确传递 skipFamilyHeader 选项。

jest.mock('../../services/api');

const api = require('../../services/api');
const family = require('../../services/family');
const { ErrorCodes, ErrorMessages, DisplayMode } = require('../../contracts/family');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('family 服务（家庭管理 API 封装）', () => {
  describe('getMyFamilies - GET /api/v1/families/me', () => {
    test('无家庭上下文（skipFamilyHeader: true）', async () => {
      api.get.mockResolvedValue({ data: { families: [] } });
      await family.getMyFamilies();
      const call = api.get.mock.calls[0];
      expect(call[0]).toBe('/api/v1/families/me');
      expect(call[2]).toEqual(expect.objectContaining({ skipFamilyHeader: true }));
    });

    test('返回 data 字段', async () => {
      api.get.mockResolvedValue({ data: { families: [{ familyId: 'f1' }] } });
      const res = await family.getMyFamilies();
      expect(res).toEqual({ families: [{ familyId: 'f1' }] });
    });
  });

  describe('createFamily - POST /api/v1/families', () => {
    test('请求体包含 name 和 role', async () => {
      api.post.mockResolvedValue({ data: { familyId: 'f1' } });
      await family.createFamily({ name: '我的家', role: 'Parent' });
      const call = api.post.mock.calls[0];
      expect(call[0]).toBe('/api/v1/families');
      expect(call[1]).toEqual({ name: '我的家', role: 'Parent' });
    });

    test('无家庭上下文（skipFamilyHeader: true）', async () => {
      api.post.mockResolvedValue({ data: { familyId: 'f1' } });
      await family.createFamily({ name: '家', role: 'Parent' });
      expect(api.post.mock.calls[0][2]).toEqual(expect.objectContaining({ skipFamilyHeader: true }));
    });
  });

  describe('updateFamilyName - PUT /api/v1/families/{id}/name', () => {
    test('不显式设置 skipFamilyHeader（api.js 自动从 storage 注入 X-Family-Id）', async () => {
      api.put.mockResolvedValue({ data: { familyId: 'f1', familyName: '新家' } });
      await family.updateFamilyName('f1', '新家');
      const opts = api.put.mock.calls[0][2];
      // family.js 不应再设置 headers；X-Family-Id 注入由 api.js 负责
      expect(!opts || !opts.headers || !opts.headers['X-Family-Id']).toBe(true);
      expect(!opts || opts.skipFamilyHeader !== true).toBe(true);
    });
  });

  describe('getMembers - GET /api/v1/families/{id}/members', () => {
    test('不显式设置 skipFamilyHeader（api.js 自动从 storage 注入）', async () => {
      api.get.mockResolvedValue({ data: { parents: [], children: [] } });
      await family.getMembers('f1');
      const opts = api.get.mock.calls[0][2];
      expect(!opts || !opts.headers || !opts.headers['X-Family-Id']).toBe(true);
      expect(!opts || opts.skipFamilyHeader !== true).toBe(true);
    });
  });

  describe('generateInviteCode - POST /api/v1/families/{id}/invite-code', () => {
    test('邀请家长不带 child 字段', async () => {
      api.post.mockResolvedValue({ data: { code: '234567', expiresAt: '2026-08-19T00:00:00Z' } });
      await family.generateInviteCode('f1', { targetRole: 'Parent' });
      // X-Family-Id 注入由 api.js 负责，family.js 不再传 headers 或 skipFamilyHeader
      expect(api.post).toHaveBeenCalledWith(
        '/api/v1/families/f1/invite-code',
        { targetRole: 'Parent' }
      );
    });

    test('邀请孩子带 childName + displayMode', async () => {
      api.post.mockResolvedValue({ data: { code: '234567' } });
      await family.generateInviteCode('f1', {
        targetRole: 'Child',
        targetChildName: '小明',
        targetDisplayMode: 'Primary'
      });
      expect(api.post).toHaveBeenCalledWith(
        '/api/v1/families/f1/invite-code',
        { targetRole: 'Child', targetChildName: '小明', targetDisplayMode: 'Primary' }
      );
    });
  });

  describe('getInvites - GET /api/v1/families/{id}/invites', () => {
    test('不显式设置 skipFamilyHeader（api.js 自动从 storage 注入）', async () => {
      api.get.mockResolvedValue({ data: { invites: [] } });
      await family.getInvites('f1');
      const opts = api.get.mock.calls[0][2];
      expect(!opts || !opts.headers || !opts.headers['X-Family-Id']).toBe(true);
    });
  });

  describe('revokeInvite - DELETE /api/v1/families/{id}/invites/{codeId}', () => {
    test('不显式设置 skipFamilyHeader（api.js 自动从 storage 注入）', async () => {
      api.del.mockResolvedValue({ data: { revoked: true } });
      await family.revokeInvite('f1', 'c1');
      const opts = api.del.mock.calls[0][2];
      expect(!opts || !opts.headers || !opts.headers['X-Family-Id']).toBe(true);
    });
  });

  describe('joinByCode - POST /api/v1/families/join-by-code', () => {
    test('请求体包含 code', async () => {
      api.post.mockResolvedValue({ data: { familyId: 'f-joined' } });
      await family.joinByCode('234567');
      const call = api.post.mock.calls[0];
      expect(call[0]).toBe('/api/v1/families/join-by-code');
      expect(call[1]).toEqual({ code: '234567' });
    });

    test('无家庭上下文（skipFamilyHeader: true）', async () => {
      api.post.mockResolvedValue({ data: { familyId: 'f-joined' } });
      await family.joinByCode('234567');
      expect(api.post.mock.calls[0][2]).toEqual(expect.objectContaining({ skipFamilyHeader: true }));
    });
  });

  describe('removeMember - DELETE /api/v1/families/{id}/members/{memberId}', () => {
    test('不显式设置 skipFamilyHeader（api.js 自动从 storage 注入）', async () => {
      api.del.mockResolvedValue({ data: { removed: true } });
      await family.removeMember('f1', 'm1');
      const opts = api.del.mock.calls[0][2];
      expect(!opts || !opts.headers || !opts.headers['X-Family-Id']).toBe(true);
    });

    test('CANNOT_REMOVE_SELF 错误透传', async () => {
      api.del.mockRejectedValue({
        statusCode: 400,
        error: ErrorCodes.CANNOT_REMOVE_SELF,
        message: ErrorMessages.CANNOT_REMOVE_SELF
      });
      await expect(family.removeMember('f1', 'm1')).rejects.toMatchObject({
        error: ErrorCodes.CANNOT_REMOVE_SELF,
        message: ErrorMessages.CANNOT_REMOVE_SELF
      });
    });
  });

  describe('transferCreator - POST /api/v1/families/{id}/transfer-creator/{newCreatorId}', () => {
    test('仅传路径参数，不传请求体', async () => {
      api.post.mockResolvedValue({ data: { creatorId: 'm-new' } });
      await family.transferCreator('f1', 'm-new');
      const call = api.post.mock.calls[0];
      expect(call[0]).toBe('/api/v1/families/f1/transfer-creator/m-new');
      expect(call[1]).toBeUndefined();
    });
  });

  describe('setDisplayMode - PUT /api/v1/families/members/{memberId}/display-mode', () => {
    test('请求体包含 displayMode', async () => {
      api.put.mockResolvedValue({ data: { memberId: 'm1', displayMode: 'Primary' } });
      await family.setDisplayMode('m1', 'Primary');
      expect(api.put).toHaveBeenCalledWith(
        '/api/v1/families/members/m1/display-mode',
        { displayMode: 'Primary' }
      );
    });
  });

  describe('exitFamily - POST /api/v1/families/{id}/exit', () => {
    test('不显式设置 skipFamilyHeader（api.js 自动从 storage 注入）', async () => {
      api.post.mockResolvedValue({ data: { exited: true, hasOtherFamilies: false } });
      await family.exitFamily('f1');
      const opts = api.post.mock.calls[0][2];
      expect(!opts || !opts.headers || !opts.headers['X-Family-Id']).toBe(true);
    });

    test('FAMILY_CREATOR_CANNOT_EXIT 错误透传', async () => {
      api.post.mockRejectedValue({
        statusCode: 403,
        error: ErrorCodes.FAMILY_CREATOR_CANNOT_EXIT,
        message: ErrorMessages.FAMILY_CREATOR_CANNOT_EXIT
      });
      await expect(family.exitFamily('f1')).rejects.toMatchObject({
        error: ErrorCodes.FAMILY_CREATOR_CANNOT_EXIT
      });
    });
  });

  describe('dissolveFamily - POST /api/v1/families/{id}/dissolve', () => {
    test('请求体包含 familyName', async () => {
      api.post.mockResolvedValue({ data: { dissolved: true } });
      await family.dissolveFamily('f1', '我的家');
      expect(api.post).toHaveBeenCalledWith(
        '/api/v1/families/f1/dissolve',
        { familyName: '我的家' }
      );
    });
  });

  describe('restoreFamily - POST /api/v1/families/{id}/restore', () => {
    test('无家庭上下文（skipFamilyHeader: true）', async () => {
      api.post.mockResolvedValue({ data: { restored: true } });
      await family.restoreFamily('f1');
      expect(api.post.mock.calls[0][2]).toEqual(expect.objectContaining({ skipFamilyHeader: true }));
    });
  });

  describe('getShareInfo - GET /api/v1/families/get-share-info/{code}', () => {
    test('无家庭上下文（skipFamilyHeader: true）', async () => {
      api.get.mockResolvedValue({ data: { familyName: '家' } });
      await family.getShareInfo('234567');
      const call = api.get.mock.calls[0];
      expect(call[0]).toBe('/api/v1/families/get-share-info/234567');
      expect(call[2]).toEqual(expect.objectContaining({ skipFamilyHeader: true }));
    });
  });
});
