// testing/e2e/helpers/contracts.js
// Single source for auth + checkin contract consumption (dev-contracts rule + test-plan.md §3.4).
// Test code MUST reference these instead of hardcoding error-code strings, HTTP statuses,
// Chinese messages, or enum/status values.

const { expect } = require('@playwright/test');
const errors = require('../../../openspec/contracts/auth/errors.json');
const enums = require('../../../openspec/contracts/auth/enums.json');
const checkinErrors = require('../../../openspec/contracts/checkin/errors.json');
const checkinEnums = require('../../../openspec/contracts/checkin/enums.json');
const checkinDto = require('../../../openspec/contracts/checkin/dto.json');

/**
 * Derive a frozen `{ VALUE: 'VALUE' }` map from a contract enum `values` array so specs can
 * reference `CheckinStatus.incomplete` instead of a hardcoded `'incomplete'` literal.
 * @param {string[]} values
 */
function freezeEnum(values) {
  return Object.freeze(Object.fromEntries(values.map((v) => [v, v])));
}

// checkin 枚举（enums.json CheckinStatus / CheckinSource / StreakScope）。
const CheckinStatus = freezeEnum(checkinEnums.CheckinStatus.values);
const CheckinSource = freezeEnum(checkinEnums.CheckinSource.values);
const StreakScope = freezeEnum(checkinEnums.StreakScope.values);

/**
 * Resolve the error-code key ("CODE_INVALID") for a contract entry object,
 * avoiding a hardcoded string literal in test code.
 * Falls back to matching by (httpStatus, message) so a deep-copied entry still resolves.
 * @param {{ httpStatus: number, message: string }} codeObj - entry from errors.json
 * @param {Record<string, { httpStatus: number, message: string }>} [errorsObj] - contract errors object
 * @returns {string}
 */
function errorKey(codeObj, errorsObj = errors) {
  return (
    Object.keys(errorsObj).find((k) => errorsObj[k] === codeObj) ??
    Object.keys(errorsObj).find(
      (k) => errorsObj[k].httpStatus === codeObj.httpStatus && errorsObj[k].message === codeObj.message
    )
  );
}

/**
 * Assert a response matches the unified error envelope for a contract error code.
 * @param {import('@playwright/test').APIResponse} res
 * @param {{ httpStatus: number, message: string }} codeObj - entry from errors.json
 * @param {Record<string, { httpStatus: number, message: string }>} [errorsObj] - contract errors object
 * @returns {Promise<{ error: string, message: string, traceId?: string|null }>}
 */
async function assertError(res, codeObj, errorsObj = errors) {
  expect(res.status()).toBe(codeObj.httpStatus);
  const body = await res.json();
  expect(body.error).toBe(errorKey(codeObj, errorsObj));
  expect(body.message).toBe(codeObj.message);
  return body;
}

module.exports = {
  errors,
  enums,
  checkinErrors,
  checkinEnums,
  checkinDto,
  CheckinStatus,
  CheckinSource,
  StreakScope,
  errorKey,
  assertError,
};
