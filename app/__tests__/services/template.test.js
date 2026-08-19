// app/__tests__/services/template.test.js
// 模板服务 API 封装测试
//
// 覆盖：6 个端点的 URL/method 映射、错误码错误信息映射（apply 防御性 message 补充）

jest.mock('../../services/api');

const api = require('../../services/api');
const template = require('../../services/template');
const { ErrorCodes, ErrorMessages } = require('../../contracts/template');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('template 服务（模板 API 封装）', () => {
  describe('list - GET /api/v1/templates', () => {
    test('空 query 透传', async () => {
      api.get.mockResolvedValue({ data: { items: [], totalCount: 0, page: 1, pageSize: 20 } });
      await template.list();
      expect(api.get).toHaveBeenCalledWith('/api/v1/templates', {});
    });

    test('keyword/scheduleType/isPreset/page/pageSize 全透传', async () => {
      api.get.mockResolvedValue({ data: { items: [], totalCount: 0 } });
      await template.list({
        keyword: '钢琴',
        scheduleType: 'AfterSchoolActivity',
        isPreset: false,
        page: 2,
        pageSize: 10
      });
      expect(api.get).toHaveBeenCalledWith('/api/v1/templates', {
        keyword: '钢琴',
        scheduleType: 'AfterSchoolActivity',
        isPreset: false,
        page: 2,
        pageSize: 10
      });
    });
  });

  describe('getById - GET /api/v1/templates/{id}', () => {
    test('URL 含 templateId', async () => {
      api.get.mockResolvedValue({ data: { templateId: 't1', name: '钢琴' } });
      await template.getById('t1');
      expect(api.get).toHaveBeenCalledWith('/api/v1/templates/t1');
    });
  });

  describe('create - POST /api/v1/templates', () => {
    test('请求体完整透传', async () => {
      api.post.mockResolvedValue({ data: { templateId: 't1' } });
      const req = {
        name: '钢琴课',
        scheduleType: 'AfterSchoolActivity',
        timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }],
        location: '少年宫',
        notes: '每周三'
      };
      await template.create(req);
      expect(api.post).toHaveBeenCalledWith('/api/v1/templates', req);
    });
  });

  describe('update - PUT /api/v1/templates/{id}', () => {
    test('请求体不含 scheduleType（编辑不可改类型）', async () => {
      api.put.mockResolvedValue({ data: { templateId: 't1' } });
      const req = {
        name: '钢琴课（修改）',
        timeSlots: [{ dayOfWeek: 3, startTime: '16:30', endTime: '17:30' }],
        location: '少年宫'
      };
      await template.update('t1', req);
      expect(api.put).toHaveBeenCalledWith('/api/v1/templates/t1', req);
    });
  });

  describe('remove - DELETE /api/v1/templates/{id}', () => {
    test('路径含 templateId', async () => {
      api.del.mockResolvedValue({ data: { templateId: 't1', deleted: true } });
      await template.remove('t1');
      expect(api.del).toHaveBeenCalledWith('/api/v1/templates/t1');
    });
  });

  describe('apply - POST /api/v1/templates/{id}/apply', () => {
    test('请求体含 childId/startDate/覆盖字段', async () => {
      api.post.mockResolvedValue({ data: { scheduleId: 's1', groupKey: 'g1' } });
      const req = {
        childId: 'c1',
        startDate: '2026-08-20',
        name: '钢琴课（实例）'
      };
      await template.apply('t1', req);
      expect(api.post).toHaveBeenCalledWith('/api/v1/templates/t1/apply', req);
    });

    test('错误响应有 message 时透传原 message', async () => {
      api.post.mockRejectedValue({
        statusCode: 400,
        error: ErrorCodes.START_DATE_INVALID,
        message: '起始日期不能早于今天'
      });
      await expect(template.apply('t1', { childId: 'c1', startDate: '2020-01-01' }))
        .rejects.toMatchObject({ error: ErrorCodes.START_DATE_INVALID, message: '起始日期不能早于今天' });
    });

    test('错误响应无 message 时按契约补齐中文', async () => {
      api.post.mockRejectedValue({
        statusCode: 400,
        error: ErrorCodes.START_DATE_INVALID
      });
      await expect(template.apply('t1', { childId: 'c1', startDate: '2020-01-01' }))
        .rejects.toMatchObject({ error: ErrorCodes.START_DATE_INVALID, message: ErrorMessages.START_DATE_INVALID });
    });

    test('未知错误码透传不补齐 message', async () => {
      api.post.mockRejectedValue({ statusCode: 500, error: 'INTERNAL_ERROR' });
      await expect(template.apply('t1', { childId: 'c1', startDate: '2026-08-20' }))
        .rejects.toMatchObject({ error: 'INTERNAL_ERROR' });
    });
  });
});
