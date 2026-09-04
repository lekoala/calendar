import { instantRangeOf } from "./slicing.js";

/**
 * Public read surface over canonical event/background state.
 *
 * Answers "does my new range conflict with an existing event?" and "which
 * events sit in this column?" without reading render internals or scanning
 * the DOM. Comparison is by absolute instant over half-open `[start, end)`
 * ranges, so adjacent ranges (`end === start`) never overlap.
 *
 * Query and stored boundaries may be timed (`ZonedDateTime` / ISO strings
 * with a zone) or civil (`PlainDate` / `YYYY-MM-DD` strings): civil values
 * project to their local midnights in `timeZone`, which is how an all-day
 * event and a timed booking on the same day meet.
 *
 * @typedef {object} OverlapRange
 * @property {unknown} start range start (`ZonedDateTime`/ISO string, or `PlainDate` for a civil query)
 * @property {unknown} end range end (`ZonedDateTime`/ISO string, or `PlainDate` for a civil query)
 *
 * @typedef {object} OverlapEntry
 * @property {"event" | "background"} kind
 * @property {import("./model.js").NormalizedEvent} [event]
 * @property {import("./model.js").NormalizedBackground} [background]
 *
 * @typedef {object} OverlapQuery
 * @property {Array<import("./model.js").NormalizedEvent>} [events]
 * @property {Array<import("./model.js").NormalizedBackground>} [backgrounds]
 * @property {OverlapRange} range
 * @property {string} [timeZone] IANA zone used to project boundaries to instants
 * @property {string[]} [resourceIds] keep only entries of these resources; `[]` means no filter
 * @property {boolean} [includeBackgrounds]
 * @property {(entry: OverlapEntry) => boolean} [filter]
 */

/**
 * Half-open instant overlap: `[aStart, aEnd)` meets `[bStart, bEnd)`.
 *
 * @param {number} aStartMs
 * @param {number} aEndMs
 * @param {number} bStartMs
 * @param {number} bEndMs
 * @returns {boolean}
 */
export function rangesOverlap(aStartMs, aEndMs, bStartMs, bEndMs) {
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/**
 * @param {OverlapQuery} query
 * @returns {Array<import("./model.js").NormalizedEvent | import("./model.js").NormalizedBackground>}
 */
export function queryOverlaps({
  events = [],
  backgrounds = [],
  range,
  timeZone = "UTC",
  resourceIds = [],
  includeBackgrounds = false,
  filter,
}) {
  if (!range || range.start == null || range.end == null) {
    throw new TypeError("getEventOverlaps requires { start, end }");
  }
  const { start: startInstant, end: endInstant } = instantRangeOf(range.start, range.end, timeZone);
  const startMs = startInstant.epochMilliseconds;
  const endMs = endInstant.epochMilliseconds;
  if (!(endMs > startMs)) return [];

  const scoped = Array.from(resourceIds ?? []);
  /** @type {Array<import("./model.js").NormalizedEvent | import("./model.js").NormalizedBackground>} */
  const hits = [];

  for (const event of events) {
    if (scoped.length > 0 && !scoped.includes(/** @type {string} */ (event.resourceId))) continue;
    const { start: eventStart, end: eventEnd } = instantRangeOf(event.start, event.end, timeZone);
    if (!rangesOverlap(startMs, endMs, eventStart.epochMilliseconds, eventEnd.epochMilliseconds)) continue;
    const entry = { kind: /** @type {"event"} */ ("event"), event };
    if (filter && !filter(entry)) continue;
    hits.push(event);
  }

  if (includeBackgrounds) {
    for (const background of backgrounds) {
      if (scoped.length > 0 && background.resourceId != null && !scoped.includes(background.resourceId)) {
        continue;
      }
      const { start: backgroundStart, end: backgroundEnd } = instantRangeOf(
        background.start,
        background.end,
        timeZone,
      );
      if (
        !rangesOverlap(startMs, endMs, backgroundStart.epochMilliseconds, backgroundEnd.epochMilliseconds)
      ) {
        continue;
      }
      const entry = { kind: /** @type {"background"} */ ("background"), background };
      if (filter && !filter(entry)) continue;
      hits.push(background);
    }
  }

  return hits;
}
