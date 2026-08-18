// app/__tests__/contracts/family.test.js
// 契约 parity 测试 —— 锁定 app/contracts/family.js 与 openspec/contracts/family/*.json 一致

const path = require('path');
const contracts = require('../../contracts/family');

const enums = require(path.resolve(__dirname, '../../../openspec/contracts/family/enums.json'));
const errors = require(path.resolve(__dirname, '../../../openspec/contracts/family/errors.json'));
const dto = require(path.resolve(__dirname, '../../../openspec/contracts/family/dto.json'));

describe('家庭管理契约镜像与 openspec/contracts/family 一致性', () => {
  test('DisplayMode 枚举值与 enums.json 完全一致', () => {
    expect(Object.values(contracts.DisplayMode).sort())
      .toEqual([...enums.DisplayMode.values].sort());
  });

  test('FamilyStatus 枚举值与 enums.json 完全一致', () => {
    expect(Object.values(contracts.FamilyStatus).sort())
      .toEqual([...enums.FamilyStatus.values].sort());
  });

  test('InvitationCodeStatus 枚举值与 enums.json 完全一致', () => {
    expect(Object.values(contracts.InvitationCodeStatus).sort())
      .toEqual([...enums.InvitationCodeStatus.values].sort());
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

  test('FamilyInfo 契约字段完整', () => {
    expect(dto.FamilyInfo.fields.familyId).toBeDefined();
    expect(dto.FamilyInfo.fields.familyName).toBeDefined();
    expect(dto.FamilyInfo.fields.role).toBeDefined();
    expect(dto.FamilyInfo.fields.memberCount).toBeDefined();
    expect(dto.FamilyInfo.fields.lastActiveAt).toBeDefined();
  });

  test('InvitationCodeInfo 契约字段完整', () => {
    expect(dto.InvitationCodeInfo.fields.id).toBeDefined();
    expect(dto.InvitationCodeInfo.fields.code).toBeDefined();
    expect(dto.InvitationCodeInfo.fields.status).toBeDefined();
    expect(dto.InvitationCodeInfo.fields.canRevoke).toBeDefined();
    expect(dto.InvitationCodeInfo.fields.expiresAt).toBeDefined();
  });

  test('GetMembersResponse 契约字段完整', () => {
    expect(dto.GetMembersResponse.fields.familyName).toBeDefined();
    expect(dto.GetMembersResponse.fields.creatorId).toBeDefined();
    expect(dto.GetMembersResponse.fields.parents).toBeDefined();
    expect(dto.GetMembersResponse.fields.children).toBeDefined();
    expect(dto.GetMembersResponse.fields.activeMemberCount).toBeDefined();
    expect(dto.GetMembersResponse.fields.maxMemberCount).toBeDefined();
  });
});
