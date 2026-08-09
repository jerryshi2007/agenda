# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: schedule-create.spec.js >> 2.A Schedule Create — P1 Core Paths >> [TC-CREATE-029] Network error handling — retry scaffold @P1
- Location: specs\schedule-create.spec.js:298:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 405
```

# Test source

```ts
  206 | 
  207 |   test('[TC-CREATE-007] Conflict — choose "Continue Create" @P1', async ({ request }) => {
  208 |     // First create a schedule
  209 |     const seedPayload = afterschoolActivity({
  210 |       name: '篮球课',
  211 |       timeSlots: [{ dayOfWeek: 5, startTime: '14:00:00', endTime: '15:00:00' }],
  212 |     });
  213 |     const seedRes = await createSchedule(request, AUTH.PARENT_A, seedPayload);
  214 |     expect(seedRes.status()).toBe(201);
  215 |     const seedData = await seedRes.json();
  216 |     createdScheduleIds.push(seedData.schedules[0].scheduleId);
  217 | 
  218 |     // Create conflicting schedule with ignoreConflict=true
  219 |     const conflictPayload = afterschoolActivity({
  220 |       name: '足球课',
  221 |       timeSlots: [{ dayOfWeek: 5, startTime: '14:00:00', endTime: '15:00:00' }],
  222 |       ignoreConflict: true,
  223 |     });
  224 |     const res = await createSchedule(request, AUTH.PARENT_A, conflictPayload);
  225 |     expect(res.status()).toBe(201);
  226 | 
  227 |     const body = await res.json();
  228 |     createdScheduleIds.push(body.schedules[0].scheduleId);
  229 |   });
  230 | 
  231 |   test('[TC-CREATE-009] Different child, same time — no conflict @P1', async ({ request }) => {
  232 |     // Seed: create schedule for child1
  233 |     const seedPayload = afterschoolActivity({
  234 |       name: '小明专用课',
  235 |       timeSlots: [{ dayOfWeek: 4, startTime: '10:00:00', endTime: '11:00:00' }],
  236 |     });
  237 |     const seedRes = await createSchedule(request, AUTH.PARENT_A, seedPayload);
  238 |     expect(seedRes.status()).toBe(201);
  239 |     const seedData = await seedRes.json();
  240 |     createdScheduleIds.push(seedData.schedules[0].scheduleId);
  241 | 
  242 |     // Create same time but for child2 — no conflict
  243 |     const payload = afterschoolActivity({
  244 |       name: '小红专用课',
  245 |       childIds: [TEST_USERS.CHILD_2],
  246 |       timeSlots: [{ dayOfWeek: 4, startTime: '10:00:00', endTime: '11:00:00' }],
  247 |     });
  248 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  249 |     expect(res.status()).toBe(201);
  250 |     const body = await res.json();
  251 |     createdScheduleIds.push(body.schedules[0].scheduleId);
  252 |   });
  253 | 
  254 |   test('[TC-CREATE-018] Time slot start > end — block @P1', async ({ request }) => {
  255 |     const payload = afterschoolActivity({
  256 |       timeSlots: [{ dayOfWeek: 2, startTime: '18:00:00', endTime: '16:00:00' }],
  257 |     });
  258 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  259 |     expect(res.status()).toBe(400);
  260 |     const body = await res.json();
  261 |     expect(body.error).toMatch(/TIME_SLOT_INVALID/);
  262 |   });
  263 | 
  264 |   test('[TC-CREATE-020] All 7 days unselected — block @P1', async ({ request }) => {
  265 |     const payload = {
  266 |       name: '空时间日程',
  267 |       scheduleType: 'AfterSchoolActivity',
  268 |       childIds: [TEST_USERS.CHILD_1],
  269 |       timeSlots: [],
  270 |       repeatEndDate: dateOffset(365),
  271 |     };
  272 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  273 |     expect(res.status()).toBe(400);
  274 |     const body = await res.json();
  275 |     expect(body.error).toMatch(/NO_DAY_SELECTED/);
  276 |   });
  277 | 
  278 |   test('[TC-CREATE-021] Only 1 day selected — create successfully @P1', async ({ request }) => {
  279 |     const payload = afterschoolActivity({
  280 |       timeSlots: [{ dayOfWeek: 3, startTime: '10:00:00', endTime: '11:00:00' }],
  281 |     });
  282 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  283 |     expect(res.status()).toBe(201);
  284 |     const body = await res.json();
  285 |     expect(body.schedules[0].timeSlots).toHaveLength(1);
  286 |     createdScheduleIds = body.schedules.map(s => s.scheduleId);
  287 |   });
  288 | 
  289 |   test('[TC-CREATE-025] No repeat end date — infinite repeat @P1', async ({ request }) => {
  290 |     const payload = afterschoolActivity({ repeatEndDate: null });
  291 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  292 |     expect(res.status()).toBe(201);
  293 |     const body = await res.json();
  294 |     expect(body.schedules[0].repeatEndDate).toBeNull();
  295 |     createdScheduleIds = body.schedules.map(s => s.scheduleId);
  296 |   });
  297 | 
  298 |   test('[TC-CREATE-029] Network error handling — retry scaffold @P1', async ({ request }) => {
  299 |     // This tests that the API returns proper error format, not actual network interruption.
  300 |     // Real network interruption is tested manually or via mock in frontend tests.
  301 |     // We test by sending to a non-existent endpoint to verify error handling shape.
  302 |     const res = await request.post('/api/v1/schedules/nonexistent', {
  303 |       headers: { Authorization: AUTH.PARENT_A },
  304 |       data: {},
  305 |     });
> 306 |     expect(res.status()).toBe(404);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  307 |   });
  308 | 
  309 |   test('[TC-CREATE-033] Preview summary — step 4 confirmation info correct @P1', async ({ request }) => {
  310 |     // Frontend test - API only validates that GET returns created data correctly
  311 |     const payload = afterschoolActivity({
  312 |       name: '预览测试课',
  313 |       timeSlots: [{ dayOfWeek: 2, startTime: '16:00:00', endTime: '17:00:00' }],
  314 |       location: '测试地点',
  315 |       notes: '测试备注',
  316 |     });
  317 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  318 |     expect(res.status()).toBe(201);
  319 |     const body = await res.json();
  320 |     const scheduleId = body.schedules[0].scheduleId;
  321 |     createdScheduleIds.push(scheduleId);
  322 | 
  323 |     // Verify GET returns the same data
  324 |     const getRes = await getSchedule(request, AUTH.PARENT_A, scheduleId);
  325 |     expect(getRes.status()).toBe(200);
  326 |     const detail = await getRes.json();
  327 |     expect(detail.name).toBe('预览测试课');
  328 |     expect(detail.location).toBe('测试地点');
  329 |     expect(detail.notes).toBe('测试备注');
  330 |   });
  331 | 
  332 | });
  333 | 
  334 | // ============================================================
  335 | // 2.A Schedule Create — P2 (16 tests)
  336 | // ============================================================
  337 | test.describe('2.A Schedule Create — P2 Boundary & Edge Cases', () => {
  338 | 
  339 |   test('[TC-CREATE-008] Conflict — choose "Back to Edit" @P2', async ({ request }) => {
  340 |     // Seed: create a schedule
  341 |     const seedPayload = afterschoolActivity({
  342 |       name: '编程课',
  343 |       timeSlots: [{ dayOfWeek: 1, startTime: '09:00:00', endTime: '10:00:00' }],
  344 |     });
  345 |     const seedRes = await createSchedule(request, AUTH.PARENT_A, seedPayload);
  346 |     expect(seedRes.status()).toBe(201);
  347 |     const seedData = await seedRes.json();
  348 |     createdScheduleIds.push(seedData.schedules[0].scheduleId);
  349 | 
  350 |     // Conflict check confirms conflict exists
  351 |     const checkPayload = {
  352 |       childId: TEST_USERS.CHILD_1,
  353 |       date: today(),
  354 |       startTime: '09:00:00',
  355 |       endTime: '10:00:00',
  356 |     };
  357 |     const checkRes = await checkConflict(request, AUTH.PARENT_A, checkPayload);
  358 |     expect(checkRes.status()).toBe(200);
  359 |     const checkBody = await checkRes.json();
  360 |     expect(checkBody.hasConflict).toBe(true);
  361 | 
  362 |     // Back to edit = user cancels, no schedule created
  363 |     // Verified by: schedule count does not increase
  364 |   });
  365 | 
  366 |   test('[TC-CREATE-012] Name is whitespace-only — block @P2', async ({ request }) => {
  367 |     const payload = afterschoolActivity({ name: '   ' });
  368 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  369 |     expect(res.status()).toBe(400);
  370 |     const body = await res.json();
  371 |     // FluentValidation's NotEmpty + Must(!IsNullOrWhiteSpace) catches this
  372 |     expect(body.error).toMatch(/SCHEDULE_NAME_EMPTY/);
  373 |   });
  374 | 
  375 |   test('[TC-CREATE-013] Name exactly 50 chars — success @P2', async ({ request }) => {
  376 |     const name50 = '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十';
  377 |     const payload = afterschoolActivity({ name: name50 });
  378 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  379 |     expect(res.status()).toBe(201);
  380 |     const body = await res.json();
  381 |     expect(body.schedules[0].name).toBe(name50);
  382 |     createdScheduleIds = body.schedules.map(s => s.scheduleId);
  383 |   });
  384 | 
  385 |   test('[TC-CREATE-014] Name > 50 chars — block @P2', async ({ request }) => {
  386 |     const payload = afterschoolActivity({ name: 'A'.repeat(51) });
  387 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  388 |     expect(res.status()).toBe(400);
  389 |     const body = await res.json();
  390 |     expect(body.error).toMatch(/SCHEDULE_NAME_TOO_LONG/);
  391 |   });
  392 | 
  393 |   test('[TC-CREATE-015] Notes exactly 500 chars — success @P2', async ({ request }) => {
  394 |     const payload = afterschoolActivity({ notes: 'A'.repeat(500) });
  395 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  396 |     expect(res.status()).toBe(201);
  397 |     const body = await res.json();
  398 |     expect(body.schedules[0].notes.length).toBe(500);
  399 |     createdScheduleIds = body.schedules.map(s => s.scheduleId);
  400 |   });
  401 | 
  402 |   test('[TC-CREATE-016] Notes > 500 chars — block @P2', async ({ request }) => {
  403 |     const payload = afterschoolActivity({ notes: 'A'.repeat(501) });
  404 |     const res = await createSchedule(request, AUTH.PARENT_A, payload);
  405 |     expect(res.status()).toBe(400);
  406 |     const body = await res.json();
```