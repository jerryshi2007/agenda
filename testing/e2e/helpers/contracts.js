// testing/e2e/helpers/contracts.js
// Single source for auth contract consumption (dev-contracts rule + test-plan.md §3.4).
// Test code MUST reference these instead of hardcoding error-code strings, HTTP statuses,
// or Chinese messages.

const { expect } = require('@playwright/test');
const errors = require('../../../openspec/contracts/auth/errors.json');
const enums = require('../../../openspec/contracts/auth/enums.json');

/**
 * Resolve the error-code key ("CODE_INVALID") for a contract entry object,
 * avoiding a hardcoded string literal in test code.
 * Falls back to matching by (httpStatus, message) so a deep-copied entry still resolves.
 * @param {{ httpStatus: number, message: string }} codeObj - entry from errors.json
 * @returns {string}
 */
function errorKey(codeObj) {
  return (
    Object.keys(errors).find((k) => errors[k] === codeObj) ??
    Object.keys(errors).find(
      (k) => errors[k].httpStatus === codeObj.httpStatus && errors[k].message === codeObj.message
    )
  );
}

/**
 * Assert a response matches the unified error envelope for a contract error code.
 * @param {import('@playwright/test').APIResponse} res
 * @param {{ httpStatus: number, message: string }} codeObj - entry from errors.json
 * @returns {Promise<{ error: string, message: string, traceId?: string|null }>}
 */
async function assertError(res, codeObj) {
  expect(res.status()).toBe(codeObj.httpStatus);
  const body = await res.json();
  expect(body.error).toBe(errorKey(codeObj));
  expect(body.message).toBe(codeObj.message);
  return body;
}

module.exports = { errors, enums, errorKey, assertError };
