// testing/e2e/specs/auth-profile.spec.js
// TC-PROFILE-001 ~ TC-PROFILE-011: 用户资料 (GET/PUT /api/v1/auth/profile)
// Reachable via direct JWT + DB seed (no WeChat login) — see test-plan.md §3.2.

const { test, expect } = require('@playwright/test');
const { errors, enums, assertError } = require('../helpers/contracts');
const { getProfile, updateProfile, healthCheck } = require('../helpers/api-client');
const { generateToken, generateExpiredToken, generateInvalidToken, AUTH_TEST_USERS } = require('../helpers/jwt-helper');
const { seedAuthUser, cleanupAuthUser, getAuthUser } = require('../helpers/db');

const USER = AUTH_TEST_USERS.PROFILE;
const NICKNAME = '小明妈妈';
const UserStatus = enums.UserStatus.numeric;

test.beforeAll(async ({ request }) => {
  const hc = await healthCheck(request);
  if (hc.status() !== 200) {
    console.warn('[WARN] API health check failed — some tests may fail if API is not running');
  }
});

test.describe('2.C 用户资料 (GET/PUT /api/v1/auth/profile)', () => {

  test.beforeEach(async () => {
    await seedAuthUser({ id: USER, nickname: NICKNAME, status: UserStatus.Active });
  });

  test.afterEach(async () => {
    await cleanupAuthUser(USER);
  });

  test('[TC-PROFILE-001] 获取资料（正常）', async ({ request }) => {
    const res = await getProfile(request, generateToken(USER));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(USER);
    expect(body.nickname).toBe(NICKNAME);
    expect(body).toHaveProperty('createdAt');
  });

  test('[TC-PROFILE-002] 获取资料无 Token', async ({ request }) => {
    const res = await getProfile(request, null);
    await assertError(res, errors.TOKEN_INVALID);
  });

  test('[TC-PROFILE-003] 获取资料过期 Token', async ({ request }) => {
    const res = await getProfile(request, generateExpiredToken(USER));
    await assertError(res, errors.TOKEN_INVALID);
  });

  test('[TC-PROFILE-004] 获取资料篡改 Token', async ({ request }) => {
    const res = await getProfile(request, generateInvalidToken(USER));
    await assertError(res, errors.TOKEN_INVALID);
  });

  test('[TC-PROFILE-005] 更新昵称（正常）', async ({ request }) => {
    const res = await updateProfile(request, generateToken(USER), { nickname: '新昵称' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.nickname).toBe('新昵称');
    const row = await getAuthUser(USER);
    expect(row.nickname).toBe('新昵称');
  });

  test('[TC-PROFILE-006] 昵称为空', async ({ request }) => {
    const res = await updateProfile(request, generateToken(USER), { nickname: '' });
    await assertError(res, errors.NICKNAME_EMPTY);
  });

  test('[TC-PROFILE-007] 昵称恰好 20 字符（max 边界）', async ({ request }) => {
    const nickname = 'x'.repeat(20);
    const res = await updateProfile(request, generateToken(USER), { nickname });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.nickname).toBe(nickname);
  });

  test('[TC-PROFILE-008] 昵称 21 字符（max+1 边界）', async ({ request }) => {
    const res = await updateProfile(request, generateToken(USER), { nickname: 'x'.repeat(21) });
    await assertError(res, errors.NICKNAME_TOO_LONG);
  });

  test('[TC-PROFILE-009] 昵称含敏感词', async ({ request }) => {
    const res = await updateProfile(request, generateToken(USER), { nickname: '涉及赌博内容' });
    await assertError(res, errors.NICKNAME_SENSITIVE);
  });

  test('[TC-PROFILE-010] 更新头像 URL（正常）', async ({ request }) => {
    const res = await updateProfile(request, generateToken(USER), { nickname: '小明', avatarUrl: '/uploads/avatars/x.png' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.avatarUrl).toBe('/uploads/avatars/x.png');
  });

  test('[TC-PROFILE-011] 更新资料无 Token', async ({ request }) => {
    const res = await updateProfile(request, null, { nickname: 'x' });
    await assertError(res, errors.TOKEN_INVALID);
  });

});
