// testing/e2e/helpers/checkin-db.js
// Direct PostgreSQL access for checkin-module test seed / cleanup / assertion.
// Mirrors helpers/db.js (auth) pg pattern (test-plan.md §3.3).
//
// Used for DB states the HTTP API cannot create:
//   - 作业任务过去 dueDate（Schedule API 拒 DUE_DATE_INVALID → FIX_HOMEWORK_YESTERDAY / SET-001 作业分支）
//   - 昨天打卡记录 / 昨天结算记录 / streak 初值（结算任务只处理「北京时间昨天」）
//   - SET-005 撤销 vs 结算竞态（模拟 23:59:50 撤销后的最终状态）
//
// 列名经 codegraph 核对 EF Core Configuration（test-plan.md §6.1 R6 / G0-7）：
//   CheckinConfiguration           → CheckinRecords(Id, ScheduleId, Date, UserId, CheckinAt, Source, CreatedAt)
//   CheckinSettlementConfiguration → CheckinSettlements(Id, ScheduleId, Date, Status, SettledAt)
//   StreakConfiguration            → Streaks(Id, Scope, SubjectId, CurrentStreak, LastSettledDate, UpdatedAt)
//   ScheduleConfiguration          → Schedules(… RowVersion bytea NOT NULL …)

const { Client } = require('pg');
const crypto = require('crypto');
const checkinEnums = require('../../../openspec/contracts/checkin/enums.json');

// 契约枚举 numeric（enums.json CheckinSource / StreakScope）。
const CheckinSource = checkinEnums.CheckinSource.numeric; // Parent=1, Child=2
const StreakScope = checkinEnums.StreakScope.numeric; // Schedule=1, Child=2

// ScheduleType / ScheduleStatus 无独立 contracts（schedule domain 未建 contracts 目录）。
// 数值以 api/Domain/Enums/{ScheduleType,ScheduleStatus}.cs 为真相源（test-plan.md §2.D 亦标注）：
//   ScheduleType: AfterSchoolActivity=1, DailyRoutine=2, HomeworkTask=3
//   ScheduleStatus: Incomplete=1, Completed=2, Cancelled=3, Ended=4, Overdue=5
const ScheduleType = { AfterSchoolActivity: 1, DailyRoutine: 2, HomeworkTask: 3 };
const ScheduleStatus = { Incomplete: 1, Completed: 2, Cancelled: 3, Ended: 4, Overdue: 5 };

// 与 seed-db.js 一致的家庭/用户 GUID（PARENT_A 属 Family1，CHILD_1 被分配为其孩子）。
const TEST_IDS = {
  FAMILY_1: '00000000-0000-0000-0000-100000000001',
  FAMILY_2: '00000000-0000-0000-0000-100000000002',
  PARENT_A: '00000000-0000-0000-0000-000000000001',
  CHILD_1: '00000000-0000-0000-0000-000000000010',
};

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

// ---- CheckinRecords ----

/**
 * Upsert 一条打卡记录（幂等，模拟「昨天已打卡」或「今天已打卡」的 DB 状态）。
 * @param {{ scheduleId: string, date: string, userId?: string, source?: 'Parent'|'Child', checkinAt?: string }} params
 */
async function insertCheckin({ scheduleId, date, userId = TEST_IDS.CHILD_1, source = 'Child', checkinAt }) {
  return withClient(async (client) => {
    const now = checkinAt || new Date().toISOString();
    await client.query(
      `INSERT INTO "CheckinRecords" ("ScheduleId", "Date", "UserId", "CheckinAt", "Source", "CreatedAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("ScheduleId", "Date") DO UPDATE SET
         "UserId" = EXCLUDED."UserId",
         "CheckinAt" = EXCLUDED."CheckinAt",
         "Source" = EXCLUDED."Source"`,
      [scheduleId, date, userId, now, CheckinSource[source], now]
    );
  });
}

async function deleteCheckin(scheduleId, date) {
  return withClient(async (client) => {
    await client.query('DELETE FROM "CheckinRecords" WHERE "ScheduleId" = $1 AND "Date" = $2', [
      scheduleId,
      date,
    ]);
  });
}

/**
 * 读取某实例打卡记录（断言用）。
 * @returns {Promise<{ id: string, scheduleId: string, date: string, userId: string, source: number }|null>}
 */
async function getCheckin(scheduleId, date) {
  return withClient(async (client) => {
    const res = await client.query(
      `SELECT "Id" AS id, "ScheduleId" AS "scheduleId", "Date" AS date,
              "UserId" AS "userId", "Source" AS source
       FROM "CheckinRecords" WHERE "ScheduleId" = $1 AND "Date" = $2`,
      [scheduleId, date]
    );
    return res.rows[0] || null;
  });
}

async function countCheckins(scheduleId, date) {
  return withClient(async (client) => {
    const res = await client.query(
      `SELECT COUNT(*)::int AS count FROM "CheckinRecords" WHERE "ScheduleId" = $1 AND "Date" = $2`,
      [scheduleId, date]
    );
    return res.rows[0].count;
  });
}

// ---- CheckinSettlements ----

/**
 * Upsert 一条结算记录（终态锚点，模拟「已结算」）。
 * @param {{ scheduleId: string, date: string, status: number }} params - status 为 ScheduleStatus numeric
 */
async function insertSettlement({ scheduleId, date, status }) {
  return withClient(async (client) => {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO "CheckinSettlements" ("ScheduleId", "Date", "Status", "SettledAt")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("ScheduleId", "Date") DO UPDATE SET
         "Status" = EXCLUDED."Status",
         "SettledAt" = EXCLUDED."SettledAt"`,
      [scheduleId, date, status, now]
    );
  });
}

async function deleteSettlement(scheduleId, date) {
  return withClient(async (client) => {
    await client.query('DELETE FROM "CheckinSettlements" WHERE "ScheduleId" = $1 AND "Date" = $2', [
      scheduleId,
      date,
    ]);
  });
}

async function getSettlement(scheduleId, date) {
  return withClient(async (client) => {
    const res = await client.query(
      `SELECT "Id" AS id, "ScheduleId" AS "scheduleId", "Date" AS date, "Status" AS status
       FROM "CheckinSettlements" WHERE "ScheduleId" = $1 AND "Date" = $2`,
      [scheduleId, date]
    );
    return res.rows[0] || null;
  });
}

async function countSettlements(scheduleId) {
  return withClient(async (client) => {
    const res = await client.query(
      `SELECT COUNT(*)::int AS count FROM "CheckinSettlements" WHERE "ScheduleId" = $1`,
      [scheduleId]
    );
    return res.rows[0].count;
  });
}

// ---- Streaks ----

/**
 * Upsert 一条 streak 记录（初值锚点）。
 * @param {{ scope: number, subjectId: string, currentStreak: number, lastSettledDate?: string|null }} params
 */
async function insertStreak({ scope, subjectId, currentStreak, lastSettledDate = null }) {
  return withClient(async (client) => {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO "Streaks" ("Scope", "SubjectId", "CurrentStreak", "LastSettledDate", "UpdatedAt")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("Scope", "SubjectId") DO UPDATE SET
         "CurrentStreak" = EXCLUDED."CurrentStreak",
         "LastSettledDate" = EXCLUDED."LastSettledDate",
         "UpdatedAt" = EXCLUDED."UpdatedAt"`,
      [scope, subjectId, currentStreak, lastSettledDate, now]
    );
  });
}

async function deleteStreak(scope, subjectId) {
  return withClient(async (client) => {
    await client.query('DELETE FROM "Streaks" WHERE "Scope" = $1 AND "SubjectId" = $2', [
      scope,
      subjectId,
    ]);
  });
}

async function getStreak(scope, subjectId) {
  return withClient(async (client) => {
    const res = await client.query(
      `SELECT "Scope" AS scope, "SubjectId" AS "subjectId", "CurrentStreak" AS "currentStreak",
              "LastSettledDate" AS "lastSettledDate"
       FROM "Streaks" WHERE "Scope" = $1 AND "SubjectId" = $2`,
      [scope, subjectId]
    );
    return res.rows[0] || null;
  });
}

// ---- Schedules（仅 DB-SEED 作业任务需要）----

/**
 * 插入一条过去 dueDate 的作业任务（Schedule API 会拒 DUE_DATE_INVALID）。
 * RowVersion 为 bytea NOT NULL，按 ScheduleService.CreateAsync 的写法用 16 字节随机值。
 * @param {{ id: string, name: string, dueDate: string, familyId?: string,
 *           assignedChildId?: string, createdBy?: string,
 *           suggestedStartTime?: string|null, suggestedEndTime?: string|null }} params
 */
async function insertHomeworkSchedule({
  id,
  name,
  dueDate,
  familyId = TEST_IDS.FAMILY_1,
  assignedChildId = TEST_IDS.CHILD_1,
  createdBy = TEST_IDS.PARENT_A,
  suggestedStartTime = null,
  suggestedEndTime = null,
}) {
  return withClient(async (client) => {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO "Schedules"
         ("Id", "Name", "ScheduleType", "FamilyId", "AssignedChildId", "CreatedBy", "GroupKey",
          "RepeatEndDate", "Notes", "Location", "DueDate", "SuggestedStartTime", "SuggestedEndTime",
          "SourceScheduleId", "OverrideDate", "RowVersion", "IsDeleted", "CreatedAt", "UpdatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, NULL, $8, $9, $10, NULL, NULL, $11, false, $12, $12)`,
      [
        id,
        name,
        ScheduleType.HomeworkTask,
        familyId,
        assignedChildId,
        createdBy,
        crypto.randomUUID(),
        dueDate,
        suggestedStartTime,
        suggestedEndTime,
        crypto.randomBytes(16),
        now,
      ]
    );
    return id;
  });
}

async function deleteSchedule(scheduleId) {
  return withClient(async (client) => {
    await client.query('DELETE FROM "Schedules" WHERE "Id" = $1', [scheduleId]);
  });
}

// ---- 批量清理 ----

/**
 * 清理某个日程关联的 checkin / settlement / streak 数据（CheckinRecords 等无外键级联，
 * 需显式删除）。用于非结算 spec 的 afterEach 对称清理。
 * @param {string} scheduleId
 */
async function cleanupCheckinSchedule(scheduleId) {
  return withClient(async (client) => {
    await client.query('DELETE FROM "CheckinRecords" WHERE "ScheduleId" = $1', [scheduleId]);
    await client.query('DELETE FROM "CheckinSettlements" WHERE "ScheduleId" = $1', [scheduleId]);
    await client.query('DELETE FROM "Streaks" WHERE "Scope" = $1 AND "SubjectId" = $2', [
      StreakScope.Schedule,
      scheduleId,
    ]);
  });
}

/**
 * 清空 checkin 三张表（结算 spec 串行执行前/每用例前的干净起点，保证 streak 断言确定性）。
 */
async function truncateCheckinTables() {
  return withClient(async (client) => {
    await client.query('TRUNCATE TABLE "CheckinRecords", "CheckinSettlements", "Streaks"');
  });
}

module.exports = {
  CONNECTION_CONFIG,
  TEST_IDS,
  CheckinSource,
  StreakScope,
  ScheduleType,
  ScheduleStatus,
  insertCheckin,
  deleteCheckin,
  getCheckin,
  countCheckins,
  insertSettlement,
  deleteSettlement,
  getSettlement,
  countSettlements,
  insertStreak,
  deleteStreak,
  getStreak,
  insertHomeworkSchedule,
  deleteSchedule,
  cleanupCheckinSchedule,
  truncateCheckinTables,
};
