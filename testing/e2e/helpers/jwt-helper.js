// testing/e2e/helpers/jwt-helper.js
// Generate JWT tokens for test users (bypass wx.login flow per test assumption A2)
// Key MUST match the backend runtime JWT secret (Gate 0-3 in test-plan.md §5):
//   - Backend resolves Jwt:SecretKey from appsettings.Development.json
//     ("dev-only-insecure-secret-key-for-local-development-change-me"),
//     overridden by env var JWT_SECRET_KEY (Program.cs).
//   - Test side reads JWT_SECRET_KEY first (same var as backend), then JWT_SECRET as fallback,
//     then the Development default — so both sides agree whether the runner sets an env var or not.

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET || 'dev-only-insecure-secret-key-for-local-development-change-me';
const JWT_ISSUER = 'agenda-api';
const JWT_KEY_ID = 'agenda-dev-key-2026';

/**
 * Test user IDs (hardcoded for repeatability — must match seed data)
 */
const TEST_USERS = {
  PARENT_A:  '00000000-0000-0000-0000-000000000001', // parentA
  PARENT_B:  '00000000-0000-0000-0000-000000000002', // parentB
  CHILD_1:   '00000000-0000-0000-0000-000000000010', // 小明
  CHILD_2:   '00000000-0000-0000-0000-000000000011', // 小红
  CHILD_3:   '00000000-0000-0000-0000-000000000012', // 小刚
  OUTSIDER:  '00000000-0000-0000-0000-000000000099', // non-family user
};

// Fixed GUIDs for auth-module tests (2000... range keeps them clear of the schedule 0000.../1000... ranges).
// State (Status/DeletedAt) is seeded directly in the DB by helpers/db.js — see test-plan.md §3.1.
const AUTH_TEST_USERS = {
  PROFILE:          '20000000-0000-0000-0000-000000000001', // active, nickname seeded per-test
  DELETION:         '20000000-0000-0000-0000-000000000002', // active, no family
  RECOVER:          '20000000-0000-0000-0000-000000000003', // Deleted, DeletedAt=now-5d
  RECOVER_EXPIRED:  '20000000-0000-0000-0000-000000000004', // Deleted, DeletedAt=now-31d
  AVATAR:           '20000000-0000-0000-0000-000000000005', // active
  FAMILIES:         '20000000-0000-0000-0000-000000000006', // active
  CROSS:            '20000000-0000-0000-0000-000000000007', // active
  DELETE_IDEMPOTENT:'20000000-0000-0000-0000-000000000008', // Deleted, DeletedAt=now-5d (for idempotent delete)
  NOT_DELETED:      '20000000-0000-0000-0000-000000000009', // active (for recover NOT_DELETED)
};

/**
 * Generate a JWT token for a test user.
 * @param {string} userId - GUID string
 * @param {string} [role='Parent'] - UserRole: 'Parent' | 'Child'
 * @returns {string} JWT token
 */
function generateToken(userId, role = 'Parent') {
  const payload = {
    sub: userId,
    userId: userId,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': userId,
    role: role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    iss: JWT_ISSUER,
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', keyid: JWT_KEY_ID });
}

/**
 * Get an Authorization header value for a test user.
 * @param {string} userId
 * @param {string} [role='Parent']
 * @returns {string} "Bearer <token>"
 */
function authHeader(userId, role = 'Parent') {
  return `Bearer ${generateToken(userId, role)}`;
}

/**
 * Generate an expired token for testing 401 scenarios.
 */
function generateExpiredToken(userId, role = 'Parent') {
  const payload = {
    sub: userId,
    userId: userId,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': userId,
    role: role,
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
    iss: JWT_ISSUER,
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', keyid: JWT_KEY_ID });
}

/**
 * Generate a token with invalid signature for testing 401 scenarios.
 */
function generateInvalidToken(userId) {
  const payload = {
    sub: userId,
    userId: userId,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': userId,
    role: 'Parent',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: JWT_ISSUER,
  };
  return jwt.sign(payload, 'wrong-secret-key-that-does-not-match', { algorithm: 'HS256' });
}

/**
 * Generate a token with an explicit expiry offset, for JWT lifetime boundary tests
 * (TC-CROSS-002 pre-expiry window, TC-CROSS-003 clock-skew tolerance).
 * @param {string} userId - GUID string
 * @param {string} [role='Parent']
 * @param {number} expiresInSeconds - seconds from now; negative = already expired
 * @returns {string} JWT token
 */
function generateTokenWithExpiry(userId, role = 'Parent', expiresInSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    userId: userId,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': userId,
    role: role,
    iat: now,
    exp: now + expiresInSeconds,
    iss: JWT_ISSUER,
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

module.exports = {
  TEST_USERS,
  AUTH_TEST_USERS,
  generateToken,
  authHeader,
  generateExpiredToken,
  generateInvalidToken,
  generateTokenWithExpiry,
};
