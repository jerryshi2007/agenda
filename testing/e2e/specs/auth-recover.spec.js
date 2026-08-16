// testing/e2e/specs/auth-recover.spec.js
// TC-RECOVER-001 ~ 005: 恢复注销 (POST /api/v1/auth/deletion/recover)
// Reachable via direct JWT + DB seed (no WeChat login) — see test-plan.md §3.2.

const { test, expect } = require('@playwright/test');
const { errors, enums, assertError } = require('../helpers/contracts');
const { recoverAccount, getProfile, healthCheck } = require('../helpers/api-client');
const { generateToken, AUTH_TEST_USERS } = require('../helpers/jwt-helper');
const { seedAuthUser, cleanupAuthUser, getAuthUser } = require('../helpers/db');
const { dateTimeOffsetDays } = require('../helpers/data-factory');

const UserStatus = enums.UserStatus.numeric;

let seeded = [];

async function seed(user) {
  await seedAuthUser(user);
  seeded.push(user.id);
}

test.beforeAll(async ({ request }) => {
  const hc = await healthCheck(request);
  if (hc.status() !== 200) {
    console.warn('[WARN] API health check failed — some tests may fail if API is not running');
  }
});

test.afterEach(async () => {
  for (const id of seeded) await cleanupAuthUser(id);
  seeded = [];
});

test.describe('2.F 恢复注销 (POST /api/v1/auth/deletion/recover)', () => {

  test('[TC-RECOVER-001] 正常恢复', async ({ request }) => {
    const USER = AUTH_TEST_USERS.RECOVER;
    await seed({ id: USER, status: UserStatus.Deleted, deletedAt: dateTimeOffsetDays(-5) });
    const res = await recoverAccount(request, generateToken(USER));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(USER);
    expect(body.jwt).toBeDefined();
    const row = await getAuthUser(USER);
    expect(row.status).toBe(UserStatus.Active);
    expect(row.deletedAt).toBeNull();
  });

  test('[TC-RECOVER-002] 未注销用户恢复', async ({ request }) => {
    const USER = AUTH_TEST_USERS.NOT_DELETED;
    await seed({ id: USER, status: UserStatus.Active });
    const res = await recoverAccount(request, generateToken(USER));
    await assertError(res, errors.NOT_DELETED);
  });

  test('[TC-RECOVER-003] 已过期恢复', async ({ request }) => {
    const USER = AUTH_TEST_USERS.RECOVER_EXPIRED;
    await seed({ id: USER, status: UserStatus.Deleted, deletedAt: dateTimeOffsetDays(-31) });
    const res = await recoverAccount(request, generateToken(USER));
    await assertError(res, errors.EXPIRED);
  });

  test('[TC-RECOVER-004] 无 Token', async ({ request }) => {
    const res = await recoverAccount(request, null);
    await assertError(res, errors.TOKEN_INVALID);
  });

  test('[TC-RECOVER-005] 恢复后旧 Token 继续有效（另一设备）', async ({ request }) => {
    const USER = AUTH_TEST_USERS.RECOVER;
    await seed({ id: USER, status: UserStatus.Deleted, deletedAt: dateTimeOffsetDays(-5) });
    const oldToken = generateToken(USER);
    const recoverRes = await recoverAccount(request, oldToken);
    expect(recoverRes.status()).toBe(200);
    // 恢复前的 JWT 未过期，后端已恢复账户，旧 token 仍可访问受保护端点
    const profileRes = await getProfile(request, oldToken);
    expect(profileRes.status()).toBe(200);
  });

});
