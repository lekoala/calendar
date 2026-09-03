import { Temporal } from "temporal-polyfill";
export type SliceOptions = {
    /**
     * IANA zone used for wall-clock projection
     */
    timeZone: string;
    /**
     * visible start in wall minutes from midnight
     */
    slotMin: number;
    /**
     * visible end in wall minutes from midnight
     */
    slotMax: number;
};
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
export declare function toZonedDateTime(value: unknown, timeZone: string): Temporal.ZonedDateTime;
/**
 * Wall-clock minutes from midnight for a zoned value.
 *
 * @param {Temporal.ZonedDateTime} zoned
 * @returns {number}
 */
export declare function wallMinutes(zoned: Temporal.ZonedDateTime): number;
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
export declare function sliceRangeForDay({ start, end, date, timeZone, slotMin, slotMax }: {
    start: unknown;
    end: unknown;
    date: Temporal.PlainDate | string;
    timeZone: string;
    slotMin: number;
    slotMax: number;
}): {
    start: number;
    end: number;
} | null;
/**
 * Slice a timed event or background onto one civil date.
 *
 * @param {{ start: unknown, end: unknown }} event
 * @param {Temporal.PlainDate | string} date
 * @param {SliceOptions} options
 * @returns {{ start: number, end: number } | null}
 */
export declare function sliceTimedEventForDay(event: {
    start: unknown;
    end: unknown;
}, date: Temporal.PlainDate | string, options: SliceOptions): {
    start: number;
    end: number;
} | null;
/**
 * Human-readable event summary for accessible names and live announcements.
 * Wall-clock based, locale-independent: `Title, 2026-09-03, 09:00 to 10:30`.
 * The end date is repeated only when it differs from the start date.
 *
 * @param {{ title?: unknown, start: unknown, end: unknown }} event
 * @param {string} timeZone
 * @returns {string}
 */
export declare function describeEvent(event: {
    title?: unknown;
    start: unknown;
    end: unknown;
}, timeZone: string): string;
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
export declare function eventOverlapsDate(range: {
    start: unknown;
    end: unknown;
}, date: Temporal.PlainDate | string, timeZone: string): boolean;
//# sourceMappingURL=slicing.d.ts.map