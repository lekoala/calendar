/**
 * Fixed UI strings rendered by the core. `locale` drives `Intl` date/time
 * formatting; `labels` drives the few remaining literal strings (empty
 * states, the `+n more` fallback, the region name, the untitled fallback).
 * English ships as the default; applications override per instance through
 * `configure({ labels })`. There is deliberately no async loader here:
 * fetching a translation file is transport and belongs to the application.
 *
 * @typedef {object} CalendarLabels
 * @property {string} noEvents text of an empty list day group
 * @property {string} noResources text when a resource view has no columns
 * @property {string} more month `+n more` fallback template, with a `{hidden}` placeholder
 * @property {string} calendarRegion accessible name of the scroll region
 * @property {string} untitledEvent fallback title for events without one
 */
export type CalendarLabels = {
    /**
     * text of an empty list day group
     */
    noEvents: string;
    /**
     * text when a resource view has no columns
     */
    noResources: string;
    /**
     * month `+n more` fallback template, with a `{hidden}` placeholder
     */
    more: string;
    /**
     * accessible name of the scroll region
     */
    calendarRegion: string;
    /**
     * fallback title for events without one
     */
    untitledEvent: string;
};
/** @type {CalendarLabels} */
export declare const DEFAULT_LABELS: CalendarLabels;
/**
 * Fill a label template. Unknown placeholders render empty rather than
 * leaking `{key}` into the UI.
 *
 * @param {string} template
 * @param {Record<string, string | number>} values
 * @returns {string}
 */
export declare function formatLabel(template: string, values: Record<string, string | number>): string;
/**
 * Merge an instance override over the shipped English defaults. Explicit
 * labels always win over locale-derived formatting.
 *
 * @param {Partial<CalendarLabels> | null | undefined} [input]
 * @returns {CalendarLabels}
 */
export declare function resolveLabels(input?: Partial<CalendarLabels> | null | undefined): CalendarLabels;
//# sourceMappingURL=labels.d.ts.map