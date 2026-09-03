import { Temporal } from "temporal-polyfill";
/**
 * Summary month grid. Weeks are full weeks covering the anchor month, from
 * the configured first weekday and without hidden days; leading/trailing
 * days render dimmed. Each cell shows up to `monthEventLimit` chips
 * repeating per overlapped civil day (no spanning bars), then a `+n more`
 * button that reports the day it belongs to rather than proposing a
 * creation. Background ranges are not rendered.
 *
 * Month is solo: events from all resources appear, no resource columns.
 *
 * @param {object} input
 * @param {Temporal.PlainDate[][]} input.weeks
 * @param {number} input.month anchor month number (1-12) for outside detection
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {object} input.options
 * @param {string} [input.options.timeZone]
 * @param {number} [input.options.monthEventLimit]
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.moreLinkContent]
 * @returns {DocumentFragment}
 */
export declare function renderMonthGrid({ weeks, month, events, options, eventContent, moreLinkContent }: {
    weeks: Temporal.PlainDate[][];
    month: number;
    events: import("../core/model.js").NormalizedEvent[];
    options: {
        timeZone?: string;
        monthEventLimit?: number;
    };
    eventContent?: (info: object) => unknown;
    moreLinkContent?: (info: object) => unknown;
}): DocumentFragment;
//# sourceMappingURL=month-grid.d.ts.map