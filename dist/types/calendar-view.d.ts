import { Temporal } from "temporal-polyfill";
export type EventSourceQuery = {
    start: Temporal.PlainDate;
    end: Temporal.PlainDate;
    resourceIds: string[];
    signal: AbortSignal;
    calendar: CalendarViewElement;
};
export type CalendarConfig = {
    timeZone?: string;
    /**
     * BCP 47 tag for default header/axis formatting and `firstDay` suggestion; content hooks stay authoritative
     */
    locale?: string;
    /**
     * fixed UI strings merged over the English defaults
     */
    labels?: Partial<import("./core/labels.js").CalendarLabels>;
    pxPerMinute?: number;
    snapDuration?: Temporal.Duration | {
        minutes: number;
    };
    defaultTimedEventDuration?: Temporal.Duration | {
        minutes: number;
    };
    /**
     * event chips per month day cell before `+n more`
     */
    monthEventLimit?: number;
    /**
     * first weekday of a civil week, ISO 1-7 (default 1, Monday)
     */
    firstDay?: number;
    /**
     * weekdays never rendered, ISO 1-7
     */
    hiddenDays?: number[];
    /**
     * minutes between time axis labels (default 60)
     */
    slotLabelInterval?: number;
    editable?: boolean;
    /**
     * show the all-day lane in time grids when it has content (default true)
     */
    allDaySlot?: boolean;
    eventSource?: (query: EventSourceQuery) => Promise<unknown[]>;
    backgroundSource?: (query: EventSourceQuery) => Promise<unknown[]>;
    eventContent?: (info: object) => unknown;
    dayHeaderContent?: (info: object) => unknown;
    resourceHeaderContent?: (info: object) => unknown;
    slotLabelContent?: (info: object) => unknown;
    moreLinkContent?: (info: object) => unknown;
    /**
     * synchronous gate for user-originated interactions (pointer, keyboard, external drop, selection); programmatic mutations never consult it
     */
    interactionPolicy?: (decision: InteractionPolicyInput) => boolean | string | null | undefined;
};
export type InteractionPolicyInput = {
    /**
     * the proposed interaction; `select` and `external` carry no existing event
     */
    action: "select" | "move" | "resize" | "external";
    /**
     * the acted-on event, or null for select/external
     */
    event: import("./core/model.js").NormalizedEvent | null;
    /**
     * the proposed placement
     */
    target: InteractionPolicyTarget;
    /**
     * canonical range context of the proposed range
     */
    context: import("./core/overlaps.js").RangeContext;
    /**
     * the moment the decision is taken
     */
    now: Temporal.ZonedDateTime;
};
export type InteractionPolicyTarget = {
    /**
     * proposed range start (zoned timed, civil all-day)
     */
    start: unknown;
    /**
     * proposed range end (zoned timed, civil all-day)
     */
    end: unknown;
    /**
     * winner civil date
     */
    date: Temporal.PlainDate;
    /**
     * proposed start as an instant for timed ranges, null for all-day
     */
    time: Temporal.ZonedDateTime | null;
    /**
     * proposed resource, or null
     */
    resourceId: string | null;
    /**
     * true for all-day lane placements
     */
    allDay: boolean;
};
export type ExternalDropMeta = {
    /**
     * preview length in the time grid (defaults to `defaultTimedEventDuration`)
     */
    duration?: Temporal.Duration | {
        minutes: number;
    } | number;
    /**
     * force the all-day lane as the target
     */
    allDay?: boolean;
    /**
     * preview label
     */
    title?: string;
    /**
     * application policy on the target; a string is the refusal reason
     */
    validate?: (target: {
        date: Temporal.PlainDate;
        time: Temporal.ZonedDateTime | null;
        resourceId: string | null;
        allDay: boolean;
    }) => boolean | string | null | undefined;
};
/**
 * Civil date helpers shared with the main grid, exposed for external
 * navigators (mini-calendars, custom headers). One object with two access
 * paths: ESM `import { dates } from "…"`, and classic scripts
 * `customElements.get("calendar-view").dates` — the element static is the
 * very same reference, so nothing is re-wrapped.
 *
 * @type {{
 *   getMonthWeeks(
 *     date: Temporal.PlainDate | string,
 *     options?: { firstDay?: number, hiddenDays?: Iterable<number>, locale?: string },
 *   ): Temporal.PlainDate[][],
 *   startOfWeek(date: Temporal.PlainDate | string, firstDay?: number): Temporal.PlainDate,
 *   toPlainDate(value: Temporal.PlainDate | string): Temporal.PlainDate,
 * }}
 */
export declare const dates: {
    getMonthWeeks(date: Temporal.PlainDate | string, options?: {
        firstDay?: number;
        hiddenDays?: Iterable<number>;
        locale?: string;
    }): Temporal.PlainDate[][];
    startOfWeek(date: Temporal.PlainDate | string, firstDay?: number): Temporal.PlainDate;
    toPlainDate(value: Temporal.PlainDate | string): Temporal.PlainDate;
};
export declare class CalendarViewElement extends HTMLElement {
    #private;
    static observedAttributes: string[];
    /** Pass-through for the shared civil helpers, same reference as the ESM `dates` export. */
    static dates: {
        getMonthWeeks(date: Temporal.PlainDate | string, options?: {
            firstDay?: number;
            hiddenDays?: Iterable<number>;
            locale?: string;
        }): Temporal.PlainDate[][];
        startOfWeek(date: Temporal.PlainDate | string, firstDay?: number): Temporal.PlainDate;
        toPlainDate(value: Temporal.PlainDate | string): Temporal.PlainDate;
    };
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(): void;
    /**
     * @param {Partial<CalendarConfig>} [options]
     * @returns {this}
     */
    configure(options?: Partial<CalendarConfig>): this;
    get view(): string;
    /** @param {string} value */
    set view(value: string);
    /**
     * @returns {Temporal.PlainDate}
     */
    get date(): Temporal.PlainDate;
    /** @param {Temporal.PlainDate | string} value */
    set date(value: Temporal.PlainDate | string);
    get events(): import("./core/model.js").EventInput[] | null | undefined;
    /** @param {import("./core/model.js").EventInput[] | null | undefined} value */
    set events(value: import("./core/model.js").EventInput[] | null | undefined);
    get resources(): import("./core/model.js").ResourceInput[] | null | undefined;
    /** @param {import("./core/model.js").ResourceInput[] | null | undefined} value */
    set resources(value: import("./core/model.js").ResourceInput[] | null | undefined);
    get backgrounds(): import("./core/model.js").BackgroundInput[] | null | undefined;
    /** @param {import("./core/model.js").BackgroundInput[] | null | undefined} value */
    set backgrounds(value: import("./core/model.js").BackgroundInput[] | null | undefined);
    /**
     * @param {string} view
     * @returns {void}
     */
    setView(view: string): void;
    /**
     * @param {Temporal.PlainDate | string} value
     * @returns {void}
     */
    gotoDate(value: Temporal.PlainDate | string): void;
    getVisibleRange(): {
        start: Temporal.PlainDate;
        end: Temporal.PlainDate;
    };
    prev(): void;
    next(): void;
    today(): void;
    /**
     * @param {Temporal.PlainTime | string} value
     * @returns {number}
     */
    scrollToTime(value: Temporal.PlainTime | string): number;
    /**
     * @param {string | number} id
     * @returns {import("./core/model.js").NormalizedEvent | null}
     */
    getEventById(id: string | number): import("./core/model.js").NormalizedEvent | null;
    /**
     * Public read surface over canonical state: events (and optionally
     * backgrounds) overlapping `{ start, end }`, in paint order, or `[]`.
     * Comparison is by absolute instant over half-open ranges; `resourceIds`
     * scopes by resource (`[]` means no filter, resource-less backgrounds are
     * global and match any scope); `filter({ kind, event, background })`
     * narrows further without reading class arrays.
     *
     * @param {{ start: unknown, end: unknown }} range
     * @param {{ resourceIds?: string[], includeBackgrounds?: boolean, filter?: (entry: { kind: "event" | "background", event?: import("./core/model.js").NormalizedEvent, background?: import("./core/model.js").NormalizedBackground }) => boolean }} [options]
     * @returns {Array<import("./core/model.js").NormalizedEvent | import("./core/model.js").NormalizedBackground>}
     */
    getEventOverlaps(range: {
        start: unknown;
        end: unknown;
    }, options?: {
        resourceIds?: string[];
        includeBackgrounds?: boolean;
        filter?: (entry: {
            kind: "event" | "background";
            event?: import("./core/model.js").NormalizedEvent;
            background?: import("./core/model.js").NormalizedBackground;
        }) => boolean;
    }): Array<import("./core/model.js").NormalizedEvent | import("./core/model.js").NormalizedBackground>;
    /**
     * Canonical range context over canonical state: what `{ start, end }`
     * touches. `events.overlapping` is a plain intersection;
     * `backgrounds.covering` fully wraps the range while
     * `backgrounds.overlapping` merely intersects it. Comparison is by
     * absolute instant over half-open ranges; a nullish `resourceId` means no
     * filter, resource-less backgrounds are global and match any scope.
     *
     * This is the single definition of "context": interaction intents attach
     * snapshots produced here to their `detail.context`. Geometry only — when
     * several backgrounds cover the same range, priority stays
     * application-side.
     *
     * @param {{ start: unknown, end: unknown, resourceId?: string | null }} range
     * @returns {import("./core/overlaps.js").RangeContext}
     */
    getRangeContext(range: {
        start: unknown;
        end: unknown;
        resourceId?: string | null;
    }): import("./core/overlaps.js").RangeContext;
    /**
     * Single evaluation path for user-originated interactions (pointer,
     * keyboard, external drop, selection). Resolves the canonical context of
     * the proposed range, takes a fresh `now`, and normalizes the application
     * answer to `{ ok, reason }`. Strictly synchronous: server validation
     * stays in the commit/revert path. Programmatic mutations
     * (`moveEvent`/`resizeEvent`/`removeEvent`) never call this.
     *
     * @param {object} input
     * @param {"select" | "move" | "resize" | "external"} input.action
     * @param {import("./core/model.js").NormalizedEvent | null} input.event
     * @param {unknown} input.start proposed range start
     * @param {unknown} input.end proposed range end
     * @param {string | null} input.resourceId
     * @param {boolean} [input.allDay]
     * @returns {import("./core/policy.js").PolicyDecision}
     */
    checkInteraction({ action, event, start, end, resourceId, allDay }: {
        action: "select" | "move" | "resize" | "external";
        event: import("./core/model.js").NormalizedEvent | null;
        start: unknown;
        end: unknown;
        resourceId: string | null;
        allDay?: boolean;
    }): import("./core/policy.js").PolicyDecision;
    /**
     * Non-pointer equivalent of dragging an event. Runs the same optimistic
     * commit as the pointer path, so keyboard and application commands share
     * one contract.
     *
     * @param {string | number} id
     * @param {{ start?: unknown, end?: unknown, resourceId?: string | null }} current
     * @returns {import("./core/model.js").NormalizedEvent | null}
     */
    moveEvent(id: string | number, current: {
        start?: unknown;
        end?: unknown;
        resourceId?: string | null;
    }): import("./core/model.js").NormalizedEvent | null;
    /**
     * Non-pointer equivalent of resizing an event. Runs the same optimistic
     * commit as the pointer path.
     *
     * @param {string | number} id
     * @param {{ start?: unknown, end?: unknown }} current
     * @returns {import("./core/model.js").NormalizedEvent | null}
     */
    resizeEvent(id: string | number, current: {
        start?: unknown;
        end?: unknown;
    }): import("./core/model.js").NormalizedEvent | null;
    /**
     * @param {import("./core/model.js").EventInput} event
     * @returns {import("./core/model.js").NormalizedEvent}
     */
    addEvent(event: import("./core/model.js").EventInput): import("./core/model.js").NormalizedEvent;
    /**
     * @param {import("./core/model.js").EventInput} event
     * @returns {import("./core/model.js").NormalizedEvent}
     */
    updateEvent(event: import("./core/model.js").EventInput): import("./core/model.js").NormalizedEvent;
    /**
     * @param {string | number} id
     * @returns {boolean}
     */
    removeEvent(id: string | number): boolean;
    /**
     * Register an application-owned element as an external drop source
     * (external placement). The element becomes
     * `draggable`; while it is dragged over the rendered grid, the core draws
     * a placement preview from `meta` and, on a real drop, dispatches
     * `calendar:externaldrop` with the opaque `payload` and the resolved
     * target anchor. The calendar never interprets the payload.
     *
     * @param {HTMLElement} element
     * @param {unknown} payload opaque to the calendar
     * @param {ExternalDropMeta} [meta]
     * @returns {this}
     */
    addExternalDrop(element: HTMLElement, payload: unknown, meta?: ExternalDropMeta): this;
    /**
     * @param {HTMLElement} element
     * @returns {boolean} true when a source was removed
     */
    removeExternalDrop(element: HTMLElement): boolean;
    /**
     * @template T
     * @param {() => T} callback
     * @returns {T}
     */
    batch<T>(callback: () => T): T;
    refetchEvents(): Promise<void>;
}
//# sourceMappingURL=calendar-view.d.ts.map