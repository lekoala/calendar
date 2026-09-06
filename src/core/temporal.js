import { Temporal } from "temporal-polyfill";
import { instantRangeOf } from "./slicing.js";

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
export function temporalState(start, end, now, timeZone = "UTC") {
  const { start: startInstant, end: endInstant } = instantRangeOf(start, end, timeZone);
  const nowMs = now.epochMilliseconds;
  if (endInstant.epochMilliseconds <= nowMs) return "past";
  if (startInstant.epochMilliseconds <= nowMs) return "current";
  return "future";
}

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
export function nextStateChangeMs(events, nowMs, timeZone = "UTC", visibleRange = null) {
  let scope = null;
  if (visibleRange) {
    const projected = instantRangeOf(visibleRange.start, visibleRange.end, timeZone);
    scope = { startMs: projected.start.epochMilliseconds, endMs: projected.end.epochMilliseconds };
    if (!(scope.endMs > scope.startMs)) return null;
  }
  let next = null;
  for (const event of events) {
    const { start, end } = instantRangeOf(event.start, event.end, timeZone);
    const startMs = start.epochMilliseconds;
    const endMs = end.epochMilliseconds;
    if (scope && (endMs <= scope.startMs || startMs >= scope.endMs)) continue;
    if (startMs > nowMs && (next === null || startMs < next)) next = startMs;
    if (endMs > nowMs && (next === null || endMs < next)) next = endMs;
  }
  return next;
}
