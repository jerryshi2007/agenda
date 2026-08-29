// app/miniapp/contracts/schedule.js
// 日程模块 API 契约镜像 —— 单一真相源为 openspec/contracts/schedule/{enums,errors,dto}.json
//
// 本文件由契约 JSON 派生，供小程序运行时（app/ 打包目录内）引用。
// 禁止在 services/ 或 pages/ 中手写下列字符串字面量，一律从此模块引用。
// 一致性由 __tests__/contracts/schedule.test.js 的 parity 测试锁定：
//   若 openspec/contracts/schedule/*.json 变更而本文件未同步，测试将失败。
//
// 派生自：openspec/contracts/schedule/enums.json / errors.json / dto.json

'use strict';

/** ScheduleType 枚举值（enums.json ScheduleType —— 复用日程类型枚举） */
const ScheduleType = Object.freeze({
  AfterSchoolActivity: 'AfterSchoolActivity',
  DailyRoutine: 'DailyRoutine',
  HomeworkTask: 'HomeworkTask'
});

/**
 * ScheduleType → 中文标签（enums.json ScheduleType.dualLabelByMemberRole）
 * HomeworkTask 角色感知：关联成员为家长显示「待办事项」、为孩子显示「作业任务」。
 * 其余类型为单一标签字符串。渲染时经 getScheduleTypeLabel 解析。
 */
const ScheduleTypeLabels = Object.freeze({
  AfterSchoolActivity: '课后活动',
  DailyRoutine: '日常作息',
  HomeworkTask: Object.freeze({
    Parent: '待办事项',
    Child: '作业任务'
  })
});

/**
 * 解析日程类型标签：HomeworkTask 按关联成员角色切换，其余类型返回单一标签。
 * memberRole 未提供或未知时，HomeworkTask 回退为孩子标签「作业任务」
 * （泛化前所有关联对象均为孩子，历史默认语义）。
 */
function getScheduleTypeLabel(scheduleType, memberRole) {
  const label = ScheduleTypeLabels[scheduleType];
  if (!label) {
    return scheduleType;
  }
  if (typeof label === 'string') {
    return label;
  }
  return label[memberRole] || label.Child;
}

/** Scope 枚举值（enums.json Scope —— 编辑/删除影响范围） */
const Scope = Object.freeze({
  ThisOnly: 'ThisOnly',
  ThisAndFuture: 'ThisAndFuture'
});

/** UserRole 枚举值（enums.json UserRole —— 成员角色） */
const UserRole = Object.freeze({
  Parent: 'Parent',
  Child: 'Child'
});

/** 错误码（errors.json keys，含 deprecated 旧别名） */
const ErrorCodes = Object.freeze({
  MEMBER_NOT_SELECTED: 'MEMBER_NOT_SELECTED',
  CHILD_NOT_SELECTED: 'CHILD_NOT_SELECTED',
  MEMBER_NOT_IN_FAMILY: 'MEMBER_NOT_IN_FAMILY',
  CHILD_NOT_IN_FAMILY: 'CHILD_NOT_IN_FAMILY',
  CHILD_SELF_ASSIGN_ONLY: 'CHILD_SELF_ASSIGN_ONLY',
  CHILD_ACCESS_DENIED: 'CHILD_ACCESS_DENIED',
  SCHEDULE_NOT_FOUND: 'SCHEDULE_NOT_FOUND',
  SCHEDULE_NAME_EMPTY: 'SCHEDULE_NAME_EMPTY',
  SCHEDULE_NAME_TOO_LONG: 'SCHEDULE_NAME_TOO_LONG',
  SCHEDULE_TYPE_INVALID: 'SCHEDULE_TYPE_INVALID',
  LOCATION_TOO_LONG: 'LOCATION_TOO_LONG',
  NOTES_TOO_LONG: 'NOTES_TOO_LONG',
  REPEAT_END_DATE_INVALID: 'REPEAT_END_DATE_INVALID',
  DUE_DATE_REQUIRED: 'DUE_DATE_REQUIRED',
  DUE_DATE_INVALID: 'DUE_DATE_INVALID',
  NO_DAY_SELECTED: 'NO_DAY_SELECTED',
  TIME_SLOT_INVALID: 'TIME_SLOT_INVALID',
  INVALID_SCOPE: 'INVALID_SCOPE',
  SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT',
  CONCURRENT_EDIT_CONFLICT: 'CONCURRENT_EDIT_CONFLICT'
});

/** 已废弃的旧错误码别名（errors.json deprecated:true，兼容期保留，V+1 移除） */
const DeprecatedErrorCodes = Object.freeze({
  CHILD_NOT_SELECTED: 'CHILD_NOT_SELECTED',
  CHILD_NOT_IN_FAMILY: 'CHILD_NOT_IN_FAMILY'
});

/** 错误码 → 中文提示（errors.json message，前端展示的权威值） */
const ErrorMessages = Object.freeze({
  MEMBER_NOT_SELECTED: '请至少选择一个成员',
  CHILD_NOT_SELECTED: '请至少选择一个成员',
  MEMBER_NOT_IN_FAMILY: '所选成员不属于当前家庭',
  CHILD_NOT_IN_FAMILY: '所选成员不属于当前家庭',
  CHILD_SELF_ASSIGN_ONLY: '孩子只能给自己创建日程',
  CHILD_ACCESS_DENIED: '你只能查看或操作自己的日程',
  SCHEDULE_NOT_FOUND: '日程不存在',
  SCHEDULE_NAME_EMPTY: '日程名称不能为空',
  SCHEDULE_NAME_TOO_LONG: '日程名称不能超过 50 个字符',
  SCHEDULE_TYPE_INVALID: '日程类型无效',
  LOCATION_TOO_LONG: '地点不能超过 100 个字符',
  NOTES_TOO_LONG: '备注不能超过 500 个字符',
  REPEAT_END_DATE_INVALID: '重复结束日期不能早于今天',
  DUE_DATE_REQUIRED: '作业任务必须设置截止日期',
  DUE_DATE_INVALID: '截止日期不能早于今天',
  NO_DAY_SELECTED: '请至少选择一个时间槽星期',
  TIME_SLOT_INVALID: '时间槽开始时间不能晚于或等于结束时间',
  INVALID_SCOPE: '影响范围参数无效',
  SCHEDULE_CONFLICT: '该时段与已有日程存在时间重叠',
  CONCURRENT_EDIT_CONFLICT: '日程已被他人修改，请刷新后重试'
});

/** 错误码 → HTTP 状态码（errors.json httpStatus） */
const HttpStatus = Object.freeze({
  MEMBER_NOT_SELECTED: 400,
  CHILD_NOT_SELECTED: 400,
  MEMBER_NOT_IN_FAMILY: 400,
  CHILD_NOT_IN_FAMILY: 400,
  CHILD_SELF_ASSIGN_ONLY: 403,
  CHILD_ACCESS_DENIED: 403,
  SCHEDULE_NOT_FOUND: 404,
  SCHEDULE_NAME_EMPTY: 400,
  SCHEDULE_NAME_TOO_LONG: 400,
  SCHEDULE_TYPE_INVALID: 400,
  LOCATION_TOO_LONG: 400,
  NOTES_TOO_LONG: 400,
  REPEAT_END_DATE_INVALID: 400,
  DUE_DATE_REQUIRED: 400,
  DUE_DATE_INVALID: 400,
  NO_DAY_SELECTED: 400,
  TIME_SLOT_INVALID: 400,
  INVALID_SCOPE: 400,
  SCHEDULE_CONFLICT: 409,
  CONCURRENT_EDIT_CONFLICT: 409
});

module.exports = {
  ScheduleType,
  ScheduleTypeLabels,
  getScheduleTypeLabel,
  Scope,
  UserRole,
  ErrorCodes,
  DeprecatedErrorCodes,
  ErrorMessages,
  HttpStatus
};
