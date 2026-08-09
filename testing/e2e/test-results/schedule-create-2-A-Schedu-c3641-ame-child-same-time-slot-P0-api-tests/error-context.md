# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: schedule-create.spec.js >> 2.A Schedule Create — P0 Core Flow >> [TC-CREATE-006] Conflict detection — same child, same time slot @P0
- Location: specs\schedule-create.spec.js:91:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 409
Received: 201
```

# Test source

```ts
  9   |   deleteSchedule,
  10  |   checkConflict,
  11  |   healthCheck,
  12  | } = require('../helpers/api-client');
  13  | const {
  14  |   afterschoolActivity,
  15  |   dailyRoutine,
  16  |   homeworkTask,
  17  |   today,
  18  |   dateOffset,
  19  |   AUTH,
  20  |   TEST_USERS,
  21  | } = require('../helpers/data-factory');
  22  | const { generateToken, generateExpiredToken, generateInvalidToken } = require('../helpers/jwt-helper');
  23  | const { seedSchedule, cleanupSchedule } = require('../fixtures/seed-data');
  24  | 
  25  | // Track created schedules for cleanup
  26  | let createdScheduleIds = [];
  27  | 
  28  | test.beforeAll(async ({ request }) => {
  29  |   // Verify API is reachable
  30  |   const hc = await healthCheck(request);
  31  |   if (hc.status() !== 200) {
  32  |     console.warn('[WARN] API health check failed — some tests may fail if API is not running');
  33  |   }
  34  | });
  35  | 
  36  | test.afterEach(async ({ request }) => {
  37  |   // Clean up schedules created during the test
  38  |   for (const id of createdScheduleIds) {
  39  |     await cleanupSchedule(request, AUTH.PARENT_A, id);
  40  |   }
  41  |   createdScheduleIds = [];
  42  | });
  43  | 
  44  | // ============================================================
  45  | // 2.A Schedule Create — P0 (5 tests)
  46  | // ============================================================
  47  | test.describe('2.A Schedule Create — P0 Core Flow', () => {
  48  | 
  49  |   test('[TC-CREATE-001] Create AfterSchoolActivity (single child) @P0', async ({ request }) => {
  50  |     const payload = afterschoolActivity({
  51  |       name: '钢琴课',
  52  |       timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
  53  |       location: '琴行教室A',
  54  |       notes: '带琴谱',
  55  |     });
  56  |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  57  |     expect(res.status()).toBe(201);
  58  | 
  59  |     const body = await res.json();
  60  |     expect(body).toHaveProperty('groupKey');
  61  |     expect(body.schedules).toHaveLength(1);
  62  |     expect(body.schedules[0].name).toBe('钢琴课');
  63  |     expect(body.schedules[0].scheduleType).toBe('AfterSchoolActivity');
  64  |     expect(body.schedules[0].assignedChildId).toBe(TEST_USERS.CHILD_1);
  65  |     expect(body.schedules[0].timeSlots).toHaveLength(1);
  66  | 
  67  |     createdScheduleIds = body.schedules.map(s => s.scheduleId);
  68  |   });
  69  | 
  70  |   test('[TC-CREATE-002] Create AfterSchoolActivity (multi-child, N records) @P0', async ({ request }) => {
  71  |     const payload = afterschoolActivity({
  72  |       name: '游泳课-多孩子',
  73  |       childIds: [TEST_USERS.CHILD_1, TEST_USERS.CHILD_2],
  74  |       timeSlots: [{ dayOfWeek: 3, startTime: '15:00:00', endTime: '16:00:00' }],
  75  |     });
  76  |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  77  |     expect(res.status()).toBe(201);
  78  | 
  79  |     const body = await res.json();
  80  |     expect(body.schedules).toHaveLength(2);
  81  |     // Both schedules share the same GroupKey
  82  |     expect(body.schedules[0].groupKey).toBe(body.schedules[1].groupKey);
  83  |     // Each assigned to a different child
  84  |     const childIds = body.schedules.map(s => s.assignedChildId);
  85  |     expect(childIds).toContain(TEST_USERS.CHILD_1);
  86  |     expect(childIds).toContain(TEST_USERS.CHILD_2);
  87  | 
  88  |     createdScheduleIds = body.schedules.map(s => s.scheduleId);
  89  |   });
  90  | 
  91  |   test('[TC-CREATE-006] Conflict detection — same child, same time slot @P0', async ({ request }) => {
  92  |     // Seed: create piano lesson first
  93  |     const seedPayload = afterschoolActivity({
  94  |       name: '钢琴课-冲突测试',
  95  |       timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
  96  |     });
  97  |     const seedRes = await createSchedule(request, AUTH.PARENT_A, seedPayload);
  98  |     expect(seedRes.status()).toBe(201);
  99  |     const seedData = await seedRes.json();
  100 |     const seedId = seedData.schedules[0].scheduleId;
  101 |     createdScheduleIds.push(seedId);
  102 | 
  103 |     // Try to create overlapping schedule with ignoreConflict=false (default)
  104 |     const conflictPayload = afterschoolActivity({
  105 |       name: '英语课-冲突',
  106 |       timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
  107 |     });
  108 |     const res = await createSchedule(request, AUTH.PARENT_A, conflictPayload);
> 109 |     expect(res.status()).toBe(409);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  110 |     const body = await res.json();
  111 |     expect(body.hasConflict).toBe(true);
  112 |     expect(body.conflicts).toBeDefined();
  113 |     expect(body.conflicts.length).toBeGreaterThan(0);
  114 |   });
  115 | 
  116 |   test('[TC-CREATE-010] No child selected — block submission @P0', async ({ request }) => {
  117 |     const payload = {
  118 |       name: '测试日程',
  119 |       scheduleType: 'AfterSchoolActivity',
  120 |       childIds: [],
  121 |       timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
  122 |     };
  123 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  124 |     expect(res.status()).toBe(400);
  125 |     const body = await res.json();
  126 |     expect(body.error).toMatch(/CHILD_NOT_SELECTED/);
  127 |   });
  128 | 
  129 |   test('[TC-CREATE-011] Empty name — block submission @P0', async ({ request }) => {
  130 |     const payload = afterschoolActivity({ name: '' });
  131 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  132 |     expect(res.status()).toBe(400);
  133 |     const body = await res.json();
  134 |     expect(body.error).toMatch(/SCHEDULE_NAME_EMPTY/);
  135 |   });
  136 | 
  137 | });
  138 | 
  139 | // ============================================================
  140 | // 2.A Schedule Create — P1 (11 tests)
  141 | // ============================================================
  142 | test.describe('2.A Schedule Create — P1 Core Paths', () => {
  143 | 
  144 |   test('[TC-CREATE-003] Create DailyRoutine with per-day tuning @P1', async ({ request }) => {
  145 |     const payload = dailyRoutine({
  146 |       name: '练琴-逐天微调',
  147 |       timeSlots: [
  148 |         { dayOfWeek: 1, startTime: '16:00:00', endTime: '16:30:00' },
  149 |         { dayOfWeek: 2, startTime: '16:00:00', endTime: '16:30:00' },
  150 |         { dayOfWeek: 3, startTime: '17:00:00', endTime: '17:30:00' }, // 周三微调
  151 |         { dayOfWeek: 4, startTime: '16:00:00', endTime: '16:30:00' },
  152 |         { dayOfWeek: 5, startTime: '16:00:00', endTime: '16:30:00' },
  153 |       ],
  154 |     });
  155 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  156 |     expect(res.status()).toBe(201);
  157 | 
  158 |     const body = await res.json();
  159 |     expect(body.schedules).toHaveLength(1);
  160 |     const timeSlots = body.schedules[0].timeSlots;
  161 |     expect(timeSlots).toHaveLength(5);
  162 |     // Verify Wednesday has different time
  163 |     const wedSlot = timeSlots.find(s => s.dayOfWeek === 3);
  164 |     expect(wedSlot.startTime).toBe('17:00:00');
  165 |     expect(wedSlot.endTime).toBe('17:30:00');
  166 |     // Other days have default time
  167 |     const monSlot = timeSlots.find(s => s.dayOfWeek === 1);
  168 |     expect(monSlot.startTime).toBe('16:00:00');
  169 | 
  170 |     createdScheduleIds = body.schedules.map(s => s.scheduleId);
  171 |   });
  172 | 
  173 |   test('[TC-CREATE-004] Create HomeworkTask with due date + suggested time @P1', async ({ request }) => {
  174 |     const payload = homeworkTask({
  175 |       name: '数学练习册 P32-35',
  176 |       dueDate: dateOffset(7),
  177 |       suggestedStartTime: '15:00:00',
  178 |       suggestedEndTime: '16:00:00',
  179 |     });
  180 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  181 |     expect(res.status()).toBe(201);
  182 | 
  183 |     const body = await res.json();
  184 |     expect(body.schedules[0].scheduleType).toBe('HomeworkTask');
  185 |     expect(body.schedules[0].timeSlots).toHaveLength(0);
  186 | 
  187 |     createdScheduleIds = body.schedules.map(s => s.scheduleId);
  188 |   });
  189 | 
  190 |   test('[TC-CREATE-005] Create HomeworkTask (required fields only) @P1', async ({ request }) => {
  191 |     const payload = homeworkTask({
  192 |       name: '背诵课文',
  193 |       dueDate: dateOffset(7),
  194 |       suggestedStartTime: null,
  195 |       suggestedEndTime: null,
  196 |       notes: null,
  197 |     });
  198 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  199 |     expect(res.status()).toBe(201);
  200 | 
  201 |     const body = await res.json();
  202 |     expect(body.schedules[0].name).toBe('背诵课文');
  203 | 
  204 |     createdScheduleIds = body.schedules.map(s => s.scheduleId);
  205 |   });
  206 | 
  207 |   test('[TC-CREATE-007] Conflict — choose "Continue Create" @P1', async ({ request }) => {
  208 |     // First create a schedule
  209 |     const seedPayload = afterschoolActivity({
```