import { Temporal } from "temporal-polyfill";

/** @type {Record<string, number>} */
const VIEW_DAYS = {
  day: 1,
  threeDays: 3,
  week: 7,
  resourceDay: 1,
  resourceThreeDays: 3,
  list: 7,
};

/**
 * @param {Temporal.PlainDate | string} value
 * @returns {Temporal.PlainDate}
 */
export function toPlainDate(value) {
  return value instanceof Temporal.PlainDate ? value : Temporal.PlainDate.from(value);
}

/**
 * @param {string} view
 * @returns {number}
 */
export function getViewDays(view) {
  return VIEW_DAYS[view] ?? 1;
}

/**
 * @param {Temporal.PlainDate | string} date
 * @param {string} view
 * @returns {{ start: Temporal.PlainDate, end: Temporal.PlainDate }}
 */
export function getViewRange(date, view) {
  if (isMonthView(view)) return getMonthRange(date);
  const start = toPlainDate(date);
  const end = start.add({ days: getViewDays(view) });
  return { start, end };
}

/**
 * @param {Temporal.PlainDate | string} date
 * @param {string} view
 * @returns {Temporal.PlainDate[]}
 */
export function getVisibleDates(date, view) {
  if (isMonthView(view)) return getMonthWeeks(date).flat();
  const start = toPlainDate(date);
  const count = getViewDays(view);
  return Array.from({ length: count }, (_, index) => start.add({ days: index }));
}

/**
 * @param {string} view
 * @returns {boolean}
 */
export function isResourceView(view) {
  return view === "resourceDay" || view === "resourceThreeDays";
}

/**
 * @param {string} view
 * @returns {boolean}
 */
export function isMonthView(view) {
  return view === "month";
}

/**
 * Full Monday → Sunday weeks covering the anchor date's calendar month,
 * including leading/trailing days of adjacent months. Week start is ISO
 * Monday; a `weekStart` option stays a future extension.
 *
 * @param {Temporal.PlainDate | string} date
 * @returns {Temporal.PlainDate[][]}
 */
export function getMonthWeeks(date) {
  const anchor = toPlainDate(date);
  const monthStart = anchor.with({ day: 1 });
  const monthEnd = monthStart.add({ months: 1 }).subtract({ days: 1 });
  const first = monthStart.subtract({ days: monthStart.dayOfWeek - 1 });
  /** @type {Temporal.PlainDate[][]} */
  const weeks = [];
  let current = first;
  for (;;) {
    const week = Array.from({ length: 7 }, (_, index) => current.add({ days: index }));
    weeks.push(week);
    if (Temporal.PlainDate.compare(week[6], monthEnd) >= 0) break;
    current = week[6].add({ days: 1 });
  }
  return weeks;
}

/**
 * Visible month range with an exclusive end, matching the `getViewRange`
 * convention sources rely on.
 *
 * @param {Temporal.PlainDate | string} date
 * @returns {{ start: Temporal.PlainDate, end: Temporal.PlainDate }}
 */
export function getMonthRange(date) {
  const weeks = getMonthWeeks(date);
  return { start: weeks[0][0], end: weeks[weeks.length - 1][6].add({ days: 1 }) };
}

/**
 * @param {Temporal.PlainTime | string} value
 * @returns {Temporal.PlainTime}
 */
export function parseClock(value) {
  return Temporal.PlainTime.from(value);
}

/**
 * @param {Temporal.PlainTime | string} value
 * @returns {number}
 */
export function minutesFromMidnight(value) {
  const time = value instanceof Temporal.PlainTime ? value : parseClock(value);
  return time.hour * 60 + time.minute + time.second / 60;
}

/**
 * @param {Temporal.Duration | Parameters<typeof Temporal.Duration.from>[0]} duration
 * @returns {number}
 */
export function durationMinutes(duration) {
  const value = duration instanceof Temporal.Duration ? duration : Temporal.Duration.from(duration);
  return value.total({ unit: "minute" });
}

/**
 * @param {Temporal.PlainDate | string} date
 * @param {number} minutes
 * @param {string} timeZone
 * @returns {Temporal.ZonedDateTime}
 */
export function zonedDateTimeAt(date, minutes, timeZone) {
  const day = toPlainDate(date);
  const time = Temporal.PlainTime.from({ hour: Math.floor(minutes / 60), minute: Math.floor(minutes % 60) });
  return day.toPlainDateTime(time).toZonedDateTime(timeZone);
}

/**
 * @param {number} minutes
 * @returns {string}
 */
export function formatClock(minutes) {
  const clamped = Math.max(0, minutes);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(Math.floor(clamped % 60)).padStart(2, "0")}`;
}
