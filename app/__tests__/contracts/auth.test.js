// app/__tests__/contracts/auth.test.js
// 契约 parity 测试 —— 锁定 app/contracts/auth.js 与 openspec/contracts/auth/*.json 一致

const path = require('path');
const contracts = require('../../contracts/auth');

const enums = require(path.resolve(__dirname, '../../../openspec/contracts/auth/enums.json'));
const errors = require(path.resolve(__dirname, '../../../openspec/contracts/auth/errors.json'));
const dto = require(path.resolve(__dirname, '../../../openspec/contracts/auth/dto.json'));

describe('认证契约镜像与 openspec/contracts/auth 一致性', () => {
  test('UserStatus 枚举值与 enums.json 完全一致', () => {
    expect(Object.values(contracts.UserStatus).sort())
      .toEqual([...enums.UserStatus.values].sort());
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

  test('dto.json 存在且包含 LoginResponse 契约字段', () => {
    expect(dto.LoginResponse.fields.jwt).toBeDefined();
    expect(dto.LoginResponse.fields.userId).toBeDefined();
    expect(dto.LoginResponse.fields.isNewUser).toBeDefined();
    expect(dto.LoginResponse.fields.needsProfileCollection).toBeDefined();
  });
});
