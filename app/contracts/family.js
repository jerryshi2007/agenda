// app/contracts/family.js
// 家庭管理模块 API 契约镜像 —— 单一真相源为 openspec/contracts/family/{enums,errors,dto}.json
//
// 本文件由契约 JSON 派生，供小程序运行时（app/ 打包目录内）引用。
// 禁止在 services/ 或 pages/ 中手写下列字符串字面量，一律从此模块引用。
// 一致性由 __tests__/contracts/family.test.js 的 parity 测试锁定：
//   若 openspec/contracts/family/*.json 变更而本文件未同步，测试将失败。
//
// 派生自：openspec/contracts/family/enums.json / errors.json / dto.json

'use strict';

/** DisplayMode 枚举值（enums.json，孩子展示模式） */
const DisplayMode = Object.freeze({
  Preschool: 'Preschool',
  Primary: 'Primary',
  UpperGrades: 'UpperGrades'
});

/** FamilyStatus 枚举值（enums.json，家庭状态） */
const FamilyStatus = Object.freeze({
  Normal: 'Normal',
  Dissolved: 'Dissolved'
});

/** InvitationCodeStatus 枚举值（enums.json，邀请码状态） */
const InvitationCodeStatus = Object.freeze({
  Pending: 'Pending',
  Used: 'Used',
  Redeemed: 'Redeemed',
  Expired: 'Expired'
});

/** UserRole 枚举值（家庭场景下家长/孩子两种角色，与认证模块复用同一概念） */
const UserRole = Object.freeze({
  Parent: 'Parent',
  Child: 'Child'
});

/** DisplayMode → 中文标签（前端展示用） */
const DisplayModeLabels = Object.freeze({
  Preschool: '学龄前',
  Primary: '小学',
  UpperGrades: '高年级'
});

/** UserRole → 中文标签 */
const UserRoleLabels = Object.freeze({
  Parent: '家长',
  Child: '孩子'
});

/** 错误码（errors.json keys） */
const ErrorCodes = Object.freeze({
  CANNOT_REMOVE_SELF: 'CANNOT_REMOVE_SELF',
  DISSOLVED_EXPIRED: 'DISSOLVED_EXPIRED',
  FAMILY_ALREADY_DISSOLVED: 'FAMILY_ALREADY_DISSOLVED',
  FAMILY_CREATOR_CANNOT_EXIT: 'FAMILY_CREATOR_CANNOT_EXIT',
  FAMILY_MEMBER_LIMIT_EXCEEDED: 'FAMILY_MEMBER_LIMIT_EXCEEDED',
  FAMILY_NAME_INVALID_LENGTH: 'FAMILY_NAME_INVALID_LENGTH',
  FAMILY_NAME_MISMATCH: 'FAMILY_NAME_MISMATCH',
  FAMILY_NOT_DISSOLVED: 'FAMILY_NOT_DISSOLVED',
  FAMILY_NOT_FOUND: 'FAMILY_NOT_FOUND',
  INVALID_INVITATION_CODE: 'INVALID_INVITATION_CODE',
  INVALID_TRANSFER_TARGET: 'INVALID_TRANSFER_TARGET',
  INVITATION_CANNOT_REVOKE: 'INVITATION_CANNOT_REVOKE',
  INVITATION_CODE_EXPIRED: 'INVITATION_CODE_EXPIRED',
  INVITATION_CODE_GENERATION_FAILED: 'INVITATION_CODE_GENERATION_FAILED',
  INVITATION_CODE_REDEEMED: 'INVITATION_CODE_REDEEMED',
  INVITATION_CODE_USED: 'INVITATION_CODE_USED',
  LAST_PARENT_CANNOT_EXIT: 'LAST_PARENT_CANNOT_EXIT',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  NOT_FAMILY_MEMBER: 'NOT_FAMILY_MEMBER',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  USER_ALREADY_IN_FAMILY: 'USER_ALREADY_IN_FAMILY'
});

/** 错误码 → 中文提示（errors.json message，前端展示的权威值） */
const ErrorMessages = Object.freeze({
  CANNOT_REMOVE_SELF: '不能移除自己，请使用退出功能',
  DISSOLVED_EXPIRED: '数据已过期删除，无法恢复',
  FAMILY_ALREADY_DISSOLVED: '家庭已解散',
  FAMILY_CREATOR_CANNOT_EXIT: '创建者无法退出，请先解散家庭',
  FAMILY_MEMBER_LIMIT_EXCEEDED: '家庭已满（10 人），无法加入',
  FAMILY_NAME_INVALID_LENGTH: '家庭名称需要 2-20 个字符',
  FAMILY_NAME_MISMATCH: '家庭名称不匹配，请重新输入',
  FAMILY_NOT_DISSOLVED: '家庭未解散',
  FAMILY_NOT_FOUND: '家庭不存在',
  INVALID_INVITATION_CODE: '邀请码无效，请检查后重试',
  INVALID_TRANSFER_TARGET: '只能转让给家长角色成员',
  INVITATION_CANNOT_REVOKE: '邀请码已使用，无法撤销',
  INVITATION_CODE_EXPIRED: '邀请码已失效，请联系家长重新获取',
  INVITATION_CODE_GENERATION_FAILED: '邀请码生成冲突，请稍后重试',
  INVITATION_CODE_REDEEMED: '邀请码已被撤销',
  INVITATION_CODE_USED: '邀请码已被使用',
  LAST_PARENT_CANNOT_EXIT: '请先将孩子移除或转让家庭给其他家长，才能退出',
  MEMBER_NOT_FOUND: '成员不存在',
  NOT_FAMILY_MEMBER: '你不是该家庭成员',
  PERMISSION_DENIED: '无权限执行此操作',
  USER_ALREADY_IN_FAMILY: '你已是该家庭成员'
});

/** 错误码 → HTTP 状态码（errors.json httpStatus） */
const HttpStatus = Object.freeze({
  CANNOT_REMOVE_SELF: 400,
  DISSOLVED_EXPIRED: 410,
  FAMILY_ALREADY_DISSOLVED: 400,
  FAMILY_CREATOR_CANNOT_EXIT: 403,
  FAMILY_MEMBER_LIMIT_EXCEEDED: 403,
  FAMILY_NAME_INVALID_LENGTH: 400,
  FAMILY_NAME_MISMATCH: 400,
  FAMILY_NOT_DISSOLVED: 400,
  FAMILY_NOT_FOUND: 404,
  INVALID_INVITATION_CODE: 400,
  INVALID_TRANSFER_TARGET: 400,
  INVITATION_CANNOT_REVOKE: 400,
  INVITATION_CODE_EXPIRED: 400,
  INVITATION_CODE_GENERATION_FAILED: 503,
  INVITATION_CODE_REDEEMED: 400,
  INVITATION_CODE_USED: 400,
  LAST_PARENT_CANNOT_EXIT: 403,
  MEMBER_NOT_FOUND: 404,
  NOT_FAMILY_MEMBER: 403,
  PERMISSION_DENIED: 403,
  USER_ALREADY_IN_FAMILY: 400
});

module.exports = {
  DisplayMode,
  FamilyStatus,
  InvitationCodeStatus,
  UserRole,
  DisplayModeLabels,
  UserRoleLabels,
  ErrorCodes,
  ErrorMessages,
  HttpStatus
};
