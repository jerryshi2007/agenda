// app/__tests__/contracts/checkin.test.js
// 契约 parity 测试 —— 锁定 app/contracts/checkin.js 与 openspec/contracts/checkin/*.json 一致

const path = require('path');
const contracts = require('../../contracts/checkin');

const enums = require(path.resolve(__dirname, '../../../openspec/contracts/checkin/enums.json'));
const errors = require(path.resolve(__dirname, '../../../openspec/contracts/checkin/errors.json'));
const dto = require(path.resolve(__dirname, '../../../openspec/contracts/checkin/dto.json'));

describe('打卡契约镜像与 openspec/contracts/checkin 一致性', () => {
  test('CheckinStatus 枚举值与 enums.json 完全一致', () => {
    expect(Object.values(contracts.CheckinStatus).sort())
      .toEqual([...enums.CheckinStatus.values].sort());
  });

  test('CheckinSource 枚举值与 enums.json 完全一致', () => {
    expect(Object.values(contracts.CheckinSource).sort())
      .toEqual([...enums.CheckinSource.values].sort());
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

  test('CheckinWindowResponse 契约字段完整', () => {
    expect(dto.CheckinWindowResponse.fields.canCheckin).toBeDefined();
    expect(dto.CheckinWindowResponse.fields.canUndo).toBeDefined();
    expect(dto.CheckinWindowResponse.fields.reason).toBeDefined();
    expect(dto.CheckinWindowResponse.fields.remainingSeconds).toBeDefined();
    expect(dto.CheckinWindowResponse.fields.status).toBeDefined();
    expect(dto.CheckinWindowResponse.fields.statusLabel).toBeDefined();
    expect(dto.CheckinWindowResponse.fields.serverTime).toBeDefined();
  });
});
