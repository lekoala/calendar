import { Temporal } from "temporal-polyfill";
export type TimeGridHost = {
    editable?: boolean;
    isConnected: () => boolean;
    announce: (message: string) => void;
    refocusEvent: (id: string) => void;
    commitEventMove: (input: {
        event: import("../core/model.js").NormalizedEvent;
        previous: {
            start: unknown;
            end: unknown;
            resourceId: string | null;
        };
        current: {
            start: unknown;
            end: unknown;
            resourceId: string | null;
        };
        nativeEvent: Event | null;
    }) => import("../core/model.js").NormalizedEvent | null;
    commitEventResize: (input: {
        event: import("../core/model.js").NormalizedEvent;
        previous: {
            start: unknown;
            end: unknown;
            resourceId: string | null;
        };
        current: {
            start: unknown;
            end: unknown;
            resourceId: string | null;
        };
        nativeEvent: Event | null;
    }) => import("../core/model.js").NormalizedEvent | null;
};
export type TimeGridColumn = {
    date: Temporal.PlainDate;
    resource: import("../core/model.js").CalendarResource | null;
};
export type TimeGridOptions = {
    slotMin: string;
    slotMax: string;
    pxPerMinute: number;
    timeZone?: string;
    editable?: boolean;
    snapDuration?: Temporal.Duration | {
        minutes: number;
    };
    defaultTimedEventDuration?: Temporal.Duration | {
        minutes: number;
    };
    /**
     * minutes between axis labels (default 60)
     */
    slotLabelInterval?: number;
};
export type ActiveSelection = {
    anchor: number;
    downX: number;
    downY: number;
    moved: boolean;
    start: number;
    end: number;
};
/**
 * Narrow host seam between the element and the renderer. The grid never
 * touches element internals: the class injects bound callbacks, so its own
 * state and helpers can stay truly private (`#field`).
 *
 * @typedef {object} TimeGridHost
 * @property {boolean} [editable]
 * @property {() => boolean} isConnected
 * @property {(message: string) => void} announce
 * @property {(id: string) => void} refocusEvent
 * @property {(input: {
 *   event: import("../core/model.js").NormalizedEvent,
 *   previous: { start: unknown, end: unknown, resourceId: string | null },
 *   current: { start: unknown, end: unknown, resourceId: string | null },
 *   nativeEvent: Event | null,
 * }) => import("../core/model.js").NormalizedEvent | null} commitEventMove
 * @property {(input: {
 *   event: import("../core/model.js").NormalizedEvent,
 *   previous: { start: unknown, end: unknown, resourceId: string | null },
 *   current: { start: unknown, end: unknown, resourceId: string | null },
 *   nativeEvent: Event | null,
 * }) => import("../core/model.js").NormalizedEvent | null} commitEventResize
 */
/**
 * @typedef {object} TimeGridColumn
 * @property {Temporal.PlainDate} date
 * @property {import("../core/model.js").CalendarResource | null} resource
 */
/**
 * @typedef {object} TimeGridOptions
 * @property {string} slotMin
 * @property {string} slotMax
 * @property {number} pxPerMinute
 * @property {string} [timeZone]
 * @property {boolean} [editable]
 * @property {Temporal.Duration | { minutes: number }} [snapDuration]
 * @property {Temporal.Duration | { minutes: number }} [defaultTimedEventDuration]
 * @property {number} [slotLabelInterval] minutes between axis labels (default 60)
 */
/**
 * @typedef {object} ActiveSelection
 * @property {number} anchor
 * @property {number} downX
 * @property {number} downY
 * @property {boolean} moved
 * @property {number} start
 * @property {number} end
 */
/**
 * @param {object} input
 * @param {Temporal.PlainDate[]} input.dates
 * @param {import("../core/model.js").CalendarResource[]} input.resources
 * @param {string} [input.view] view name; resource columns derive only when it is a resource view
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {import("../core/model.js").NormalizedBackground[]} input.backgrounds
 * @param {TimeGridOptions} input.options
 * @param {TimeGridHost} input.host
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.dayHeaderContent]
 * @param {(info: object) => unknown} [input.resourceHeaderContent]
 * @param {(info: object) => unknown} [input.slotLabelContent]
 * @returns {DocumentFragment}
 */
export declare function renderTimeGrid({ dates, resources, view, events, backgrounds, options, host, eventContent, dayHeaderContent, resourceHeaderContent, slotLabelContent, }: {
    dates: Temporal.PlainDate[];
    resources: import("../core/model.js").CalendarResource[];
    view?: string;
    events: import("../core/model.js").NormalizedEvent[];
    backgrounds: import("../core/model.js").NormalizedBackground[];
    options: TimeGridOptions;
    host: TimeGridHost;
    eventContent?: (info: object) => unknown;
    dayHeaderContent?: (info: object) => unknown;
    resourceHeaderContent?: (info: object) => unknown;
    slotLabelContent?: (info: object) => unknown;
}): DocumentFragment;
//# sourceMappingURL=time-grid.d.ts.map