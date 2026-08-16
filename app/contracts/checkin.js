// app/contracts/checkin.js
// 打卡模块 API 契约镜像 —— 单一真相源为 openspec/contracts/checkin/{enums,errors,dto}.json
//
// 本文件由契约 JSON 派生，供小程序运行时（app/ 打包目录内）引用。
// 禁止在 services/ 或 pages/ 中手写下列字符串字面量，一律从此模块引用。
// 一致性由 __tests__/contracts/checkin.test.js 的 parity 测试锁定：
//   若 openspec/contracts/checkin/*.json 变更而本文件未同步，测试将失败。
//
// 派生自：openspec/contracts/checkin/enums.json / errors.json / dto.json

'use strict';

/** CheckinStatus 枚举值（enums.json CheckinStatus，小写字符串，非 C# 枚举） */
const CheckinStatus = Object.freeze({
  Incomplete: 'incomplete',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Ended: 'ended',
  Overdue: 'overdue'
});

/** CheckinSource 枚举值（enums.json CheckinSource） */
const CheckinSource = Object.freeze({
  Parent: 'Parent',
  Child: 'Child'
});

/** 打卡窗口 reason 取值（dto.json CheckinWindowResponse.reason） */
const Reason = Object.freeze({
  Early: 'EARLY',
  TerminalState: 'TERMINAL_STATE',
  WindowClosed: 'CHECKIN_WINDOW_CLOSED'
});

/** 错误码（errors.json keys） */
const ErrorCodes = Object.freeze({
  CHECKIN_WINDOW_CLOSED: 'CHECKIN_WINDOW_CLOSED',
  TERMINAL_STATE: 'TERMINAL_STATE',
  NOT_CHECKED_IN: 'NOT_CHECKED_IN',
  WINDOW_CLOSED: 'WINDOW_CLOSED',
  SCHEDULE_CANCELLED: 'SCHEDULE_CANCELLED',
  NOT_FAMILY_MEMBER: 'NOT_FAMILY_MEMBER',
  SCHEDULE_NOT_FOUND: 'SCHEDULE_NOT_FOUND'
});

/** 错误码 → 中文提示（errors.json message，前端展示的权威值） */
const ErrorMessages = Object.freeze({
  CHECKIN_WINDOW_CLOSED: '打卡时间窗口已关闭',
  TERMINAL_STATE: '该日程已结算，不可打卡或撤销',
  NOT_CHECKED_IN: '该日程尚未打卡，无法撤销',
  WINDOW_CLOSED: '撤销窗口已关闭，无法撤销',
  SCHEDULE_CANCELLED: '该日程已取消或排除，无法打卡',
  NOT_FAMILY_MEMBER: '你不是该日程所属家庭的成员，无权操作',
  SCHEDULE_NOT_FOUND: '日程不存在'
});

/** 错误码 → HTTP 状态码（errors.json httpStatus） */
const HttpStatus = Object.freeze({
  CHECKIN_WINDOW_CLOSED: 400,
  TERMINAL_STATE: 400,
  NOT_CHECKED_IN: 400,
  WINDOW_CLOSED: 400,
  SCHEDULE_CANCELLED: 400,
  NOT_FAMILY_MEMBER: 403,
  SCHEDULE_NOT_FOUND: 404
});

module.exports = { CheckinStatus, CheckinSource, Reason, ErrorCodes, ErrorMessages, HttpStatus };
