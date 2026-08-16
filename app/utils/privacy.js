// app/utils/privacy.js
// 隐私政策版本管理 —— 同意状态（版本号 + 时间戳）缓存至 Storage
// 每次启动比对版本号，不一致则重新弹窗（ADR-006）

const STORAGE_KEYS = require('./storage-keys');

/** 当前隐私政策版本号（与小程序发版同步手动维护） */
const PRIVACY_POLICY_VERSION = '1.0';

/**
 * 检查隐私政策同意状态
 * @returns {{ consented: boolean, needsReshow: boolean }}
 */
function checkConsent() {
  const consent = wx.getStorageSync(STORAGE_KEYS.PRIVACY_CONSENT);
  const matched = !!consent && consent.version === PRIVACY_POLICY_VERSION;
  return {
    consented: matched,
    needsReshow: !matched
  };
}

/**
 * 记录同意（写入当前版本号 + 时间戳）
 */
function recordConsent() {
  wx.setStorageSync(STORAGE_KEYS.PRIVACY_CONSENT, {
    version: PRIVACY_POLICY_VERSION,
    time: Date.now()
  });
}

module.exports = { PRIVACY_POLICY_VERSION, checkConsent, recordConsent };
