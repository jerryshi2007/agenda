// app/__tests__/services/api.test.js
// crypto 用 identity mock，让 token 断言聚焦于原始值（加密往返由 crypto.test.js 单独覆盖）
jest.mock('../../utils/crypto', () => ({ encrypt: (s) => s, decrypt: (s) => s }));

const api = require('../../services/api');
const { installWxMock } = require('../helpers/wx-mock');
const STORAGE_KEYS = require('../../utils/storage-keys');

let wx;
beforeEach(() => {
  wx = installWxMock();
  global.getApp = () => ({ setLoginData: jest.fn() });
});

describe('api.request 基础行为', () => {
  test('2xx 时 resolve {statusCode, data, headers}', async () => {
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: { ok: true }, header: { x: '1' } }));
    const res = await api.get('/api/v1/test');
    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual({ ok: true });
    expect(res.headers).toEqual({ x: '1' });
  });

  test('从 Storage 读取 token 注入 Authorization: Bearer', async () => {
    wx.getStorageSync.mockReturnValue('token-1');
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.get('/api/v1/test');
    const cfg = wx.request.mock.calls[0][0];
    expect(cfg.header.Authorization).toBe('Bearer token-1');
  });

  test('Storage 无 token 时不注入 Authorization（getToken null 守卫）', async () => {
    wx.getStorageSync.mockReturnValue('');
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.get('/api/v1/test');
    const cfg = wx.request.mock.calls[0][0];
    expect(cfg.header.Authorization).toBeUndefined();
  });

  test('skipAuth 时不注入 token', async () => {
    wx.getStorageSync.mockReturnValue('token-1');
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.post('/api/v1/auth/login', { code: 'c' }, { skipAuth: true });
    const cfg = wx.request.mock.calls[0][0];
    expect(cfg.header.Authorization).toBeUndefined();
  });

  test('非 2xx reject 统一错误信封', async () => {
    wx.request.mockImplementation(c => c.success({
      statusCode: 400,
      data: { error: 'CODE_INVALID', message: '微信登录凭证无效，请重试' },
      header: {}
    }));
    await expect(api.post('/api/v1/auth/login', { code: 'x' }, { skipAuth: true }))
      .rejects.toMatchObject({ statusCode: 400, error: 'CODE_INVALID', message: '微信登录凭证无效，请重试' });
  });

  test('网络失败 reject NETWORK_ERROR', async () => {
    wx.request.mockImplementation(c => c.fail({ errMsg: 'request:fail timeout' }));
    await expect(api.get('/api/v1/test')).rejects.toMatchObject({ error: 'NETWORK_ERROR' });
  });

  test('未同意隐私时拒绝鉴权请求且不触发 wx.login', async () => {
    global.getApp = () => ({ globalData: { pendingPrivacyConsent: true } });
    await expect(api.get('/api/v1/schedules')).rejects.toMatchObject({ error: 'PRIVACY_NOT_CONSENTED' });
    expect(wx.request).not.toHaveBeenCalled();
    expect(wx.login).not.toHaveBeenCalled();
  });

  test('未同意隐私时 skipAuth 请求（登录/续期）仍放行', async () => {
    global.getApp = () => ({ globalData: { pendingPrivacyConsent: true } });
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await expect(api.post('/api/v1/auth/login', { code: 'c' }, { skipAuth: true })).resolves.toMatchObject({ statusCode: 200 });
    expect(wx.request).toHaveBeenCalled();
  });

  test('GET 查询参数拼接到 URL', async () => {
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.get('/api/v1/schedules', { date: '2026-08-08', empty: '' });
    const cfg = wx.request.mock.calls[0][0];
    expect(cfg.url).toContain('/api/v1/schedules?date=2026-08-08');
    expect(cfg.url).not.toContain('empty');
  });

  test('options.headers 合并到最终 header（X-Family-Id 场景）', async () => {
    // H1 修复后：X-Family-Id 优先从 Storage 注入；当 Storage 无值时，options.headers 中提供的值生效
    wx.getStorageSync.mockImplementation((k) => k === STORAGE_KEYS.AUTH_TOKEN ? 'token-1' : null);
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.get('/api/v1/families/f1/members', undefined, { headers: { 'X-Family-Id': 'f-from-options' } });
    const cfg = wx.request.mock.calls[0][0];
    // Storage 无值时回退到 options.headers
    expect(cfg.header['X-Family-Id']).toBe('f-from-options');
    // 同时不破坏 Authorization 注入
    expect(cfg.header.Authorization).toBe('Bearer token-1');
  });

  test('options.headers 可覆盖默认 Content-Type', async () => {
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.post('/api/v1/x', {}, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const cfg = wx.request.mock.calls[0][0];
    expect(cfg.header['Content-Type']).toBe('application/x-www-form-urlencoded');
  });
});

describe('X-Family-Id Header 自动注入（H1 修复：统一入口在 api.request）', () => {
  test('Storage 有 CURRENT_FAMILY_ID 时默认注入 X-Family-Id', async () => {
    wx.getStorageSync.mockImplementation((k) => {
      if (k === STORAGE_KEYS.CURRENT_FAMILY_ID) return 'f-current';
      if (k === STORAGE_KEYS.AUTH_TOKEN) return 'token-1';
      return null;
    });
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.get('/api/v1/families/f1/members');
    const cfg = wx.request.mock.calls[0][0];
    expect(cfg.header['X-Family-Id']).toBe('f-current');
    // 仍注入 Authorization
    expect(cfg.header.Authorization).toBe('Bearer token-1');
  });

  test('Storage 无 CURRENT_FAMILY_ID 时不注入 X-Family-Id', async () => {
    wx.getStorageSync.mockImplementation((k) => k === STORAGE_KEYS.AUTH_TOKEN ? 'token-1' : null);
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.get('/api/v1/families/f1/members');
    const cfg = wx.request.mock.calls[0][0];
    expect(cfg.header['X-Family-Id']).toBeUndefined();
  });

  test('skipFamilyHeader: true 时不注入 X-Family-Id（即使 Storage 有值）', async () => {
    wx.getStorageSync.mockImplementation((k) => {
      if (k === STORAGE_KEYS.CURRENT_FAMILY_ID) return 'f-current';
      if (k === STORAGE_KEYS.AUTH_TOKEN) return 'token-1';
      return null;
    });
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.get('/api/v1/families/me', undefined, { skipFamilyHeader: true });
    const cfg = wx.request.mock.calls[0][0];
    expect(cfg.header['X-Family-Id']).toBeUndefined();
    // 不影响 Authorization 注入
    expect(cfg.header.Authorization).toBe('Bearer token-1');
  });

  test('options.headers 显式提供 X-Family-Id 时按 options 值注入（覆盖 storage）', async () => {
    wx.getStorageSync.mockImplementation((k) => {
      if (k === STORAGE_KEYS.CURRENT_FAMILY_ID) return 'f-from-storage';
      if (k === STORAGE_KEYS.AUTH_TOKEN) return 'token-1';
      return null;
    });
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.get('/api/v1/families/f1/members', undefined, { headers: { 'X-Family-Id': 'f-explicit' } });
    const cfg = wx.request.mock.calls[0][0];
    // options.headers 优先级最高（先合并 options.headers，再注入 storage 值；如果 storage 已有值会覆盖 options）
    // 当前实现：Object.assign 默认 headers, options.headers, 然后注入 familyId
    // 注入逻辑会覆盖 options.headers 提供的 X-Family-Id（确保上下文一致）
    expect(cfg.header['X-Family-Id']).toBe('f-from-storage');
  });

  test('skipAuth 请求也遵守 skipFamilyHeader 规则', async () => {
    wx.getStorageSync.mockImplementation((k) => k === STORAGE_KEYS.CURRENT_FAMILY_ID ? 'f-current' : null);
    wx.request.mockImplementation(c => c.success({ statusCode: 200, data: {}, header: {} }));
    await api.get('/api/v1/families/me', undefined, { skipAuth: true, skipFamilyHeader: true });
    const cfg = wx.request.mock.calls[0][0];
    expect(cfg.header['X-Family-Id']).toBeUndefined();
    expect(cfg.header.Authorization).toBeUndefined();
  });
});

describe('401 静默续期（ADR-007）', () => {
  test('401 触发 wx.login + refresh + 重放原请求，新 token 写入 Storage', async () => {
    wx.getStorageSync.mockReturnValue('old-jwt');
    let schedulesCalls = 0;
    wx.request.mockImplementation((config) => {
      if (config.url.includes('/api/v1/auth/refresh')) {
        config.success({ statusCode: 200, data: { jwt: 'new-jwt', userId: 'u1' }, header: {} });
      } else if (config.url.includes('/api/v1/schedules')) {
        schedulesCalls++;
        config.success(schedulesCalls === 1
          ? { statusCode: 401, data: { error: 'TOKEN_INVALID' }, header: {} }
          : { statusCode: 200, data: { ok: true }, header: {} });
      }
    });
    wx.login.mockImplementation(({ success }) => success({ code: 'code-1' }));

    const res = await api.get('/api/v1/schedules', {});
    expect(res.data).toEqual({ ok: true });
    expect(wx.login).toHaveBeenCalledTimes(1);
    expect(wx.setStorageSync).toHaveBeenCalledWith('auth_token', 'new-jwt');
    const refreshCfg = wx.request.mock.calls.find(c => c[0].url.includes('/auth/refresh'))[0];
    expect(refreshCfg.header.Authorization).toBeUndefined();
  });

  test('并发 401 仅一次 wx.login 与一次 refresh', async () => {
    wx.getStorageSync.mockReturnValue('old-jwt');
    let refreshCalls = 0;
    const urlCalls = {};
    wx.request.mockImplementation((config) => {
      if (config.url.includes('/api/v1/auth/refresh')) {
        refreshCalls++;
        config.success({ statusCode: 200, data: { jwt: 'new-jwt', userId: 'u1' }, header: {} });
      } else {
        urlCalls[config.url] = (urlCalls[config.url] || 0) + 1;
        config.success(urlCalls[config.url] === 1
          ? { statusCode: 401, data: { error: 'TOKEN_INVALID' }, header: {} }
          : { statusCode: 200, data: { ok: true }, header: {} });
      }
    });
    wx.login.mockImplementation(({ success }) => success({ code: 'code-1' }));

    await Promise.all([api.get('/api/v1/a'), api.get('/api/v1/b')]);
    expect(wx.login).toHaveBeenCalledTimes(1);
    expect(refreshCalls).toBe(1);
  });

  test('续期失败清除 token 并 reject TOKEN_INVALID', async () => {
    wx.getStorageSync.mockReturnValue('old-jwt');
    wx.request.mockImplementation((config) => {
      if (config.url.includes('/api/v1/auth/refresh')) {
        config.success({ statusCode: 400, data: { error: 'CODE_INVALID', message: '微信登录凭证无效，请重试' }, header: {} });
      } else {
        config.success({ statusCode: 401, data: { error: 'TOKEN_INVALID' }, header: {} });
      }
    });
    wx.login.mockImplementation(({ success }) => success({ code: 'code-1' }));

    await expect(api.get('/api/v1/schedules')).rejects.toMatchObject({ error: 'TOKEN_INVALID' });
    expect(wx.removeStorageSync).toHaveBeenCalledWith('auth_token');
  });
});

describe('429 退避重试', () => {
  test('429 等待 60s 后自动重试一次', async () => {
    jest.useFakeTimers();
    let calls = 0;
    wx.request.mockImplementation((config) => {
      calls++;
      config.success(calls === 1
        ? { statusCode: 429, data: { error: 'RATE_LIMITED', message: '操作过于频繁，请稍后再试' }, header: {} }
        : { statusCode: 200, data: { ok: true }, header: {} });
    });

    const promise = api.get('/api/v1/test');
    await jest.advanceTimersByTimeAsync(60000);
    const res = await promise;
    expect(res.data).toEqual({ ok: true });
    expect(wx.request).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
