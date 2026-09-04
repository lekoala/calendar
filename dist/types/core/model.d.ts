import { Temporal } from "temporal-polyfill";
export type CalendarEvent = {
    id: string;
    title?: string;
    start: unknown;
    end: unknown;
    resourceId?: string | null;
    /**
     * when true, boundaries are civil `Temporal.PlainDate` (half-open `[start, end)`)
     */
    allDay?: boolean;
    editable?: boolean;
    movable?: boolean;
    resizable?: boolean;
    classNames?: string[];
    extendedProps?: Record<string, unknown>;
};
export type NormalizedEvent = Required<Pick<CalendarEvent, "id" | "allDay" | "classNames" | "extendedProps">> & CalendarEvent;
export type EventInput = {
    id?: unknown;
    title?: string;
    start?: unknown;
    end?: unknown;
    resourceId?: string | null;
    allDay?: boolean;
    editable?: boolean;
    movable?: boolean;
    resizable?: boolean;
    classNames?: string[];
    extendedProps?: Record<string, unknown>;
};
export type CalendarResource = {
    id: string;
    title?: string;
    selectable?: boolean;
    droppable?: boolean;
    classNames?: string[];
    extendedProps?: Record<string, unknown>;
};
export type CalendarBackground = {
    id: string;
    start: unknown;
    end: unknown;
    resourceId?: string;
    /**
     * when true, boundaries are civil `Temporal.PlainDate`
     */
    allDay?: boolean;
    classNames?: string[];
    extendedProps?: Record<string, unknown>;
};
/**
 * @typedef {object} CalendarEvent
 * @property {string} id
 * @property {string} [title]
 * @property {unknown} start
 * @property {unknown} end
 * @property {string | null} [resourceId]
 * @property {boolean} [allDay] when true, boundaries are civil `Temporal.PlainDate` (half-open `[start, end)`)
 * @property {boolean} [editable]
 * @property {boolean} [movable]
 * @property {boolean} [resizable]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */
/**
 * @typedef {Required<Pick<CalendarEvent, "id" | "allDay" | "classNames" | "extendedProps">> & CalendarEvent} NormalizedEvent
 */
/**
 * Unvalidated input: sources and application code may pass partial or
 * mistyped payloads, which normalization either completes or rejects.
 *
 * @typedef {object} EventInput
 * @property {unknown} [id]
 * @property {string} [title]
 * @property {unknown} [start]
 * @property {unknown} [end]
 * @property {string | null} [resourceId]
 * @property {boolean} [allDay]
 * @property {boolean} [editable]
 * @property {boolean} [movable]
 * @property {boolean} [resizable]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */
/**
 * @typedef {object} CalendarResource
 * @property {string} id
 * @property {string} [title]
 * @property {boolean} [selectable]
 * @property {boolean} [droppable]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */
/**
 * @typedef {object} CalendarBackground
 * @property {string} id
 * @property {unknown} start
 * @property {unknown} end
 * @property {string} [resourceId]
 * @property {boolean} [allDay] when true, boundaries are civil `Temporal.PlainDate`
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */
/**
 * Canonical boundary value for one event/background end. Timed ranges use
 * `Temporal.ZonedDateTime` instances; all-day ranges use `Temporal.PlainDate`
 * civil dates. Both keep the same half-open `[start, end)` contract, and the
 * conversion is strict: an `allDay` flag never changes the nature of already
 * dated input, and neither type silently accepts the other.
 *
 * @param {unknown} value
 * @param {boolean} allDay
 * @returns {Temporal.ZonedDateTime | Temporal.PlainDate}
 */
export declare function normalizeRangeBound(value: unknown, allDay: boolean): Temporal.ZonedDateTime | Temporal.PlainDate;
/**
 * @param {EventInput} event
 * @returns {NormalizedEvent}
 */
export declare function normalizeEvent(event: EventInput): NormalizedEvent;
/**
 * @param {Partial<CalendarEvent>} event
 * @param {boolean} [calendarEditable]
 * @returns {boolean}
 */
export declare function isMovable(event: Partial<CalendarEvent>, calendarEditable?: boolean): boolean;
/**
 * @param {Partial<CalendarEvent>} event
 * @param {boolean} [calendarEditable]
 * @returns {boolean}
 */
export declare function isResizable(event: Partial<CalendarEvent>, calendarEditable?: boolean): boolean;
export type NormalizedResource = Required<Pick<CalendarResource, "id" | "title" | "classNames" | "extendedProps">> & CalendarResource;
export type ResourceInput = {
    id?: unknown;
    title?: string;
    selectable?: boolean;
    droppable?: boolean;
    classNames?: string[];
    extendedProps?: Record<string, unknown>;
};
/**
 * @typedef {Required<Pick<CalendarResource, "id" | "title" | "classNames" | "extendedProps">> & CalendarResource} NormalizedResource
 */
/**
 * @typedef {object} ResourceInput
 * @property {unknown} [id]
 * @property {string} [title]
 * @property {boolean} [selectable]
 * @property {boolean} [droppable]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */
/**
 * @param {ResourceInput} resource
 * @returns {NormalizedResource}
 */
export declare function normalizeResource(resource: ResourceInput): NormalizedResource;
export type NormalizedBackground = Required<Pick<CalendarBackground, "id" | "allDay" | "classNames" | "extendedProps">> & CalendarBackground;
export type BackgroundInput = {
    id?: unknown;
    start?: unknown;
    end?: unknown;
    resourceId?: string;
    allDay?: boolean;
    classNames?: string[];
    extendedProps?: Record<string, unknown>;
};
/**
 * @typedef {Required<Pick<CalendarBackground, "id" | "allDay" | "classNames" | "extendedProps">> & CalendarBackground} NormalizedBackground
 */
/**
 * @typedef {object} BackgroundInput
 * @property {unknown} [id]
 * @property {unknown} [start]
 * @property {unknown} [end]
 * @property {string} [resourceId]
 * @property {boolean} [allDay]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */
/**
 * @param {BackgroundInput} background
 * @returns {NormalizedBackground}
 */
export declare function normalizeBackground(background: BackgroundInput): NormalizedBackground;
//# sourceMappingURL=model.d.ts.map