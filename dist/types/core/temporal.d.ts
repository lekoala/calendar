import { Temporal } from "temporal-polyfill";
export type TemporalState = "past" | "current" | "future";
/**
 * Temporal fact of an event relative to `now`: past, current or future.
 * Pure presentation fact, never policy: the core never derives
 * `editable`/`movable`/`resizable` from it, applications do.
 *
 * @typedef {"past" | "current" | "future"} TemporalState
 */
/**
 * Classify a canonical `[start, end)` range against `now`.
 *
 * Timed bounds are `Temporal.ZonedDateTime`, all-day bounds civil
 * `Temporal.PlainDate` projected to their local midnights in `timeZone`
 * (same projection as the overlap queries, so consecutive civil midnights
 * span real 23-/25-hour DST days). Half-open like the rest of the core:
 * `end <= now` is past, `start <= now < end` is current.
 *
 * @param {unknown} start canonical range start
 * @param {unknown} end canonical range end
 * @param {Temporal.ZonedDateTime} now reference instant, cached per render
 * @param {string} [timeZone] IANA zone used to project civil bounds
 * @returns {TemporalState}
 */
export declare function temporalState(start: unknown, end: unknown, now: Temporal.ZonedDateTime, timeZone?: string): TemporalState;
/**
 * Next visible `start`/`end` boundary after `nowMs`, as epoch milliseconds.
 * The render arms one `setTimeout` to it, fires `queueRender()`, and the
 * next render recomputes the following boundary — one shot, no tick.
 *
 * @param {Array<import("./model.js").NormalizedEvent>} events canonical state
 * @param {number} nowMs reference instant in epoch milliseconds
 * @param {string} [timeZone] IANA zone used to project civil bounds
 * @param {{ start: unknown, end: unknown } | null} [visibleRange] civil half-open scope; null means every event
 * @returns {number | null} next boundary, or null when nothing visible ages
 */
export declare function nextStateChangeMs(events: Array<import("./model.js").NormalizedEvent>, nowMs: number, timeZone?: string, visibleRange?: {
    start: unknown;
    end: unknown;
} | null): number | null;
//# sourceMappingURL=temporal.d.ts.map