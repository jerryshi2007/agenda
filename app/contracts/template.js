// app/contracts/template.js
// 模板系统 API 契约镜像 —— 单一真相源为 openspec/contracts/template/{enums,errors,dto}.json
//
// 本文件由契约 JSON 派生，供小程序运行时（app/ 打包目录内）引用。
// 禁止在 services/ 或 pages/ 中手写下列字符串字面量，一律从此模块引用。
// 一致性由 __tests__/contracts/template.test.js 的 parity 测试锁定：
//   若 openspec/contracts/template/*.json 变更而本文件未同步，测试将失败。
//
// 派生自：openspec/contracts/template/enums.json / errors.json / dto.json

'use strict';

/** TemplateSource 枚举值（enums.json TemplateSource —— 前端 UI 标签用） */
const TemplateSource = Object.freeze({
  Preset: 'Preset',
  Custom: 'Custom'
});

/** TemplateSource → 中文标签（前端展示用） */
const TemplateSourceLabels = Object.freeze({
  Preset: '系统预设',
  Custom: '我的模板'
});

/** ScheduleType 枚举值（enums.json ScheduleType —— 复用日程类型枚举） */
const ScheduleType = Object.freeze({
  AfterSchoolActivity: 'AfterSchoolActivity',
  DailyRoutine: 'DailyRoutine',
  HomeworkTask: 'HomeworkTask'
});

/** ScheduleType → 中文标签 */
const ScheduleTypeLabels = Object.freeze({
  AfterSchoolActivity: '课后活动',
  DailyRoutine: '日常作息',
  HomeworkTask: '作业任务'
});

/** 错误码（errors.json keys） */
const ErrorCodes = Object.freeze({
  TEMPLATE_NAME_EMPTY: 'TEMPLATE_NAME_EMPTY',
  TEMPLATE_NAME_TOO_LONG: 'TEMPLATE_NAME_TOO_LONG',
  TEMPLATE_NOTES_TOO_LONG: 'TEMPLATE_NOTES_TOO_LONG',
  TEMPLATE_LOCATION_TOO_LONG: 'TEMPLATE_LOCATION_TOO_LONG',
  TEMPLATE_TIMESLOT_INVALID: 'TEMPLATE_TIMESLOT_INVALID',
  TEMPLATE_TIMESLOT_REQUIRED: 'TEMPLATE_TIMESLOT_REQUIRED',
  TEMPLATE_TIMESLOT_TIME_INVALID: 'TEMPLATE_TIMESLOT_TIME_INVALID',
  TEMPLATE_DUPLICATE_NAME: 'TEMPLATE_DUPLICATE_NAME',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_PRESET_READONLY: 'TEMPLATE_PRESET_READONLY',
  TEMPLATE_NOT_OWNER: 'TEMPLATE_NOT_OWNER',
  CHILD_ACCESS_DENIED: 'CHILD_ACCESS_DENIED',
  CHILD_NOT_IN_FAMILY: 'CHILD_NOT_IN_FAMILY',
  START_DATE_INVALID: 'START_DATE_INVALID',
  TEMPLATE_TYPE_INVALID: 'TEMPLATE_TYPE_INVALID'
});

/** 错误码 → 中文提示（errors.json message，前端展示的权威值） */
const ErrorMessages = Object.freeze({
  TEMPLATE_NAME_EMPTY: '模板名称不能为空',
  TEMPLATE_NAME_TOO_LONG: '模板名称不能超过 50 个字符',
  TEMPLATE_NOTES_TOO_LONG: '备注不能超过 500 个字符',
  TEMPLATE_LOCATION_TOO_LONG: '地点不能超过 100 个字符',
  TEMPLATE_TIMESLOT_INVALID: '作业任务模板不能配置时间槽',
  TEMPLATE_TIMESLOT_REQUIRED: '课后活动/日常作息模板至少需要一个时间槽',
  TEMPLATE_TIMESLOT_TIME_INVALID: '时间槽开始时间不能晚于或等于结束时间',
  TEMPLATE_DUPLICATE_NAME: '当前家庭已存在同名模板',
  TEMPLATE_NOT_FOUND: '模板不存在',
  TEMPLATE_PRESET_READONLY: '预设模板不可编辑或删除',
  TEMPLATE_NOT_OWNER: '仅创建者可编辑或删除此模板',
  CHILD_ACCESS_DENIED: '孩子角色无权访问模板',
  CHILD_NOT_IN_FAMILY: '所选孩子不属于当前家庭',
  START_DATE_INVALID: '起始日期不能早于今天',
  TEMPLATE_TYPE_INVALID: '模板类型无效'
});

/** 错误码 → HTTP 状态码（errors.json httpStatus） */
const HttpStatus = Object.freeze({
  TEMPLATE_NAME_EMPTY: 400,
  TEMPLATE_NAME_TOO_LONG: 400,
  TEMPLATE_NOTES_TOO_LONG: 400,
  TEMPLATE_LOCATION_TOO_LONG: 400,
  TEMPLATE_TIMESLOT_INVALID: 400,
  TEMPLATE_TIMESLOT_REQUIRED: 400,
  TEMPLATE_TIMESLOT_TIME_INVALID: 400,
  TEMPLATE_DUPLICATE_NAME: 409,
  TEMPLATE_NOT_FOUND: 404,
  TEMPLATE_PRESET_READONLY: 403,
  TEMPLATE_NOT_OWNER: 403,
  CHILD_ACCESS_DENIED: 403,
  CHILD_NOT_IN_FAMILY: 400,
  START_DATE_INVALID: 400,
  TEMPLATE_TYPE_INVALID: 400
});

module.exports = {
  TemplateSource,
  TemplateSourceLabels,
  ScheduleType,
  ScheduleTypeLabels,
  ErrorCodes,
  ErrorMessages,
  HttpStatus
};
