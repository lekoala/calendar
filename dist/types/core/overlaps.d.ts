export type OverlapRange = {
    /**
     * range start (`ZonedDateTime`/ISO string, or `PlainDate` for a civil query)
     */
    start: unknown;
    /**
     * range end (`ZonedDateTime`/ISO string, or `PlainDate` for a civil query)
     */
    end: unknown;
};
export type OverlapEntry = {
    kind: "event" | "background";
    event?: import("./model.js").NormalizedEvent;
    background?: import("./model.js").NormalizedBackground;
};
export type OverlapQuery = {
    events?: Array<import("./model.js").NormalizedEvent>;
    backgrounds?: Array<import("./model.js").NormalizedBackground>;
    range: OverlapRange;
    /**
     * IANA zone used to project boundaries to instants
     */
    timeZone?: string;
    /**
     * keep only entries of these resources; `[]` means no filter
     */
    resourceIds?: string[];
    includeBackgrounds?: boolean;
    filter?: (entry: OverlapEntry) => boolean;
};
export type RangeContextQuery = {
    events?: Array<import("./model.js").NormalizedEvent>;
    backgrounds?: Array<import("./model.js").NormalizedBackground>;
    range: OverlapRange;
    /**
     * IANA zone used to project boundaries to instants
     */
    timeZone?: string;
    /**
     * keep only entries of this resource; nullish means no filter
     */
    resourceId?: string | null;
};
export type RangeContext = {
    events: {
        overlapping: Array<import("./model.js").NormalizedEvent>;
    };
    backgrounds: {
        overlapping: Array<import("./model.js").NormalizedBackground>;
        covering: Array<import("./model.js").NormalizedBackground>;
    };
};
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
 * Canonical range context: what a `{ start, end }` range touches.
 *
 * This is the single definition of "context" in the core. The public
 * `getRangeContext()` exposes it directly, and interaction intents
 * (`calendar:select`, `calendar:eventmove`, `calendar:eventresize`,
 * `calendar:externaldrop`) attach snapshots produced by this primitive to
 * their `detail.context` — never a parallel notion of "under this range".
 *
 * Geometry only: `covering` backgrounds fully wrap the range, `overlapping`
 * ones merely intersect it. Several backgrounds may cover the same range;
 * the core never picks one, priority stays application-side.
 *
 * @typedef {object} RangeContextQuery
 * @property {Array<import("./model.js").NormalizedEvent>} [events]
 * @property {Array<import("./model.js").NormalizedBackground>} [backgrounds]
 * @property {OverlapRange} range
 * @property {string} [timeZone] IANA zone used to project boundaries to instants
 * @property {string | null} [resourceId] keep only entries of this resource; nullish means no filter
 *
 * @typedef {object} RangeContext
 * @property {{ overlapping: Array<import("./model.js").NormalizedEvent> }} events
 * @property {{ overlapping: Array<import("./model.js").NormalizedBackground>, covering: Array<import("./model.js").NormalizedBackground> }} backgrounds
 */
/**
 * @param {RangeContextQuery} query
 * @returns {RangeContext}
 */
export declare function queryRangeContext({ events, backgrounds, range, timeZone, resourceId, }: RangeContextQuery): RangeContext;
/**
 * Half-open instant overlap: `[aStart, aEnd)` meets `[bStart, bEnd)`.
 *
 * @param {number} aStartMs
 * @param {number} aEndMs
 * @param {number} bStartMs
 * @param {number} bEndMs
 * @returns {boolean}
 */
export declare function rangesOverlap(aStartMs: number, aEndMs: number, bStartMs: number, bEndMs: number): boolean;
/**
 * @param {OverlapQuery} query
 * @returns {Array<import("./model.js").NormalizedEvent | import("./model.js").NormalizedBackground>}
 */
export declare function queryOverlaps({ events, backgrounds, range, timeZone, resourceIds, includeBackgrounds, filter, }: OverlapQuery): Array<import("./model.js").NormalizedEvent | import("./model.js").NormalizedBackground>;
//# sourceMappingURL=overlaps.d.ts.map