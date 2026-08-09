// testing/e2e/helpers/jwt-helper.js
// Generate JWT tokens for test users (bypass wx.login flow per test assumption A2)
// Key must match api/appsettings.json Jwt:Key

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'AgendaDevKey-2026-ProductionSecret-MustBeAtLeast64BytesLong!!';
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

module.exports = {
  TEST_USERS,
  generateToken,
  authHeader,
  generateExpiredToken,
  generateInvalidToken,
};
