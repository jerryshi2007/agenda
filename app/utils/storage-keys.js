// app/utils/storage-keys.js
// Storage key constants — 所有 Storage 键名集中定义，禁止散落字符串键

const STORAGE_KEYS = {
  // Auth
  AUTH_TOKEN: 'auth_token',
  PRIVACY_CONSENT: 'privacy_consent',
  USER_PROFILE_CACHE: 'user_profile_cache',
  FAMILIES_CACHE: 'families_cache',

  // Calendar
  CALENDAR_VIEW: 'calendar_view',
  CALENDAR_DATE: 'calendar_date',
  CALENDAR_FILTER_CHILD: 'calendar_filter_child',
  CALENDAR_FILTER_TYPES: 'calendar_filter_types',

  // Family
  CURRENT_FAMILY_ID: 'current_family_id',
  FAMILY_LIST: 'family_list',
  CHILD_LIST: 'child_list',

  // Schedule create draft
  SCHEDULE_DRAFT: 'schedule_create_draft',

  // Cache
  CALENDAR_CACHE_PREFIX: 'calendar_cache_',
  SCHEDULE_CACHE_PREFIX: 'schedule_cache_'
};

module.exports = STORAGE_KEYS;
