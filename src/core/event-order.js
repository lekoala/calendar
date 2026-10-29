import { instantRangeOf } from "./slicing.js";

/**
 * Sort a copy for month presentation. Comparator ties use the canonical
 * start instant, then stable source order; canonical state is never sorted.
 *
 * @param {import("./model.js").NormalizedEvent[]} events
 * @param {string} timeZone
 * @param {((a: import("./model.js").NormalizedEvent, b: import("./model.js").NormalizedEvent) => number)} [compare]
 * @returns {import("./model.js").NormalizedEvent[]}
 */
export function orderMonthEvents(events, timeZone, compare) {
  const starts = new Map(
    events.map((event) => [event, instantRangeOf(event.start, event.end, timeZone).start.epochMilliseconds]),
  );
  return [...events].sort(
    (a, b) =>
      (compare?.(a, b) ?? 0) || /** @type {number} */ (starts.get(a)) - /** @type {number} */ (starts.get(b)),
  );
}
