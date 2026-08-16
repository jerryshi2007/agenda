// testing/e2e/helpers/checkin-time.js
// 北京时间（UTC+8）日期计算 —— 打卡/结算时间判定的唯一基准（test-plan.md §3.1）。
//
// 服务器以北京时间判定「今天/昨天/明天」（CheckinService.ServerTime / SettlementJob.ServerNow，
// 见 api/Checkin/CheckinController.cs 与 api/Infrastructure/Jobs/SettlementJob.cs）。测试机本地
// 时区可能非 CST，因此日期字符串 MUST 按 UTC+8 计算，禁止复用 data-factory.js 的
// today()/dateOffset()（二者基于本地时区，见 test-plan.md §6.1 R4）。

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * 计算偏移 N 天的北京时间（UTC+8）日期字符串 YYYY-MM-DD。
 * 原理：把当前时刻平移到 UTC+8 墙钟（UTC 无夏令时，北京亦无夏令时），再取日期部分。
 * @param {number} offsetDays - 0=今天，-1=昨天，+1=明天
 * @returns {string} YYYY-MM-DD
 */
function beijingDate(offsetDays = 0) {
  const beijingMs = Date.now() + 8 * HOUR_MS + offsetDays * DAY_MS;
  return new Date(beijingMs).toISOString().split('T')[0];
}

function beijingToday() {
  return beijingDate(0);
}

function beijingYesterday() {
  return beijingDate(-1);
}

function beijingTomorrow() {
  return beijingDate(1);
}

/**
 * 指定日期字符串（YYYY-MM-DD）的星期几（0=周日 … 6=周六）。
 * new Date('YYYY-MM-DD') 按 UTC 午夜解析，故用 getUTCDay() 避免本地时区偏移导致星期错位。
 * 星期几是「日历日期」的属性，与本地时区无关（test-plan.md §3.1）。
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {number} 0=Sunday … 6=Saturday
 */
function beijingDayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/**
 * 当前北京时间的墙钟小时（0-23），用于运行时守卫（test-plan.md §6 R5）。
 * 服务器判定依赖北京时间墙钟（逾期线 02:00、提前窗 23:29），测试机本地时区可能非 CST，
 * 故 MUST 按 UTC+8 计算（getUTC* 避免本地时区偏移）。
 */
function beijingHour() {
  return new Date(Date.now() + 8 * HOUR_MS).getUTCHours();
}

/**
 * 当前北京时间的墙钟分钟（0-59），用于运行时守卫。
 */
function beijingMinute() {
  return new Date(Date.now() + 8 * HOUR_MS).getUTCMinutes();
}

module.exports = {
  beijingDate,
  beijingToday,
  beijingYesterday,
  beijingTomorrow,
  beijingDayOfWeek,
  beijingHour,
  beijingMinute,
};
