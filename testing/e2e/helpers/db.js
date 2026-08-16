// testing/e2e/helpers/db.js
// Direct PostgreSQL access for auth-module test seed / cleanup / assertion.
//
// Auth tests need DB-level control over User.Status / DeletedAt that the HTTP API cannot
// provide without a working WeChat login (jscode2session has no mock mode yet — see
// test-plan.md §3.3). This helper mirrors the `pg` connection pattern of seed-db.js.
//
// Column names reflect the post-migration schema (AlignUserWithAuthContract):
//   Status (0=Active/1=Deleted), DeletedAt, LastLoginAt — NOT the old IsDeleted/UpdatedAt.

const { Client } = require('pg');
const enums = require('../../../openspec/contracts/auth/enums.json');

const UserStatus = enums.UserStatus.numeric; // Active=0, Deleted=1
const UserRole = enums.UserRole.numeric; // Parent=1, Child=2

const CONNECTION_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
  database: process.env.TEST_DB_NAME || 'agenda_dev',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASS || 'postgres',
};

async function withClient(fn) {
  const client = new Client(CONNECTION_CONFIG);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Upsert an auth test user.
 * @param {{ id: string, openId?: string, nickname?: string, avatarUrl?: string|null,
 *           status?: number, role?: number, deletedAt?: string|null }} user
 *   status: UserStatus.numeric (Active=0 / Deleted=1) — 见 openspec/contracts/auth/enums.json
 *   role:   UserRole.numeric (Parent=1 / Child=2)
 */
async function seedAuthUser(user) {
  return withClient(async (client) => {
    const now = new Date().toISOString();
    const openId = user.openId || `e2e-auth-${user.id}`;
    await client.query(
      `INSERT INTO "Users"
         ("Id", "OpenId", "Nickname", "AvatarUrl", "Role", "Status", "CreatedAt", "LastLoginAt", "DeletedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
       ON CONFLICT ("Id") DO UPDATE SET
         "OpenId" = EXCLUDED."OpenId",
         "Nickname" = EXCLUDED."Nickname",
         "AvatarUrl" = EXCLUDED."AvatarUrl",
         "Status" = EXCLUDED."Status",
         "DeletedAt" = EXCLUDED."DeletedAt"`,
      [
        user.id,
        openId,
        user.nickname ?? '微信用户',
        user.avatarUrl ?? null,
        user.role ?? UserRole.Parent,
        user.status ?? UserStatus.Active,
        now,
        user.deletedAt ?? null,
      ]
    );
  });
}

/**
 * Delete an auth test user (and nothing else — no cascade from Users).
 */
async function cleanupAuthUser(id) {
  return withClient(async (client) => {
    await client.query('DELETE FROM "Users" WHERE "Id" = $1', [id]);
  });
}

/**
 * Read an auth test user's current DB row for state assertions.
 * @returns {Promise<{ id: string, openId: string, nickname: string, avatarUrl: string|null,
 *   status: number, role: number, deletedAt: Date|null, createdAt: Date, lastLoginAt: Date }|null>}
 */
async function getAuthUser(id) {
  return withClient(async (client) => {
    const res = await client.query(
      `SELECT "Id" AS id, "OpenId" AS "openId", "Nickname" AS nickname,
              "AvatarUrl" AS "avatarUrl", "Status" AS status, "Role" AS role,
              "DeletedAt" AS "deletedAt", "CreatedAt" AS "createdAt", "LastLoginAt" AS "lastLoginAt"
       FROM "Users" WHERE "Id" = $1`,
      [id]
    );
    return res.rows[0] || null;
  });
}

module.exports = { seedAuthUser, cleanupAuthUser, getAuthUser };
