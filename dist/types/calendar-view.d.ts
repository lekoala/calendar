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
    eventSource?: (query: EventSourceQuery) => Promise<unknown[]>;
    backgroundSource?: (query: EventSourceQuery) => Promise<unknown[]>;
    eventContent?: (info: object) => unknown;
    dayHeaderContent?: (info: object) => unknown;
    resourceHeaderContent?: (info: object) => unknown;
    slotLabelContent?: (info: object) => unknown;
    moreLinkContent?: (info: object) => unknown;
};
export declare class CalendarViewElement extends HTMLElement {
    #private;
    static observedAttributes: string[];
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
     * @template T
     * @param {() => T} callback
     * @returns {T}
     */
    batch<T>(callback: () => T): T;
    refetchEvents(): Promise<void>;
}
//# sourceMappingURL=calendar-view.d.ts.map