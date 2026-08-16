// testing/e2e/specs/auth-families.spec.js
// TC-FAMILIES-001 ~ 003: 用户家庭列表 (GET /api/v1/users/me/families)
// 首期 IFamilyQueryService 为空实现，始终返回 {families:[]} — 见 test-plan.md §2.9。

const { test, expect } = require('@playwright/test');
const { errors, enums, assertError } = require('../helpers/contracts');
const { getMyFamilies, healthCheck } = require('../helpers/api-client');
const { generateToken, AUTH_TEST_USERS } = require('../helpers/jwt-helper');
const { seedAuthUser, cleanupAuthUser } = require('../helpers/db');

const USER = AUTH_TEST_USERS.FAMILIES;
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

test.describe('2.H 用户家庭列表 (GET /api/v1/users/me/families)', () => {

  test('[TC-FAMILIES-001] 空实现返回空数组', async ({ request }) => {
    const res = await getMyFamilies(request, generateToken(USER));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('families');
    expect(body.families).toEqual([]);
  });

  test('[TC-FAMILIES-002] 无 Token', async ({ request }) => {
    const res = await getMyFamilies(request, null);
    await assertError(res, errors.TOKEN_INVALID);
  });

  // GAP: IFamilyQueryService 空实现，无家庭关联可返回。解除条件：家庭模块实现后补种家庭关系。
  test.skip('[TC-FAMILIES-003] 有家庭返回列表', async ({ request }) => {
    const res = await getMyFamilies(request, generateToken(USER));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.families.length).toBeGreaterThan(0);
    expect(body.families[0]).toHaveProperty('familyId');
    expect(body.families[0]).toHaveProperty('familyName');
    expect(body.families[0]).toHaveProperty('role');
    expect(body.families[0]).toHaveProperty('memberCount');
  });

});
