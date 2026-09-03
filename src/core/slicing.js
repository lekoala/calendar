import { Temporal } from "temporal-polyfill";
import { formatClock, toPlainDate } from "./dates.js";

/**
 * Temporal day slicing for timed events and backgrounds.
 *
 * Single pipeline, no renderer-side date math:
 *
 * ```text
 * input -> normalize to ZonedDateTime -> withTimeZone(calendar.timeZone)
 *   -> compare PlainDate -> wall-clock minutes -> clip to slot range
 * ```
 *
 * The grid height represents local wall-clock time, not elapsed seconds.
 * On a 23-hour (spring forward) or 25-hour (fall back) day the same wall
 * minutes map to the same vertical position; absolute durations are never
 * used for geometry.
 *
 * @typedef {object} SliceOptions
 * @property {string} timeZone IANA zone used for wall-clock projection
 * @property {number} slotMin visible start in wall minutes from midnight
 * @property {number} slotMax visible end in wall minutes from midnight
 */

/**
 * Normalize a boundary value to a `Temporal.ZonedDateTime` in `timeZone`.
 * Accepts `ZonedDateTime` instances and ISO strings with offset/zone.
 *
 * @param {unknown} value
 * @param {string} timeZone
 * @returns {Temporal.ZonedDateTime}
 */
export function toZonedDateTime(value, timeZone) {
  if (value instanceof Temporal.ZonedDateTime) {
    return value.withTimeZone(timeZone);
  }
  if (typeof value === "string") {
    return Temporal.ZonedDateTime.from(value).withTimeZone(timeZone);
  }
  throw new TypeError("Event boundaries must be Temporal.ZonedDateTime or ISO strings");
}

/**
 * Wall-clock minutes from midnight for a zoned value.
 *
 * @param {Temporal.ZonedDateTime} zoned
 * @returns {number}
 */
export function wallMinutes(zoned) {
  const time = zoned.toPlainTime();
  return time.hour * 60 + time.minute + time.second / 60 + time.millisecond / 60000;
}

/**
 * Slice a [start, end) range onto one civil date, clipped to the visible
 * slot range. Returns `null` when the visible slice has no positive
 * duration.
 *
 * Multi-day input is clipped per day, so `Mon 22:00 -> Tue 02:00` yields
 * `Mon 22:00 -> slotMax` on Monday and `slotMin -> 02:00` on Tuesday.
 *
 * @param {object} input
 * @param {unknown} input.start range start (ZonedDateTime or ISO string)
 * @param {unknown} input.end range end (ZonedDateTime or ISO string)
 * @param {Temporal.PlainDate | string} input.date civil date to slice for
 * @param {string} input.timeZone
 * @param {number} input.slotMin
 * @param {number} input.slotMax
 * @returns {{ start: number, end: number } | null}
 */
export function sliceRangeForDay({ start, end, date, timeZone, slotMin, slotMax }) {
  const day = toPlainDate(date);
  const startZoned = toZonedDateTime(start, timeZone);
  const endZoned = toZonedDateTime(end, timeZone);
  if (Temporal.ZonedDateTime.compare(endZoned, startZoned) <= 0) return null;

  const startDay = startZoned.toPlainDate();
  const endDay = endZoned.toPlainDate();
  if (Temporal.PlainDate.compare(day, startDay) < 0 || Temporal.PlainDate.compare(day, endDay) > 0) {
    return null;
  }

  const startWall = Temporal.PlainDate.compare(day, startDay) === 0 ? wallMinutes(startZoned) : slotMin;
  const endWall = Temporal.PlainDate.compare(day, endDay) === 0 ? wallMinutes(endZoned) : slotMax;
  const clippedStart = Math.max(slotMin, startWall);
  const clippedEnd = Math.min(slotMax, endWall);
  if (clippedEnd <= clippedStart) return null;
  return { start: clippedStart, end: clippedEnd };
}

/**
 * Slice a timed event or background onto one civil date.
 *
 * @param {{ start: unknown, end: unknown }} event
 * @param {Temporal.PlainDate | string} date
 * @param {SliceOptions} options
 * @returns {{ start: number, end: number } | null}
 */
export function sliceTimedEventForDay(event, date, options) {
  return sliceRangeForDay({
    start: event.start,
    end: event.end,
    date,
    timeZone: options.timeZone,
    slotMin: options.slotMin,
    slotMax: options.slotMax,
  });
}

/**
 * Human-readable event summary for accessible names and live announcements.
 * Wall-clock based, locale-independent: `Title, 2026-09-03, 09:00 to 10:30`.
 * The end date is repeated only when it differs from the start date.
 *
 * @param {{ title?: unknown, start: unknown, end: unknown }} event
 * @param {string} timeZone
 * @returns {string}
 */
export function describeEvent(event, timeZone) {
  const start = toZonedDateTime(event.start, timeZone);
  const end = toZonedDateTime(event.end, timeZone);
  const title = event.title ?? "Event";
  const startDay = start.toPlainDate().toString();
  const endDay = end.toPlainDate().toString();
  const startText = `${startDay}, ${formatClock(wallMinutes(start))}`;
  const endText =
    startDay === endDay ? formatClock(wallMinutes(end)) : `${endDay}, ${formatClock(wallMinutes(end))}`;
  return `${title}, ${startText} to ${endText}`;
}

/**
 * Civil-day overlap for summary representations (month cells, list groups).
 * True when any part of [start, end) falls on `date` in `timeZone`. An event
 * ending exactly at midnight does not overlap the next day.
 *
 * @param {{ start: unknown, end: unknown }} range
 * @param {Temporal.PlainDate | string} date
 * @param {string} timeZone
 * @returns {boolean}
 */
export function eventOverlapsDate(range, date, timeZone) {
  const day = toPlainDate(date);
  const startZoned = toZonedDateTime(range.start, timeZone);
  const endZoned = toZonedDateTime(range.end, timeZone);
  if (Temporal.ZonedDateTime.compare(endZoned, startZoned) <= 0) return false;
  const startDay = startZoned.toPlainDate();
  const endDay = endZoned.toPlainDate();
  if (Temporal.PlainDate.compare(day, startDay) < 0) return false;
  if (Temporal.PlainDate.compare(day, endDay) > 0) return false;
  if (Temporal.PlainDate.compare(day, endDay) === 0 && wallMinutes(endZoned) <= 0) return false;
  return true;
}
