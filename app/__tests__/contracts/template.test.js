// app/__tests__/contracts/template.test.js
// 契约 parity 测试 —— 锁定 app/contracts/template.js 与 openspec/contracts/template/*.json 一致

const path = require('path');
const contracts = require('../../contracts/template');

const enums = require(path.resolve(__dirname, '../../../openspec/contracts/template/enums.json'));
const errors = require(path.resolve(__dirname, '../../../openspec/contracts/template/errors.json'));
const dto = require(path.resolve(__dirname, '../../../openspec/contracts/template/dto.json'));

describe('模板契约镜像与 openspec/contracts/template 一致性', () => {
  test('TemplateSource 枚举值与 enums.json 完全一致', () => {
    expect(Object.values(contracts.TemplateSource).sort())
      .toEqual([...enums.TemplateSource.values].sort());
  });

  test('ScheduleType 枚举值与 enums.json 完全一致（复用日程类型）', () => {
    expect(Object.values(contracts.ScheduleType).sort())
      .toEqual([...enums.ScheduleType.values].sort());
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

  test('ScheduleTypeLabels 含 3 个中文标签（课后活动/日常作息/作业任务）', () => {
    expect(contracts.ScheduleTypeLabels).toEqual({
      AfterSchoolActivity: '课后活动',
      DailyRoutine: '日常作息',
      HomeworkTask: '作业任务'
    });
  });

  test('TemplateSourceLabels 含 2 个中文标签（系统预设/我的模板）', () => {
    expect(contracts.TemplateSourceLabels).toEqual({
      Preset: '系统预设',
      Custom: '我的模板'
    });
  });

  test('CreateTemplateRequest 契约字段完整（dto.json）', () => {
    const fields = dto.CreateTemplateRequest.fields;
    expect(fields.name).toBeDefined();
    expect(fields.scheduleType).toBeDefined();
    expect(fields.timeSlots).toBeDefined();
    expect(fields.repeatEndDate).toBeDefined();
    expect(fields.location).toBeDefined();
    expect(fields.notes).toBeDefined();
  });

  test('ApplyTemplateRequest 契约字段完整（dto.json）', () => {
    const fields = dto.ApplyTemplateRequest.fields;
    expect(fields.childId).toBeDefined();
    expect(fields.startDate).toBeDefined();
    expect(fields.name).toBeDefined();
    expect(fields.timeSlots).toBeDefined();
    expect(fields.repeatEndDate).toBeDefined();
    expect(fields.location).toBeDefined();
    expect(fields.notes).toBeDefined();
  });

  test('TemplateSummary 包含 templateId/name/scheduleType/isPreset/createdBy/createdAt', () => {
    const fields = dto.TemplateSummary.fields;
    expect(fields.templateId).toBeDefined();
    expect(fields.name).toBeDefined();
    expect(fields.scheduleType).toBeDefined();
    expect(fields.isPreset).toBeDefined();
    expect(fields.createdBy).toBeDefined();
    expect(fields.createdAt).toBeDefined();
  });

  test('TemplateDetail 包含 usageCount 字段', () => {
    expect(dto.TemplateDetail.fields.usageCount).toBeDefined();
  });
});
