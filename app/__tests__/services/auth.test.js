// app/__tests__/services/auth.test.js
jest.mock('../../services/api');

const auth = require('../../services/auth');
const api = require('../../services/api');

beforeEach(() => { jest.clearAllMocks(); });

describe('auth 服务（9 个端点映射）', () => {
  test('login 调 POST /api/v1/auth/login 且 skipAuth，返回 data', async () => {
    api.post.mockResolvedValue({ statusCode: 200, data: { jwt: 'j', userId: 'u', isNewUser: true, needsProfileCollection: true } });
    const res = await auth.login('code-1');
    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/login', { code: 'code-1' }, { skipAuth: true });
    expect(res).toEqual({ jwt: 'j', userId: 'u', isNewUser: true, needsProfileCollection: true });
  });

  test('refresh 调 POST /api/v1/auth/refresh', async () => {
    api.post.mockResolvedValue({ statusCode: 200, data: { jwt: 'j2', userId: 'u2' } });
    const res = await auth.refresh('code-2');
    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/refresh', { code: 'code-2' }, { skipAuth: true });
    expect(res).toEqual({ jwt: 'j2', userId: 'u2' });
  });

  test('getProfile 调 GET /api/v1/auth/profile', async () => {
    api.get.mockResolvedValue({ statusCode: 200, data: { userId: 'u', nickname: '小明', avatarUrl: null, createdAt: '2026-08-08' } });
    const res = await auth.getProfile();
    expect(api.get).toHaveBeenCalledWith('/api/v1/auth/profile');
    expect(res.nickname).toBe('小明');
  });

  test('updateProfile 调 PUT /api/v1/auth/profile', async () => {
    api.put.mockResolvedValue({ statusCode: 200, data: { nickname: '新昵称' } });
    await auth.updateProfile({ nickname: '新昵称', avatarUrl: null });
    expect(api.put).toHaveBeenCalledWith('/api/v1/auth/profile', { nickname: '新昵称', avatarUrl: null });
  });

  test('getDeletionStatus 调 GET /api/v1/auth/deletion-status', async () => {
    api.get.mockResolvedValue({ statusCode: 200, data: { isDeleted: false, canDelete: true } });
    const res = await auth.getDeletionStatus();
    expect(api.get).toHaveBeenCalledWith('/api/v1/auth/deletion-status');
    expect(res.canDelete).toBe(true);
  });

  test('deleteAccount 调 POST /api/v1/auth/deletion 空请求体', async () => {
    api.post.mockResolvedValue({ statusCode: 200, data: { expiresAt: '2026-09-07', remainingDays: 30 } });
    await auth.deleteAccount();
    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/deletion', {});
  });

  test('recoverAccount 调 POST /api/v1/auth/deletion/recover', async () => {
    api.post.mockResolvedValue({ statusCode: 200, data: { jwt: 'j3', userId: 'u3' } });
    const res = await auth.recoverAccount();
    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/deletion/recover', {});
    expect(res.jwt).toBe('j3');
  });

  test('uploadAvatar 调 api.upload POST /api/v1/upload/avatar', async () => {
    api.upload.mockResolvedValue({ statusCode: 200, data: { url: 'https://x/1.png' } });
    const res = await auth.uploadAvatar('/tmp/avatar.png');
    expect(api.upload).toHaveBeenCalledWith('/api/v1/upload/avatar', '/tmp/avatar.png');
    expect(res.url).toBe('https://x/1.png');
  });

  test('getMyFamilies 调 GET /api/v1/users/me/families', async () => {
    api.get.mockResolvedValue({ statusCode: 200, data: { families: [] } });
    const res = await auth.getMyFamilies();
    expect(api.get).toHaveBeenCalledWith('/api/v1/users/me/families');
    expect(res.families).toEqual([]);
  });
});
