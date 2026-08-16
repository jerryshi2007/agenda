// app/__tests__/utils/storage-keys.test.js
const STORAGE_KEYS = require('../../utils/storage-keys');

describe('storage-keys', () => {
  test('导出认证模块要求的四个键名常量', () => {
    expect(STORAGE_KEYS.AUTH_TOKEN).toBe('auth_token');
    expect(STORAGE_KEYS.PRIVACY_CONSENT).toBe('privacy_consent');
    expect(STORAGE_KEYS.USER_PROFILE_CACHE).toBe('user_profile_cache');
    expect(STORAGE_KEYS.FAMILIES_CACHE).toBe('families_cache');
  });

  test('保留日程模块已有键名（不破坏历史模块）', () => {
    expect(STORAGE_KEYS.CALENDAR_VIEW).toBe('calendar_view');
    expect(STORAGE_KEYS.CALENDAR_DATE).toBe('calendar_date');
    expect(STORAGE_KEYS.CURRENT_FAMILY_ID).toBe('current_family_id');
    expect(STORAGE_KEYS.SCHEDULE_DRAFT).toBe('schedule_create_draft');
  });
});
