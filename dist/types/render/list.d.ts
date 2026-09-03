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
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.dayHeaderContent]
 * @returns {DocumentFragment}
 */
export declare function renderList({ dates, events, options, eventContent, dayHeaderContent }: {
    dates: Temporal.PlainDate[];
    events: import("../core/model.js").NormalizedEvent[];
    options: {
        timeZone?: string;
    };
    eventContent?: (info: object) => unknown;
    dayHeaderContent?: (info: object) => unknown;
}): DocumentFragment;
//# sourceMappingURL=list.d.ts.map