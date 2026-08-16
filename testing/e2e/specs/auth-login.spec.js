// testing/e2e/specs/auth-login.spec.js
// TC-LOGIN-001 ~ 012: 微信登录 (POST /api/v1/auth/login)
//
// ⚠️ 全部 skip — GAP：后端 WeChatService 直连 https://api.weixin.qq.com/sns/jscode2session，
// 当前无 mock 模式（WeChat:MockMode），E2E 无法在网络层拦截后端出站 HTTP，也无法直连真实微信。
// 解除条件：后端给 WeChatService 增加 WeChat:MockMode=true 配置开关（见 test-plan.md §3.3），
// 使得 code 前缀可确定性推导 openid（"mock-"+code）并模拟 40029/40163/50000/超时。
// 解除后：移除 test.skip，并按 test-plan.md §3.1 的 openid 规则 seed 对应用户。

const { test, expect } = require('@playwright/test');
const { errors } = require('../helpers/contracts');
const { login } = require('../helpers/api-client');

test.describe('2.A 登录 (POST /api/v1/auth/login) — GAP: 待 WeChat MockMode', () => {

  test.skip('[TC-LOGIN-001] 新用户首次登录', async ({ request }) => {
    const res = await login(request, { code: 'brand-new' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isNewUser).toBe(true);
    expect(body.needsProfileCollection).toBe(true);
    expect(body.jwt).toBeDefined();
  });

  test.skip('[TC-LOGIN-002] 已有用户登录', async ({ request }) => {
    const res = await login(request, { code: 'existing' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isNewUser).toBe(false);
    expect(body.needsProfileCollection).toBe(false);
  });

  test.skip('[TC-LOGIN-003] 已有用户但昵称为默认值', async ({ request }) => {
    const res = await login(request, { code: 'default-nick' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isNewUser).toBe(false);
    expect(body.needsProfileCollection).toBe(true);
  });

  test.skip('[TC-LOGIN-004] code 为空', async ({ request }) => {
    const res = await login(request, { code: '' });
    expect(res.status()).toBe(errors.CODE_INVALID.httpStatus);
  });

  test.skip('[TC-LOGIN-005] code 无效（微信 errcode 40029）', async ({ request }) => {
    const res = await login(request, { code: 'invalid-code' });
    expect(res.status()).toBe(errors.CODE_INVALID.httpStatus);
  });

  test.skip('[TC-LOGIN-006] code 已过期（微信 errcode 40163）', async ({ request }) => {
    const res = await login(request, { code: 'expired-code' });
    expect(res.status()).toBe(errors.CODE_EXPIRED.httpStatus);
  });

  test.skip('[TC-LOGIN-007] 微信服务异常（其他 errcode）', async ({ request }) => {
    const res = await login(request, { code: 'apierror-code' });
    expect(res.status()).toBe(errors.WECHAT_API_ERROR.httpStatus);
  });

  test.skip('[TC-LOGIN-008] 微信 API 超时', async ({ request }) => {
    const res = await login(request, { code: 'timeout-code' });
    expect(res.status()).toBe(errors.WECHAT_API_TIMEOUT.httpStatus);
  });

  test.skip('[TC-LOGIN-009] 注销 30 天到期惰性清理', async ({ request }) => {
    const res = await login(request, { code: 'expired' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isNewUser).toBe(true);
  });

  test.skip('[TC-LOGIN-010] 注销未到期返回 isDeleted', async ({ request }) => {
    const res = await login(request, { code: 'soft-deleted' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isDeleted).toBe(true);
    expect(body.remainingDays).toBeGreaterThanOrEqual(24);
    expect(body.remainingDays).toBeLessThanOrEqual(26);
  });

  test.skip('[TC-LOGIN-011] 微信账号切换（新 openid）', async ({ request }) => {
    const res = await login(request, { code: 'brand-new-2' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isNewUser).toBe(true);
  });

  // 429 用例需隔离执行（test-plan §6 R3）：与其余 login 用例串行，总数 <=10。
  test.skip('[TC-LOGIN-012] 登录频率限制', async ({ request }) => {
    for (let i = 0; i < 10; i++) await login(request, { code: `rate-${i}` });
    const res = await login(request, { code: 'rate-over' });
    expect(res.status()).toBe(errors.RATE_LIMITED.httpStatus);
  });

});
