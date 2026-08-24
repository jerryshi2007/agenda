// app/__tests__/pages/index-week.test.js
// index 页周视图数据分组 —— _fetchData 把扁平 schedules 按天挂到 weekDays，列内按时间排序

const dateUtils = require('../../utils/date-utils');
const mockCalendar = require('../helpers/calendar-mock');

jest.mock('../../services/calendar', () => mockCalendar);

const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

// 周视图 _fetchData 实际会传给 query() 一个 21 天范围（当前周 + 前后各一周）。
// 本测试只关心分组/排序，query 参数值不作为断言主体。
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(datesPayload) {
  installWxMock();
  jest.clearAllMocks();

  const app = {
    globalData: {
      pendingPrivacyConsent: false,
      needsProfileCollection: false,
      memberList: []
    },
    updateCalendarState: jest.fn(),
    refreshFamilyContext: jest.fn()
  };

  const { type, config } = loadPage('pages/index/index.js', { app });
  expect(type).toBe('page');
  const ctx = createPageContext(config);
  ctx.selectComponent = jest.fn(() => ({ reset: jest.fn() }));

  mockCalendar.query.mockResolvedValue({ data: { dates: datesPayload } });
  return { ctx };
}

describe('index 页周视图数据分组', () => {
  test('weekDays 按天分组并对时间排序，空天为空数组', async () => {
    const anchor = dateUtils.toDate('2026-08-23');
    const weekDays = dateUtils.generateWeekDays(anchor);
    const d2 = weekDays[1].date;
    const d4 = weekDays[3].date;

    const datesPayload = [
      {
        date: d2,
        schedules: [
          { scheduleId: 'b', name: 'B', startTime: '16:00', scheduleType: 'DailyRoutine' },
          { scheduleId: 'a', name: 'A', startTime: '07:00', scheduleType: 'AfterSchoolActivity' }
        ]
      },
      {
        date: d4,
        schedules: [
          { scheduleId: 'c', name: 'C', startTime: '10:00', scheduleType: 'HomeworkTask', dueDate: '2026-08-23' }
        ]
      }
    ];

    const { ctx } = setup(datesPayload);
    ctx.setData({ currentView: 'week', currentDate: '2026-08-23' });
    ctx._fetchData();
    await flush();

    const result = ctx.data.weekDays;
    expect(result).toHaveLength(7);

    // 第 2 天：B(16:00) / A(07:00) 应按时间升序 → A, B
    const day2 = result.find(d => d.date === d2);
    expect(day2.schedules.map(s => s.scheduleId)).toEqual(['a', 'b']);
    expect(day2.schedules[0].instanceDate).toBe(d2);

    // 第 4 天：仅 C
    const day4 = result.find(d => d.date === d4);
    expect(day4.schedules.map(s => s.scheduleId)).toEqual(['c']);

    // 其余天：无日程 → 空数组
    const empties = result.filter(d => d.date !== d2 && d.date !== d4);
    empties.forEach(d => expect(d.schedules).toEqual([]));

    // 扁平聚合列表也保留（供空态判断等）
    expect(ctx.data.schedules).toHaveLength(3);
  });

  test('周维度过滤后 query 收到 view=week 与日期范围', async () => {
    const { ctx } = setup([]);
    ctx.setData({ currentView: 'week', currentDate: '2026-08-23' });
    ctx._fetchData();
    await flush();

    expect(mockCalendar.query).toHaveBeenCalledTimes(1);
    const params = mockCalendar.query.mock.calls[0][0];
    expect(params.view).toBe('week');
    expect(params.startDate).toBeTruthy();
    expect(params.endDate).toBeTruthy();
  });
});
