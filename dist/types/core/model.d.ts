/**
 * @typedef {object} CalendarEvent
 * @property {string} id
 * @property {string} [title]
 * @property {unknown} start
 * @property {unknown} end
 * @property {string | null} [resourceId]
 * @property {boolean} [editable]
 * @property {boolean} [movable]
 * @property {boolean} [resizable]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */
export type CalendarEvent = {
    id: string;
    title?: string;
    start: unknown;
    end: unknown;
    resourceId?: string | null;
    editable?: boolean;
    movable?: boolean;
    resizable?: boolean;
    classNames?: string[];
    extendedProps?: Record<string, unknown>;
};
export type NormalizedEvent = Required<Pick<CalendarEvent, "id" | "classNames" | "extendedProps">> & CalendarEvent;
export type EventInput = {
    id?: unknown;
    title?: string;
    start?: unknown;
    end?: unknown;
    resourceId?: string | null;
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
    classNames?: string[];
    extendedProps?: Record<string, unknown>;
};
/**
 * @typedef {Required<Pick<CalendarEvent, "id" | "classNames" | "extendedProps">> & CalendarEvent} NormalizedEvent
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
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */
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
export type NormalizedBackground = Required<Pick<CalendarBackground, "id" | "classNames" | "extendedProps">> & CalendarBackground;
export type BackgroundInput = {
    id?: unknown;
    start?: unknown;
    end?: unknown;
    resourceId?: string;
    classNames?: string[];
    extendedProps?: Record<string, unknown>;
};
/**
 * @typedef {Required<Pick<CalendarBackground, "id" | "classNames" | "extendedProps">> & CalendarBackground} NormalizedBackground
 */
/**
 * @typedef {object} BackgroundInput
 * @property {unknown} [id]
 * @property {unknown} [start]
 * @property {unknown} [end]
 * @property {string} [resourceId]
 * @property {string[]} [classNames]
 * @property {Record<string, unknown>} [extendedProps]
 */
/**
 * @param {BackgroundInput} background
 * @returns {NormalizedBackground}
 */
export declare function normalizeBackground(background: BackgroundInput): NormalizedBackground;
//# sourceMappingURL=model.d.ts.map