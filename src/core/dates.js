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
 * Views anchored on a civil week rather than on the anchor date. Everything
 * else is a rolling range that simply starts at `date`.
 *
 * @type {Set<string>}
 */
const WEEK_ANCHORED_VIEWS = new Set(["week"]);

/**
 * @typedef {object} DateDerivationOptions
 * @property {number} [firstDay] first weekday of a civil week, ISO 1-7 (default 1, Monday)
 * @property {Iterable<number>} [hiddenDays] weekdays never rendered, ISO 1-7
 * @property {string} [locale] BCP 47 tag suggesting `firstDay` when none is explicit; never parsed for math
 */

/**
 * Weekdays use the ISO convention Temporal exposes: 1 = Monday through
 * 7 = Sunday. `0` is accepted as an alias for Sunday, because that is what
 * `Date.prototype.getDay` and most calendar APIs use, and the two
 * conventions agree on every other day.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function isoWeekday(value) {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 0 || day > 7) return null;
  return day === 0 ? 7 : day;
}

/**
 * @param {DateDerivationOptions} [options]
 * @returns {{ firstDay: number, hiddenDays: Set<number> }}
 */
function resolveDateOptions(options = {}) {
  // Explicit `firstDay` wins; otherwise the locale suggests one (FullCalendar
  // parity: `locale` sets the default, an explicit option overrides it);
  // runtimes without week-info support or unknown tags fall back to Monday.
  const explicit = isoWeekday(options.firstDay);
  const locale = resolveLocale(options.locale);
  const firstDay = explicit ?? (locale ? (firstDayFromLocale(locale) ?? 1) : 1);
  /** @type {Set<number>} */
  const hiddenDays = new Set();
  for (const value of options.hiddenDays ?? []) {
    const day = isoWeekday(value);
    if (day !== null) hiddenDays.add(day);
  }
  // Hiding every weekday would leave nothing to render, and would make the
  // rolling collector below spin forever: treat it as "hide nothing".
  if (hiddenDays.size >= 7) hiddenDays.clear();
  return { firstDay, hiddenDays };
}

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
 * @param {string} view
 * @returns {boolean}
 */
export function isWeekAnchoredView(view) {
  return WEEK_ANCHORED_VIEWS.has(view);
}

/**
 * Start of the civil week containing `date`.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {number} [firstDay] ISO 1-7, default Monday
 * @returns {Temporal.PlainDate}
 */
export function startOfWeek(date, firstDay = 1) {
  const anchor = toPlainDate(date);
  const start = isoWeekday(firstDay) ?? 1;
  return anchor.subtract({ days: (anchor.dayOfWeek - start + 7) % 7 });
}

/**
 * Visible range with an exclusive end, covering every rendered date. Hidden
 * days shrink what is rendered but not what a source is asked for: the range
 * always spans from the first to the last rendered day.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {string} view
 * @param {DateDerivationOptions} [options]
 * @returns {{ start: Temporal.PlainDate, end: Temporal.PlainDate }}
 */
export function getViewRange(date, view, options = {}) {
  if (isMonthView(view)) return getMonthRange(date, options);
  const dates = getVisibleDates(date, view, options);
  if (dates.length === 0) {
    const start = toPlainDate(date);
    return { start, end: start };
  }
  return { start: dates[0], end: dates[dates.length - 1].add({ days: 1 }) };
}

/**
 * Dates rendered as columns or groups.
 *
 * Week-anchored views derive the civil week containing the anchor and then
 * drop hidden days, because a week is a fixed civil unit: hiding Sunday
 * leaves six columns. Rolling views instead fill their day count with
 * visible days, because `threeDays` means three usable days, not three
 * calendar days of which one may be blank.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {string} view
 * @param {DateDerivationOptions} [options]
 * @returns {Temporal.PlainDate[]}
 */
export function getVisibleDates(date, view, options = {}) {
  if (isMonthView(view)) return getMonthWeeks(date, options).flat();
  const { firstDay, hiddenDays } = resolveDateOptions(options);
  const count = getViewDays(view);

  if (isWeekAnchoredView(view)) {
    const start = startOfWeek(date, firstDay);
    return Array.from({ length: count }, (_, index) => start.add({ days: index })).filter(
      (day) => !hiddenDays.has(day.dayOfWeek),
    );
  }

  /** @type {Temporal.PlainDate[]} */
  const dates = [];
  let cursor = toPlainDate(date);
  while (dates.length < count) {
    if (!hiddenDays.has(cursor.dayOfWeek)) dates.push(cursor);
    cursor = cursor.add({ days: 1 });
  }
  return dates;
}

/**
 * Anchor date for the previous (`-1`) or next (`1`) range.
 *
 * Month steps by calendar months and week-anchored views by whole weeks, so
 * both keep the anchor weekday. Rolling views step by their own count of
 * visible days rather than by a fixed number of calendar days, so hidden
 * days never make two consecutive ranges overlap or skip a day.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {string} view
 * @param {-1 | 1} direction
 * @param {DateDerivationOptions} [options]
 * @returns {Temporal.PlainDate}
 */
export function stepAnchor(date, view, direction, options = {}) {
  const anchor = toPlainDate(date);
  if (isMonthView(view)) return anchor.add({ months: direction });
  if (isWeekAnchoredView(view)) return anchor.add({ days: 7 * direction });
  if (direction > 0) {
    // Land on a day that is actually rendered, so the anchor never sits on a
    // hidden day just because the previous range ended on a Friday.
    const after = getViewRange(anchor, view, options).end;
    return getVisibleDates(after, view, options)[0] ?? after;
  }

  const { hiddenDays } = resolveDateOptions(options);
  const count = getViewDays(view);
  const start = getVisibleDates(anchor, view, options)[0] ?? anchor;
  let cursor = start.subtract({ days: 1 });
  let earliest = cursor;
  let found = 0;
  while (found < count) {
    if (!hiddenDays.has(cursor.dayOfWeek)) {
      found += 1;
      earliest = cursor;
    }
    if (found < count) cursor = cursor.subtract({ days: 1 });
  }
  return earliest;
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
 * Full seven-day weeks covering the anchor date calendar month, including
 * leading/trailing days of adjacent months.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {number} firstDay ISO 1-7
 * @returns {Temporal.PlainDate[][]}
 */
function fullMonthWeeks(date, firstDay) {
  const anchor = toPlainDate(date);
  const monthStart = anchor.with({ day: 1 });
  const monthEnd = monthStart.add({ months: 1 }).subtract({ days: 1 });
  /** @type {Temporal.PlainDate[][]} */
  const weeks = [];
  let current = startOfWeek(monthStart, firstDay);
  for (;;) {
    const week = Array.from({ length: 7 }, (_, index) => current.add({ days: index }));
    weeks.push(week);
    if (Temporal.PlainDate.compare(week[6], monthEnd) >= 0) break;
    current = week[6].add({ days: 1 });
  }
  return weeks;
}

/**
 * Weeks covering the anchor date calendar month, starting on `firstDay` and
 * with hidden days removed, so every row keeps the same length and the grid
 * stays rectangular.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {DateDerivationOptions} [options]
 * @returns {Temporal.PlainDate[][]}
 */
export function getMonthWeeks(date, options = {}) {
  const { firstDay, hiddenDays } = resolveDateOptions(options);
  const weeks = fullMonthWeeks(date, firstDay);
  if (hiddenDays.size === 0) return weeks;
  return weeks.map((week) => week.filter((day) => !hiddenDays.has(day.dayOfWeek)));
}

/**
 * Visible month range with an exclusive end, matching the `getViewRange`
 * convention sources rely on. Hidden days do not shrink it: the grid still
 * spans whole weeks, and asking a source for a day that is not rendered is
 * harmless where asking for too little is not.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {DateDerivationOptions} [options]
 * @returns {{ start: Temporal.PlainDate, end: Temporal.PlainDate }}
 */
export function getMonthRange(date, options = {}) {
  const { firstDay } = resolveDateOptions(options);
  const weeks = fullMonthWeeks(date, firstDay);
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

/**
 * Normalize a locale option. Blank strings behave as "no locale" so empty
 * attributes and sloppy configuration fall back to the runtime default.
 *
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function resolveLocale(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * First weekday suggested by a BCP 47 locale tag, ISO 1-7, or null when the
 * runtime cannot tell (no week-info support, unknown tag). Never throws and
 * never does date math: presentation hint only.
 *
 * @param {string} locale
 * @returns {number | null}
 */
export function firstDayFromLocale(locale) {
  const day = Number(readWeekInfoFirstDay(locale));
  if (!Number.isInteger(day) || day < 1 || day > 7) return null;
  return day;
}

/**
 * @param {string} locale
 * @returns {unknown}
 */
function readWeekInfoFirstDay(locale) {
  try {
    const factory = localeWeekInfoReader();
    if (!factory) return null;
    const info = factory(locale);
    if (typeof info !== "object" || info === null) return null;
    return /** @type {{ firstDay?: unknown }} */ (info).firstDay ?? null;
  } catch {
    return null;
  }
}

/**
 * Structural access to `Intl.Locale#getWeekInfo`, kept structural because
 * the ES2022 library contract predates week-info support.
 *
 * @returns {((tag: string) => unknown) | null}
 */
function localeWeekInfoReader() {
  const holder = /** @type {{ Locale?: unknown }} */ (/** @type {unknown} */ (Intl));
  if (typeof holder.Locale !== "function") return null;
  const Ctor = /** @type {new (tag: string) => { getWeekInfo?: () => unknown }} */ (holder.Locale);
  return (tag) => {
    const instance = new Ctor(tag);
    return typeof instance.getWeekInfo === "function" ? instance.getWeekInfo() : null;
  };
}

/**
 * Locale-aware day-column header default, e.g. `Thu, 9/3` in English.
 * Hooks (`dayHeaderContent`) stay authoritative; this only feeds the fallback.
 *
 * @param {Temporal.PlainDate | string} date
 * @param {string | undefined} locale BCP 47 tag, or undefined for the runtime default
 * @returns {string}
 */
export function formatDayHeader(date, locale) {
  return toPlainDate(date).toLocaleString(locale, { weekday: "short", month: "numeric", day: "numeric" });
}

/**
 * Locale-aware time-axis label default, e.g. `8:00 AM` in English.
 * `slotLabelContent` stays authoritative; this only feeds the fallback.
 * Out-of-`PlainTime` edges such as `24:00` keep the legacy 24h rendering.
 *
 * @param {number} minutes minutes after midnight
 * @param {string | undefined} locale BCP 47 tag, or undefined for the runtime default
 * @returns {string}
 */
export function formatSlotLabel(minutes, locale) {
  const total = Math.max(0, Math.floor(minutes));
  const hour = Math.floor(total / 60);
  if (hour > 23) return formatClock(minutes);
  const time = Temporal.PlainTime.from({ hour, minute: total % 60 });
  return time.toLocaleString(locale, { hour: "numeric", minute: "2-digit" });
}
