// app/__tests__/utils/date-utils.test.js
// 日期工具函数回归测试 —— 锁定 H-fix（addDays 不再累积污染输入对象）

const dateUtils = require('../../utils/date-utils');

describe('date-utils · addDays 不可变性', () => {
  test('addDays 不修改原 Date 对象（累积污染修复）', () => {
    const monday = new Date(2026, 7, 17); // 2026-08-17 周一
    const orig = monday.getTime();
    dateUtils.addDays(monday, 1);
    expect(monday.getTime()).toBe(orig);
  });

  test('连续 addDays 调用基于原始日期而非累计值（generateWeekDays 依赖）', () => {
    const monday = new Date(2026, 7, 17);
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(dateUtils.addDays(monday, i));
    }
    // 7 个日期应连续递增
    expect(days[0].getDate()).toBe(17);
    expect(days[1].getDate()).toBe(18);
    expect(days[2].getDate()).toBe(19);
    expect(days[3].getDate()).toBe(20);
    expect(days[4].getDate()).toBe(21);
    expect(days[5].getDate()).toBe(22);
    expect(days[6].getDate()).toBe(23);
  });

  test('addMonths 不修改原 Date 对象', () => {
    const d = new Date(2026, 0, 15); // 2026-01-15
    const orig = d.getTime();
    dateUtils.addMonths(d, 1);
    expect(d.getTime()).toBe(orig);
  });
});

describe('date-utils · generateWeekDays', () => {
  test('2026-08-18（周二）所在周为周一 8/17 至周日 8/23', () => {
    const days = dateUtils.generateWeekDays(new Date(2026, 7, 18));
    expect(days[0].date).toBe('2026-08-17');
    expect(days[0].dayOfWeek).toBe(1); // 周一
    expect(days[6].date).toBe('2026-08-23');
    expect(days[6].dayOfWeek).toBe(0); // 周日
    expect(days).toHaveLength(7);
  });
});
