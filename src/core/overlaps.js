import { toZonedDateTime } from "./slicing.js";

/**
 * Public read surface over canonical event/background state.
 *
 * Answers "does my new range conflict with an existing event?" and "which
 * events sit in this column?" without reading render internals or scanning
 * the DOM. Comparison is by absolute instant over half-open `[start, end)`
 * ranges, so adjacent ranges (`end === start`) never overlap.
 *
 * @typedef {object} OverlapRange
 * @property {unknown} start range start (`Temporal.ZonedDateTime` or ISO string)
 * @property {unknown} end range end (`Temporal.ZonedDateTime` or ISO string)
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
  const startMs = toZonedDateTime(range.start, timeZone).epochMilliseconds;
  const endMs = toZonedDateTime(range.end, timeZone).epochMilliseconds;
  if (!(endMs > startMs)) return [];

  const scoped = Array.from(resourceIds ?? []);
  /** @type {Array<import("./model.js").NormalizedEvent | import("./model.js").NormalizedBackground>} */
  const hits = [];

  for (const event of events) {
    if (scoped.length > 0 && !scoped.includes(/** @type {string} */ (event.resourceId))) continue;
    const eventStart = toZonedDateTime(event.start, timeZone).epochMilliseconds;
    const eventEnd = toZonedDateTime(event.end, timeZone).epochMilliseconds;
    if (!rangesOverlap(startMs, endMs, eventStart, eventEnd)) continue;
    const entry = { kind: /** @type {"event"} */ ("event"), event };
    if (filter && !filter(entry)) continue;
    hits.push(event);
  }

  if (includeBackgrounds) {
    for (const background of backgrounds) {
      if (scoped.length > 0 && background.resourceId != null && !scoped.includes(background.resourceId)) {
        continue;
      }
      const backgroundStart = toZonedDateTime(background.start, timeZone).epochMilliseconds;
      const backgroundEnd = toZonedDateTime(background.end, timeZone).epochMilliseconds;
      if (!rangesOverlap(startMs, endMs, backgroundStart, backgroundEnd)) continue;
      const entry = { kind: /** @type {"background"} */ ("background"), background };
      if (filter && !filter(entry)) continue;
      hits.push(background);
    }
  }

  return hits;
}
