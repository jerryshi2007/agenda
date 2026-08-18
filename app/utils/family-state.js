// app/utils/family-state.js
// 多家庭状态记忆 helper —— 每个家庭独立的视图/筛选状态存储
// 存储键格式：family-{familyId}-state
// 状态结构：{ view: 'week'|'month'|'day', date: 'YYYY-MM-DD', filterChildId: '', filterTypes: [] }
//
// 用法：
//   const state = loadState(familyId);   // 切到某家庭时读取
//   saveState(familyId, { view: 'month', date: '...' });  // 操作时写入
//   clearState(familyId);                 // 退出/解散家庭时清理

'use strict';

const STORAGE_KEYS = {
  FAMILY_STATE_PREFIX: 'family-',
  FAMILY_STATE_SUFFIX: '-state'
};

function _stateKey(familyId) {
  return STORAGE_KEYS.FAMILY_STATE_PREFIX + familyId + STORAGE_KEYS.FAMILY_STATE_SUFFIX;
}

function _hasWx() {
  return typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function';
}

function loadState(familyId) {
  if (!familyId) return null;
  if (!_hasWx()) return null;
  const raw = wx.getStorageSync(_stateKey(familyId));
  return raw || null;
}

function saveState(familyId, state) {
  if (!familyId || !state) return;
  if (!_hasWx()) return;
  wx.setStorageSync(_stateKey(familyId), state);
}

function clearState(familyId) {
  if (!familyId) return;
  if (!_hasWx() || typeof wx.removeStorageSync !== 'function') return;
  wx.removeStorageSync(_stateKey(familyId));
}

module.exports = {
  loadState,
  saveState,
  clearState,
  // 导出供测试与调用方按需使用
  _stateKey
};
