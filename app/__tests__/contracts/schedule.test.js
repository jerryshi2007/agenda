// app/__tests__/contracts/schedule.test.js
// 契约 parity 测试 —— 锁定 app/contracts/schedule.js 与 openspec/contracts/schedule/*.json 一致

const path = require('path');
const contracts = require('../../contracts/schedule');

const enums = require(path.resolve(__dirname, '../../../openspec/contracts/schedule/enums.json'));
const errors = require(path.resolve(__dirname, '../../../openspec/contracts/schedule/errors.json'));
const dto = require(path.resolve(__dirname, '../../../openspec/contracts/schedule/dto.json'));

describe('日程契约镜像与 openspec/contracts/schedule 一致性', () => {
  test('ScheduleType 枚举值与 enums.json 完全一致', () => {
    expect(Object.values(contracts.ScheduleType).sort())
      .toEqual([...enums.ScheduleType.values].sort());
  });

  test('Scope 枚举值与 enums.json 完全一致', () => {
    expect(Object.values(contracts.Scope).sort())
      .toEqual([...enums.Scope.values].sort());
  });

  test('UserRole 枚举值与 enums.json 完全一致', () => {
    expect(Object.values(contracts.UserRole).sort())
      .toEqual([...enums.UserRole.values].sort());
  });

  test('ErrorCodes 与 errors.json 的键完全一致', () => {
    expect(Object.keys(contracts.ErrorCodes).sort())
      .toEqual(Object.keys(errors).sort());
  });

  test('ErrorMessages 与 errors.json 的 message 完全一致', () => {
    for (const code of Object.keys(errors)) {
      expect(contracts.ErrorMessages[code]).toBe(errors[code].message);
    }
  });

  test('HttpStatus 与 errors.json 的 httpStatus 完全一致', () => {
    for (const code of Object.keys(errors)) {
      expect(contracts.HttpStatus[code]).toBe(errors[code].httpStatus);
    }
  });

  test('DeprecatedErrorCodes 与 errors.json 的 deprecated:true 键一致', () => {
    const deprecatedKeys = Object.keys(errors)
      .filter((k) => errors[k].deprecated === true)
      .sort();
    expect(Object.values(contracts.DeprecatedErrorCodes).sort())
      .toEqual(deprecatedKeys);
  });

  test('非 HomeworkTask 类型为单一标签', () => {
    expect(contracts.ScheduleTypeLabels.AfterSchoolActivity).toBe('课后活动');
    expect(contracts.ScheduleTypeLabels.DailyRoutine).toBe('日常作息');
  });

  test('ScheduleTypeLabels.HomeworkTask 角色感知标签与 enums.json 一致', () => {
    expect(contracts.ScheduleTypeLabels.HomeworkTask)
      .toEqual(enums.ScheduleType.dualLabelByMemberRole.HomeworkTask);
  });

  test('getScheduleTypeLabel 按成员角色切换 HomeworkTask 标签', () => {
    const { ScheduleType, UserRole, getScheduleTypeLabel } = contracts;
    expect(getScheduleTypeLabel(ScheduleType.HomeworkTask, UserRole.Parent)).toBe('待办事项');
    expect(getScheduleTypeLabel(ScheduleType.HomeworkTask, UserRole.Child)).toBe('作业任务');
    expect(getScheduleTypeLabel(ScheduleType.AfterSchoolActivity, UserRole.Parent)).toBe('课后活动');
    expect(getScheduleTypeLabel(ScheduleType.DailyRoutine, UserRole.Child)).toBe('日常作息');
  });

  test('CreateScheduleRequest 契约：memberIds 新字段 + childIds deprecated 旧字段', () => {
    const fields = dto.CreateScheduleRequest.fields;
    expect(fields.memberIds).toBeDefined();
    expect(fields.memberIds.deprecated).toBeUndefined();
    expect(fields.childIds).toBeDefined();
    expect(fields.childIds.deprecated).toBe(true);
  });

  test('ScheduleResponse 契约：assignedMemberId 新 + assignedChildId deprecated + 角色/名', () => {
    const fields = dto.ScheduleResponse.fields;
    expect(fields.assignedMemberId).toBeDefined();
    expect(fields.assignedChildId).toBeDefined();
    expect(fields.assignedChildId.deprecated).toBe(true);
    expect(fields.assignedMemberRole).toBeDefined();
    expect(fields.assignedMemberName).toBeDefined();
  });

  test('ApplyTemplateRequest 契约：memberIds 多选新字段 + childId deprecated 单选', () => {
    const fields = dto.ApplyTemplateRequest.fields;
    expect(fields.memberIds).toBeDefined();
    expect(fields.memberIds.deprecated).toBeUndefined();
    expect(fields.childId).toBeDefined();
    expect(fields.childId.deprecated).toBe(true);
  });
});
