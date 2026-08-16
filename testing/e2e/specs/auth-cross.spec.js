// testing/e2e/specs/auth-cross.spec.js
// TC-CROSS-001 ~ 003: 横切（统一错误信封 / JWT 生命周期边界）
// Reachable via direct JWT + DB seed (no WeChat login) — see test-plan.md §3.2.

const { test, expect } = require('@playwright/test');
const { errors, enums, errorKey } = require('../helpers/contracts');
const { updateProfile, getProfile, healthCheck } = require('../helpers/api-client');
const { generateTokenWithExpiry, AUTH_TEST_USERS } = require('../helpers/jwt-helper');
const { seedAuthUser, cleanupAuthUser } = require('../helpers/db');

const USER = AUTH_TEST_USERS.CROSS;
const UserStatus = enums.UserStatus.numeric;

test.beforeAll(async ({ request }) => {
  const hc = await healthCheck(request);
  if (hc.status() !== 200) {
    console.warn('[WARN] API health check failed — some tests may fail if API is not running');
  }
});

test.beforeEach(async () => {
  await seedAuthUser({ id: USER, status: UserStatus.Active });
});

test.afterEach(async () => {
  await cleanupAuthUser(USER);
});

test.describe('2.I 横切（统一错误信封 / JWT 边界）', () => {

  test('[TC-CROSS-001] 统一错误信封', async ({ request }) => {
    // 触发一个可达错误（昵称为空），观察统一错误信封形状。
    const res = await updateProfile(request, generateTokenWithExpiry(USER, 'Parent', 3600), { nickname: '' });
    expect(res.status()).toBe(errors.NICKNAME_EMPTY.httpStatus);
    const body = await res.json();
    expect(body.error).toBe(errorKey(errors.NICKNAME_EMPTY));
    expect(body.message).toBe(errors.NICKNAME_EMPTY.message);
    expect(body.error).not.toBe('');
    expect(body.message).not.toBe('');
    // traceId 字段存在（值可为 null，dto.json 标记 optional）
    expect(body).toHaveProperty('traceId');
  });

  test('[TC-CROSS-002] JWT 过期前 5 分钟策略', async ({ request }) => {
    // 剩余有效期 < 5min 且 > 0：后端 PreExpiryWindow=5min 提前拒绝。
    const token = generateTokenWithExpiry(USER, 'Parent', 120);
    const res = await getProfile(request, token);
    expect(res.status()).toBe(errors.TOKEN_INVALID.httpStatus);
    const body = await res.json();
    expect(body.error).toBe(errorKey(errors.TOKEN_INVALID));
  });

  test('[TC-CROSS-003] 时钟偏差 30 秒容忍', async ({ request }) => {
    // exp=now-10s 仍在 ClockSkew=30s 容忍范围内，应通过校验返回 200。
    const token = generateTokenWithExpiry(USER, 'Parent', -10);
    const res = await getProfile(request, token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(USER);
  });

});
