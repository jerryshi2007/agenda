// testing/e2e/specs/auth-refresh.spec.js
// TC-REFRESH-001 ~ 006: 续期 (POST /api/v1/auth/refresh)
//
// ⚠️ 全部 skip — GAP：与 auth-login 相同，后端 WeChatService 无 mock 模式，
// 续期依赖 jscode2session 换取 openid，E2E 不可达。
// 解除条件：后端给 WeChatService 增加 WeChat:MockMode=true 配置开关（见 test-plan.md §3.3）。

const { test, expect } = require('@playwright/test');
const { errors } = require('../helpers/contracts');
const { refresh } = require('../helpers/api-client');

test.describe('2.B 续期 (POST /api/v1/auth/refresh) — GAP: 待 WeChat MockMode', () => {

  test.skip('[TC-REFRESH-001] 正常续期', async ({ request }) => {
    const res = await refresh(request, { code: 'refresh' });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.jwt).toBeDefined();
    expect(body.userId).toBeDefined();
  });

  test.skip('[TC-REFRESH-002] code 无效', async ({ request }) => {
    const res = await refresh(request, { code: 'invalid-code' });
    expect(res.status()).toBe(errors.CODE_INVALID.httpStatus);
  });

  test.skip('[TC-REFRESH-003] code 为空', async ({ request }) => {
    const res = await refresh(request, { code: '' });
    expect(res.status()).toBe(errors.CODE_INVALID.httpStatus);
  });

  test.skip('[TC-REFRESH-004] 已注销用户续期', async ({ request }) => {
    const res = await refresh(request, { code: 'refresh-deleted' });
    expect(res.status()).toBe(errors.TOKEN_INVALID.httpStatus);
  });

  test.skip('[TC-REFRESH-005] 微信超时', async ({ request }) => {
    const res = await refresh(request, { code: 'timeout-code' });
    expect(res.status()).toBe(errors.WECHAT_API_TIMEOUT.httpStatus);
  });

  // 429 用例需隔离执行（test-plan §6 R3）。
  test.skip('[TC-REFRESH-006] 续期频率限制', async ({ request }) => {
    for (let i = 0; i < 10; i++) await refresh(request, { code: `rate-${i}` });
    const res = await refresh(request, { code: 'rate-over' });
    expect(res.status()).toBe(errors.RATE_LIMITED.httpStatus);
  });

});
