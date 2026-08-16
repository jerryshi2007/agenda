// testing/e2e/specs/auth-avatar.spec.js
// TC-AVATAR-001 ~ 006: 头像上传 (POST /api/v1/upload/avatar)
// Reachable via direct JWT + DB seed (no WeChat login) — see test-plan.md §3.2.
// Backend only validates extension + size (AvatarStorageService), not image magic bytes,
// so valid-image fixtures are simple in-memory buffers.

const { test, expect } = require('@playwright/test');
const { errors, enums, assertError } = require('../helpers/contracts');
const { uploadAvatar, healthCheck } = require('../helpers/api-client');
const { generateToken, AUTH_TEST_USERS } = require('../helpers/jwt-helper');
const { seedAuthUser, cleanupAuthUser } = require('../helpers/db');

const USER = AUTH_TEST_USERS.AVATAR;
const UserStatus = enums.UserStatus.numeric;

// Minimal image signatures + padding — backend checks extension/size only (not magic bytes).
const PNG_BUFFER = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(64, 0)]);
const JPG_BUFFER = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), Buffer.alloc(32, 0), Buffer.from([0xFF, 0xD9])]);
const OVERSIZED_BUFFER = Buffer.alloc(2 * 1024 * 1024 + 1, 0);
const EMPTY_BUFFER = Buffer.alloc(0);
const TXT_BUFFER = Buffer.from('not an image', 'utf8');

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

test.describe('2.G 头像上传 (POST /api/v1/upload/avatar)', () => {

  test('[TC-AVATAR-001] 正常上传 png', async ({ request }) => {
    const res = await uploadAvatar(request, generateToken(USER), {
      fileName: 'avatar.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // 核心契约：文件名由 userId + 扩展名构成（AvatarBaseUrl 前缀为配置项）
    expect(body.url).toContain(`${USER}.png`);
  });

  test('[TC-AVATAR-002] 格式无效（.txt）', async ({ request }) => {
    const res = await uploadAvatar(request, generateToken(USER), {
      fileName: 'avatar.txt',
      mimeType: 'text/plain',
      buffer: TXT_BUFFER,
    });
    await assertError(res, errors.FILE_FORMAT_INVALID);
  });

  test('[TC-AVATAR-003] 空文件', async ({ request }) => {
    const res = await uploadAvatar(request, generateToken(USER), {
      fileName: 'avatar.png',
      mimeType: 'image/png',
      buffer: EMPTY_BUFFER,
    });
    await assertError(res, errors.FILE_FORMAT_INVALID);
  });

  test('[TC-AVATAR-004] 大小超限（>2MB）', async ({ request }) => {
    const res = await uploadAvatar(request, generateToken(USER), {
      fileName: 'avatar.png',
      mimeType: 'image/png',
      buffer: OVERSIZED_BUFFER,
    });
    await assertError(res, errors.FILE_TOO_LARGE);
  });

  test('[TC-AVATAR-005] 无 Token', async ({ request }) => {
    const res = await uploadAvatar(request, null, {
      fileName: 'avatar.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });
    await assertError(res, errors.TOKEN_INVALID);
  });

  test('[TC-AVATAR-006] 上传替换旧头像（扩展名不同）', async ({ request }) => {
    // 先传 .png，再传 .jpg，验证替换上传成功且 URL 指向新扩展名。
    // 旧 .png 文件被清理由 AvatarStorageServiceTests（单元测试）覆盖，
    // API 级无法可靠断言本地文件系统（AvatarRootPath 可能位于远端主机）。
    const first = await uploadAvatar(request, generateToken(USER), {
      fileName: 'avatar.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });
    expect(first.status()).toBe(200);

    const second = await uploadAvatar(request, generateToken(USER), {
      fileName: 'avatar.jpg',
      mimeType: 'image/jpeg',
      buffer: JPG_BUFFER,
    });
    expect(second.status()).toBe(200);
    const body = await second.json();
    expect(body.url).toContain(`${USER}.jpg`);
  });

});
