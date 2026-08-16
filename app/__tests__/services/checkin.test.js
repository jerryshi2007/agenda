// app/__tests__/services/checkin.test.js
jest.mock('../../services/api');

const checkin = require('../../services/checkin');
const api = require('../../services/api');
const { ErrorCodes } = require('../../contracts/checkin');

beforeEach(() => { jest.clearAllMocks(); });

describe('checkin 服务（打卡 API 封装）', () => {
  test('getWindow 调 GET /api/v1/checkin/window/{scheduleId}/{date}', async () => {
    api.get.mockResolvedValue({ statusCode: 200, data: { canCheckin: true } });
    await checkin.getWindow('s1', '2026-08-16');
    expect(api.get).toHaveBeenCalledWith('/api/v1/checkin/window/s1/2026-08-16');
  });

  test('checkin 调 POST /api/v1/checkin body {scheduleId, date}', async () => {
    api.post.mockResolvedValue({ statusCode: 200, data: { checkinId: 1 } });
    await checkin.checkin('s1', '2026-08-16');
    expect(api.post).toHaveBeenCalledWith('/api/v1/checkin', { scheduleId: 's1', date: '2026-08-16' });
  });

  test('undo 调 DELETE /api/v1/checkin/{scheduleId}/{date} 路径参数（非 body）', async () => {
    api.del.mockResolvedValue({ statusCode: 200, data: { undone: true } });
    await checkin.undo('s1', '2026-08-16');
    expect(api.del).toHaveBeenCalledWith('/api/v1/checkin/s1/2026-08-16');
    expect(api.del).not.toHaveBeenCalledWith('/api/v1/checkin', expect.anything());
  });

  test('undo TERMINAL_STATE 映射为「已结算，不可撤销」', async () => {
    api.del.mockRejectedValue({ statusCode: 400, error: ErrorCodes.TERMINAL_STATE, message: '该日程已结算，不可打卡或撤销' });
    await expect(checkin.undo('s1', '2026-08-16')).rejects.toMatchObject({ message: '已结算，不可撤销' });
  });

  test('undo NOT_CHECKED_IN 映射为「无打卡记录」', async () => {
    api.del.mockRejectedValue({ statusCode: 400, error: ErrorCodes.NOT_CHECKED_IN, message: '该日程尚未打卡，无法撤销' });
    await expect(checkin.undo('s1', '2026-08-16')).rejects.toMatchObject({ message: '无打卡记录' });
  });

  test('undo 其他错误透传原 message', async () => {
    api.del.mockRejectedValue({ statusCode: 400, error: ErrorCodes.WINDOW_CLOSED, message: '撤销窗口已关闭，无法撤销' });
    await expect(checkin.undo('s1', '2026-08-16')).rejects.toMatchObject({ error: ErrorCodes.WINDOW_CLOSED, message: '撤销窗口已关闭，无法撤销' });
  });

  test('checkin 幂等响应（alreadyCheckedIn）视为成功返回', async () => {
    api.post.mockResolvedValue({ statusCode: 200, data: { alreadyCheckedIn: true } });
    const res = await checkin.checkin('s1', '2026-08-16');
    expect(res.data.alreadyCheckedIn).toBe(true);
  });
});
