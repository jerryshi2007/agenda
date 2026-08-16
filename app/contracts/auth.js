// app/contracts/auth.js
// 认证模块 API 契约镜像 —— 单一真相源为 openspec/contracts/auth/{enums,errors,dto}.json
//
// 本文件由契约 JSON 派生，供小程序运行时（app/ 打包目录内）引用。
// 禁止在 services/ 或 pages/ 中手写下列字符串字面量，一律从此模块引用。
// 一致性由 __tests__/contracts/auth.test.js 的 parity 测试锁定：
//   若 openspec/contracts/auth/*.json 变更而本文件未同步，测试将失败。
//
// 派生自：openspec/contracts/auth/enums.json / errors.json / dto.json

'use strict';

/** UserStatus 枚举值（enums.json） */
const UserStatus = Object.freeze({
  Active: 'Active',
  Deleted: 'Deleted'
});

/** 错误码（errors.json keys） */
const ErrorCodes = Object.freeze({
  CODE_INVALID: 'CODE_INVALID',
  CODE_EXPIRED: 'CODE_EXPIRED',
  NICKNAME_EMPTY: 'NICKNAME_EMPTY',
  NICKNAME_TOO_LONG: 'NICKNAME_TOO_LONG',
  NICKNAME_SENSITIVE: 'NICKNAME_SENSITIVE',
  FILE_FORMAT_INVALID: 'FILE_FORMAT_INVALID',
  FAMILY_STILL_ACTIVE: 'FAMILY_STILL_ACTIVE',
  NOT_DELETED: 'NOT_DELETED',
  EXPIRED: 'EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  WECHAT_API_ERROR: 'WECHAT_API_ERROR',
  WECHAT_API_TIMEOUT: 'WECHAT_API_TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
});

/** 错误码 → 中文提示（errors.json message，前端展示的权威值） */
const ErrorMessages = Object.freeze({
  CODE_INVALID: '微信登录凭证无效，请重试',
  CODE_EXPIRED: '微信登录凭证已过期，请重试',
  NICKNAME_EMPTY: '昵称不能为空',
  NICKNAME_TOO_LONG: '昵称不能超过 20 个字符',
  NICKNAME_SENSITIVE: '昵称包含不允许的词汇',
  FILE_FORMAT_INVALID: '头像文件格式不支持',
  FAMILY_STILL_ACTIVE: '请先退出所有家庭后再注销',
  NOT_DELETED: '账户未处于注销状态，无法恢复',
  EXPIRED: '注销已超过 30 天，无法恢复',
  TOKEN_INVALID: '登录已过期，请重新登录',
  FILE_TOO_LARGE: '头像文件过大，请重新选择',
  RATE_LIMITED: '操作过于频繁，请稍后再试',
  WECHAT_API_ERROR: '微信服务异常，请稍后重试',
  WECHAT_API_TIMEOUT: '服务繁忙，请稍后重试',
  INTERNAL_ERROR: '服务异常，请稍后重试'
});

/** 错误码 → HTTP 状态码（errors.json httpStatus） */
const HttpStatus = Object.freeze({
  CODE_INVALID: 400,
  CODE_EXPIRED: 400,
  NICKNAME_EMPTY: 400,
  NICKNAME_TOO_LONG: 400,
  NICKNAME_SENSITIVE: 400,
  FILE_FORMAT_INVALID: 400,
  FAMILY_STILL_ACTIVE: 400,
  NOT_DELETED: 400,
  EXPIRED: 400,
  TOKEN_INVALID: 401,
  FILE_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  WECHAT_API_ERROR: 502,
  WECHAT_API_TIMEOUT: 503,
  INTERNAL_ERROR: 500
});

module.exports = { UserStatus, ErrorCodes, ErrorMessages, HttpStatus };
