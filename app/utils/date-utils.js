// app/utils/date-utils.js
// 日期计算工具函数

/**
 * 格式化日期为 yyyy-MM-dd 字符串
 */
function formatDate(date) {
  const d = toDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 格式化日期为中文可读格式 "M月D日 周X"
 */
function formatDateChinese(date) {
  const d = toDate(date);
  const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekNames[d.getDay()]}`;
}

/**
 * 格式化为时间字符串 "HH:mm"
 */
function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  return parts.slice(0, 2).join(':');
}

/**
 * 格式化日期范围 "M月D日 - M月D日"
 */
function formatDateRange(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getMonth() + 1}月${s.getDate()}日 - ${e.getDate()}日`;
  }
  return `${s.getMonth() + 1}月${s.getDate()}日 - ${e.getMonth() + 1}月${e.getDate()}日`;
}

/**
 * 格式化月份标题 "YYYY年 M月"
 */
function formatMonthTitle(date) {
  const d = toDate(date);
  return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
}

/**
 * 将各种输入转为 Date 对象
 */
function toDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    // 支持 yyyy-MM-dd 格式
    const parts = val.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(val);
  }
  return new Date(val);
}

/**
 * 判断两个日期字符串是否同一天
 */
function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  return formatDate(d1) === formatDate(d2);
}

/**
 * 判断 date 是否在今天之后（不含今天）
 */
function isAfterToday(date) {
  const d = toDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d > today;
}

/**
 * 判断 date 是否在今天之前（不含今天）
 */
function isBeforeToday(date) {
  const d = toDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * 获取某月的第一天
 */
function getFirstDayOfMonth(date) {
  const d = toDate(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * 获取某月的最后一天
 */
function getLastDayOfMonth(date) {
  const d = toDate(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * 获取某天所在周的第一天（周一）
 */
function getFirstDayOfWeek(date) {
  const d = toDate(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

/**
 * 获取某天所在周的最后一天（周日）
 */
function getLastDayOfWeek(date) {
  const monday = getFirstDayOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

/**
 * 获取某天是星期几的中文名称
 */
function getDayOfWeekName(date) {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[toDate(date).getDay()];
}

/**
 * 日期加减天数
 * 注意：toDate() 对 Date 输入直接返回同一对象，必须显式克隆避免外层 caller 的 monday
 * 被累积污染（H-fix：原实现把同一 monday 对象 +1/+2/+3...，导致 generateWeekDays 失败）
 */
function addDays(date, days) {
  const d = new Date(toDate(date));
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * 日期加减月数
 */
function addMonths(date, months) {
  const d = new Date(toDate(date));
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * 生成月视图的日历单元格数组（42 格 = 7x6）
 * 返回数组，每项含 { date, dateStr, isCurrentMonth, isToday, isWeekend }
 */
function generateMonthCells(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  const todayStr = formatDate(today);

  // 计算从周一开始的偏移
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;
  const startDate = new Date(year, month, 1 - startDay);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + i);
    const dateStr = formatDate(cellDate);
    cells.push({
      date: dateStr,
      day: cellDate.getDate(),
      isCurrentMonth: cellDate.getMonth() === month,
      isToday: dateStr === todayStr,
      isWeekend: cellDate.getDay() === 0 || cellDate.getDay() === 6
    });
  }
  return cells;
}

/**
 * 生成周视图的 7 天日期数组
 */
function generateWeekDays(date) {
  const monday = getFirstDayOfWeek(date);
  const days = [];
  const today = new Date();
  const todayStr = formatDate(today);
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    days.push({
      date: formatDate(d),
      day: d.getDate(),
      dayOfWeek: d.getDay(),
      dayOfWeekName: getDayOfWeekName(d),
      isToday: formatDate(d) === todayStr,
      isWeekend: d.getDay() === 0 || d.getDay() === 6
    });
  }
  return days;
}

/**
 * DayOfWeek（0=周日）转为中文名
 */
function dayOfWeekToChinese(num) {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[num] || '';
}

/**
 * 将 TimeSlot 数组转为 RepeatRule 中文描述
 * 例如：[{dayOfWeek:1, ...}, {dayOfWeek:3, ...}] => "每周一、周三"
 */
function toRepeatRuleText(timeSlots) {
  if (!timeSlots || timeSlots.length === 0) return '';

  const days = timeSlots
    .map(ts => ts.dayOfWeek)
    .sort((a, b) => a - b);

  const dayNames = days.map(d => dayOfWeekToChinese(d).replace('周', ''));

  // 合并连续的天
  if (days.length === 7) return '每天';

  const parts = [];
  let start = 0;
  for (let i = 0; i < days.length; i++) {
    if (i === days.length - 1 || days[i + 1] !== days[i] + 1) {
      if (start === i) {
        parts.push('周' + dayNames[i]);
      } else if (start === i - 1) {
        parts.push('周' + dayNames[start] + '、周' + dayNames[i]);
      } else {
        parts.push('周' + dayNames[start] + '至周' + dayNames[i]);
      }
      start = i + 1;
    }
  }
  return '每' + parts.join('、');
}

/**
 * DayOfWeek 转数字（C# DayOfWeek: 0=Sunday）
 */
function dayOfWeekToNum(dayName) {
  const map = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
  return map[dayName] !== undefined ? map[dayName] : parseInt(dayName);
}

module.exports = {
  formatDate,
  formatDateChinese,
  formatTime,
  formatDateRange,
  formatMonthTitle,
  toDate,
  isSameDay,
  isAfterToday,
  isBeforeToday,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getFirstDayOfWeek,
  getLastDayOfWeek,
  getDayOfWeekName,
  addDays,
  addMonths,
  generateMonthCells,
  generateWeekDays,
  dayOfWeekToChinese,
  toRepeatRuleText,
  dayOfWeekToNum
};
