// app/__tests__/services/child-schedule.test.js
// 孩子端日程查询服务 API 封装测试
//
// 覆盖：5 个端点的 URL/method 映射、不显式设置 skipFamilyHeader
//       （X-Family-Id Header 由 services/api.js 统一从 CURRENT_FAMILY_ID 注入）
//       错误码透传（CHILD_ACCESS_DENIED 等）

jest.mock('../../services/api');

const api = require('../../services/api');
const childSchedule = require('../../services/child-schedule');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('child-schedule 服务（孩子端日程查询 API 封装）', () => {
  describe('getTodayList - GET /api/v1/child/schedule/today', () => {
    test('URL 正确，不显式设置 skipFamilyHeader（api.js 自动注入 X-Family-Id）', async () => {
      api.get.mockResolvedValue({ data: { items: [], completedCount: 0, totalCount: 0, completionPercentage: 0 } });
      await childSchedule.getTodayList();
      const call = api.get.mock.calls[0];
      expect(call[0]).toBe('/api/v1/child/schedule/today');
      // 第三个参数 options 应不显式设置 skipFamilyHeader:true
      const opts = call[2];
      expect(!opts || opts.skipFamilyHeader !== true).toBe(true);
    });

    test('支持可选 date 参数透传', async () => {
      api.get.mockResolvedValue({ data: { items: [], completedCount: 0, totalCount: 0, completionPercentage: 0 } });
      await childSchedule.getTodayList('2026-08-18');
      const call = api.get.mock.calls[0];
      expect(call[0]).toBe('/api/v1/child/schedule/today');
      expect(call[1]).toEqual({ date: '2026-08-18' });
    });

    test('返回 data 字段（ChildScheduleListResponse）', async () => {
      api.get.mockResolvedValue({
        data: { items: [{ scheduleId: 's1' }], completedCount: 1, totalCount: 2, completionPercentage: 50 }
      });
      const res = await childSchedule.getTodayList();
      expect(res).toEqual({
        items: [{ scheduleId: 's1' }],
        completedCount: 1,
        totalCount: 2,
        completionPercentage: 50
      });
    });
  });

  describe('getWeekList - GET /api/v1/child/schedule/week', () => {
    test('URL 正确，可选 date 参数透传', async () => {
      api.get.mockResolvedValue({ data: { dates: [] } });
      await childSchedule.getWeekList('2026-08-18');
      const call = api.get.mock.calls[0];
      expect(call[0]).toBe('/api/v1/child/schedule/week');
      expect(call[1]).toEqual({ date: '2026-08-18' });
    });

    test('无 date 参数时 data 为 undefined（GET 过滤）', async () => {
      api.get.mockResolvedValue({ data: { dates: [] } });
      await childSchedule.getWeekList();
      const call = api.get.mock.calls[0];
      expect(call[1]).toBeUndefined();
    });
  });

  describe('getMonthList - GET /api/v1/child/schedule/month', () => {
    test('URL 正确，可选 date 参数透传', async () => {
      api.get.mockResolvedValue({ data: { dates: [] } });
      await childSchedule.getMonthList('2026-08-18');
      const call = api.get.mock.calls[0];
      expect(call[0]).toBe('/api/v1/child/schedule/month');
      expect(call[1]).toEqual({ date: '2026-08-18' });
    });
  });

  describe('getById - GET /api/v1/child/schedule/{id}', () => {
    test('URL 包含 scheduleId', async () => {
      api.get.mockResolvedValue({ data: { scheduleId: 's1' } });
      await childSchedule.getById('s1');
      const call = api.get.mock.calls[0];
      expect(call[0]).toBe('/api/v1/child/schedule/s1');
    });

    test('CHILD_ACCESS_DENIED 错误透传', async () => {
      api.get.mockRejectedValue({
        statusCode: 403,
        error: 'CHILD_ACCESS_DENIED',
        message: '你只能查看自己的日程'
      });
      await expect(childSchedule.getById('s-other')).rejects.toMatchObject({
        error: 'CHILD_ACCESS_DENIED',
        message: '你只能查看自己的日程'
      });
    });
  });

  describe('getWeeklyCompletion - GET /api/v1/child/stats/weekly-completion', () => {
    test('URL 正确', async () => {
      api.get.mockResolvedValue({ data: { percentage: 60, completed: 3, total: 5 } });
      await childSchedule.getWeeklyCompletion();
      const call = api.get.mock.calls[0];
      expect(call[0]).toBe('/api/v1/child/stats/weekly-completion');
    });

    test('返回 ChildWeeklyCompletionResponse', async () => {
      api.get.mockResolvedValue({ data: { percentage: 60, completed: 3, total: 5 } });
      const res = await childSchedule.getWeeklyCompletion();
      expect(res).toEqual({ percentage: 60, completed: 3, total: 5 });
    });
  });
});
