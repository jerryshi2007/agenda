// testing/e2e/specs/auth-deletion.spec.js
// TC-DELETION-001 ~ 004 + TC-DELETE-001 ~ 004: 注销状态查询 + 注销账户
// Reachable via direct JWT + DB seed (no WeChat login) — see test-plan.md §3.2.
// FAMILY_STILL_ACTIVE 用例为 GAP（IFamilyQueryService 空实现），见 test-plan.md §2.9。

const { test, expect } = require('@playwright/test');
const { errors, enums, errorKey, assertError } = require('../helpers/contracts');
const { getDeletionStatus, deleteAccount, healthCheck } = require('../helpers/api-client');
const { generateToken, AUTH_TEST_USERS } = require('../helpers/jwt-helper');
const { seedAuthUser, cleanupAuthUser, getAuthUser } = require('../helpers/db');
const { dateTimeOffsetDays } = require('../helpers/data-factory');

const UserStatus = enums.UserStatus.numeric;

const ACTIVE_USER = AUTH_TEST_USERS.DELETION;
const DELETED_USER = AUTH_TEST_USERS.DELETE_IDEMPOTENT;

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

test.describe('2.D/2.E 注销 (GET /deletion-status + POST /deletion)', () => {

  test('[TC-DELETION-001] 无家庭可注销', async ({ request }) => {
    await seed({ id: ACTIVE_USER, status: UserStatus.Active });
    const res = await getDeletionStatus(request, generateToken(ACTIVE_USER));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isDeleted).toBe(false);
    expect(body.canDelete).toBe(true);
    expect(body.blockReason).toBeNull();
  });

  test('[TC-DELETION-002] 无 Token', async ({ request }) => {
    const res = await getDeletionStatus(request, null);
    await assertError(res, errors.TOKEN_INVALID);
  });

  test('[TC-DELETION-003] 已注销状态', async ({ request }) => {
    await seed({ id: DELETED_USER, status: UserStatus.Deleted, deletedAt: dateTimeOffsetDays(-5) });
    const res = await getDeletionStatus(request, generateToken(DELETED_USER));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isDeleted).toBe(true);
    expect(body.remainingDays).toBeGreaterThanOrEqual(24);
    expect(body.remainingDays).toBeLessThanOrEqual(26);
    expect(body.expiresAt).toBeDefined();
  });

  // GAP: IFamilyQueryService 注册为 EmptyFamilyQueryService，canDelete 恒为 true，
  // FAMILY_STILL_ACTIVE 不可达。解除条件：家庭模块实现 IFamilyQueryService 后补种家庭关系。
  test.skip('[TC-DELETION-004] 有家庭被拦截', async ({ request }) => {
    const res = await getDeletionStatus(request, generateToken(ACTIVE_USER));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.canDelete).toBe(false);
    expect(body.blockReason).toBe(errorKey(errors.FAMILY_STILL_ACTIVE));
  });

  test('[TC-DELETE-001] 正常注销', async ({ request }) => {
    await seed({ id: ACTIVE_USER, status: UserStatus.Active });
    const res = await deleteAccount(request, generateToken(ACTIVE_USER));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.remainingDays).toBe(30);
    expect(body.expiresAt).toBeDefined();
    const row = await getAuthUser(ACTIVE_USER);
    expect(row.status).toBe(UserStatus.Deleted);
    expect(row.deletedAt).not.toBeNull();
  });

  test('[TC-DELETE-002] 注销幂等（已注销再注销）', async ({ request }) => {
    const deletedAt = dateTimeOffsetDays(-5);
    await seed({ id: DELETED_USER, status: UserStatus.Deleted, deletedAt });
    const res = await deleteAccount(request, generateToken(DELETED_USER));
    expect(res.status()).toBe(200);
    const body = await res.json();
    // remainingDays 基于原注销时间 T0（now-5d），而非重置为 30 —— 证明幂等无副作用
    expect(body.remainingDays).toBeGreaterThanOrEqual(24);
    expect(body.remainingDays).toBeLessThanOrEqual(26);
    const row = await getAuthUser(DELETED_USER);
    expect(row.status).toBe(UserStatus.Deleted);
    expect(Math.abs(new Date(row.deletedAt).getTime() - new Date(deletedAt).getTime())).toBeLessThan(5000);
  });

  // GAP: 同 TC-DELETION-004，FAMILY_STILL_ACTIVE 不可达。
  test.skip('[TC-DELETE-003] 有家庭拦截', async ({ request }) => {
    const res = await deleteAccount(request, generateToken(ACTIVE_USER));
    await assertError(res, errors.FAMILY_STILL_ACTIVE);
  });

  test('[TC-DELETE-004] 无 Token', async ({ request }) => {
    const res = await deleteAccount(request, null);
    await assertError(res, errors.TOKEN_INVALID);
  });

});
