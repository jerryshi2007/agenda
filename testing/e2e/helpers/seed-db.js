// testing/e2e/helpers/seed-db.js
// Database seed helper — populates test data before E2E test suite runs
// Uses pg (PostgreSQL client) directly — no dependency on psql CLI
// Usage: node testing/e2e/helpers/seed-db.js

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const CONNECTION_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
  database: process.env.TEST_DB_NAME || 'agenda_dev',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASS || 'postgres',
};

async function seed() {
  console.log('[seed-db] Connecting to PostgreSQL...');
  const client = new Client(CONNECTION_CONFIG);

  try {
    await client.connect();

    // Truncate all schedule-related data for a clean test slate
    await client.query('TRUNCATE TABLE "TimeSlots", "Cancellations", "ScheduleDateExclusions", "Schedules" CASCADE');

    const now = new Date().toISOString();

    // Upsert users
    const users = [
      ['00000000-0000-0000-0000-000000000001', 'ParentA', '', 'Parent', 'openid-parent-a'],
      ['00000000-0000-0000-0000-000000000002', 'ParentB', '', 'Parent', 'openid-parent-b'],
      ['00000000-0000-0000-0000-000000000010', 'XiaoMing', '', 'Child', 'openid-child-1'],
      ['00000000-0000-0000-0000-000000000011', 'XiaoHong', '', 'Child', 'openid-child-2'],
      ['00000000-0000-0000-0000-000000000012', 'XiaoGang', '', 'Child', 'openid-child-3'],
      ['00000000-0000-0000-0000-000000000099', 'Outsider', '', 'Parent', 'openid-outsider'],
    ];

    for (const [id, nickname, avatar, roleStr, openId] of users) {
      const role = roleStr === 'Parent' ? 1 : 2;
      // Post-migration schema (AlignUserWithAuthContract): Status/DeletedAt/LastLoginAt
      // replaced the old IsDeleted/UpdatedAt columns.
      await client.query(
        `INSERT INTO "Users" ("Id", "Nickname", "AvatarUrl", "Role", "OpenId", "Status", "CreatedAt", "LastLoginAt")
         VALUES ($1, $2, $3, $4, $5, 0, $6, $6)
         ON CONFLICT ("Id") DO UPDATE SET "Nickname" = $2, "Status" = 0`,
        [id, nickname, avatar, role, openId, now]
      );
    }

    // Upsert families
    await client.query(
      `INSERT INTO "Families" ("Id", "Name", "CreatedAt")
       VALUES ($1, $2, $3)
       ON CONFLICT ("Id") DO NOTHING`,
      ['00000000-0000-0000-0000-100000000001', 'TestFamily1', now]
    );
    await client.query(
      `INSERT INTO "Families" ("Id", "Name", "CreatedAt")
       VALUES ($1, $2, $3)
       ON CONFLICT ("Id") DO NOTHING`,
      ['00000000-0000-0000-0000-100000000002', 'TestFamily2', now]
    );

    // Upsert family members
    const members = [
      ['00000000-0000-0000-0000-100000000001', '00000000-0000-0000-0000-000000000001', 'Parent'],
      ['00000000-0000-0000-0000-100000000001', '00000000-0000-0000-0000-000000000002', 'Parent'],
      ['00000000-0000-0000-0000-100000000001', '00000000-0000-0000-0000-000000000010', 'Child'],
      ['00000000-0000-0000-0000-100000000001', '00000000-0000-0000-0000-000000000011', 'Child'],
      ['00000000-0000-0000-0000-100000000001', '00000000-0000-0000-0000-000000000012', 'Child'],
      ['00000000-0000-0000-0000-100000000002', '00000000-0000-0000-0000-000000000099', 'Parent'],
    ];

    for (const [familyId, userId, roleStr] of members) {
      const role = roleStr === 'Parent' ? 1 : 2;
      // Check for existing
      const exists = await client.query(
        `SELECT "Id" FROM "FamilyMembers" WHERE "FamilyId" = $1 AND "UserId" = $2`,
        [familyId, userId]
      );
      if (exists.rows.length === 0) {
        await client.query(
          `INSERT INTO "FamilyMembers" ("Id", "FamilyId", "UserId", "Role", "JoinedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
          [familyId, userId, role, now]
        );
      }
    }

    console.log('[seed-db] Seed data inserted successfully.');
    console.log(`[seed-db]   Users: ${users.length}`);
    console.log(`[seed-db]   Families: 2`);
    console.log(`[seed-db]   FamilyMembers: ${members.length}`);
  } catch (err) {
    console.error('[seed-db] Failed to seed database:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

// Run if executed directly
if (require.main === module) {
  seed().catch(() => process.exit(1));
}

module.exports = { seed };
