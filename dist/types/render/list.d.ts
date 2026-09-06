import { Temporal } from "temporal-polyfill";
/**
 * Minimal chronological list over the visible dates. Each day is a group
 * with its overlapped events sorted by start; empty days show a muted row.
 * No drag/resize/select: events are buttons sharing `eventContent` and the
 * `describeEvent` accessible name, Enter/Space fires `calendar:eventclick`.
 *
 * List is solo: events from all resources appear, no resource columns.
 *
 * @param {object} input
 * @param {Temporal.PlainDate[]} input.dates
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {object} input.options
 * @param {string} [input.options.timeZone]
 * @param {string} [input.options.locale] BCP 47 tag for default day headers; hooks stay authoritative
 * @param {import("../core/labels.js").CalendarLabels} [input.options.labels] fixed UI strings, defaulting to English
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.dayHeaderContent]
 * @param {Temporal.ZonedDateTime} [input.now] render instant, cached by the element; falls back to `Temporal.Now`
 * @returns {DocumentFragment}
 */
export declare function renderList({ dates, events, options, now, eventContent, dayHeaderContent }: {
    dates: Temporal.PlainDate[];
    events: import("../core/model.js").NormalizedEvent[];
    options: {
        timeZone?: string;
        locale?: string;
        labels?: import("../core/labels.js").CalendarLabels;
    };
    eventContent?: (info: object) => unknown;
    dayHeaderContent?: (info: object) => unknown;
    now?: Temporal.ZonedDateTime;
}): DocumentFragment;
//# sourceMappingURL=list.d.ts.map