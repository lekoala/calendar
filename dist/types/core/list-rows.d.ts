import { Temporal } from "temporal-polyfill";
export type ListItem = {
    kind: "event";
    item: import("./model.js").NormalizedEvent;
} | {
    kind: "background";
    item: import("./model.js").NormalizedBackground;
};
export type ListPortion = {
    /**
     * true for civil (`PlainDate`) ranges
     */
    allDay: boolean;
    /**
     * start of the day's portion (clipped to the day), null when all-day
     */
    start: Temporal.ZonedDateTime | null;
    /**
     * end of the day's portion (clipped to the next midnight), null when all-day
     */
    end: Temporal.ZonedDateTime | null;
    /**
     * true when the item fills the whole civil day
     */
    coversDay: boolean;
    /**
     * display wall minutes, using the grid's repeated-hour projection
     */
    span: {
        start: number;
        end: number;
    } | null;
};
export type ListRow = ListItem & ListPortion;
/**
 * One row of a list day group: an event or a background range, with its
 * portion of the represented day.
 *
 * @typedef {{ kind: "event", item: import("./model.js").NormalizedEvent } | { kind: "background", item: import("./model.js").NormalizedBackground }} ListItem
 * @typedef {object} ListPortion
 * @property {boolean} allDay true for civil (`PlainDate`) ranges
 * @property {Temporal.ZonedDateTime | null} start start of the day's portion (clipped to the day), null when all-day
 * @property {Temporal.ZonedDateTime | null} end end of the day's portion (clipped to the next midnight), null when all-day
 * @property {boolean} coversDay true when the item fills the whole civil day
 * @property {{ start: number, end: number } | null} span display wall minutes, using the grid's repeated-hour projection
 * @typedef {ListItem & ListPortion} ListRow
 */
/**
 * Rows of one list day, in display order:
 *
 * 1. all-day rows first;
 * 2. then timed rows by the start of their portion of this day, so a range
 *    that began the day before sorts at midnight, not at its original start;
 * 3. on a tie, backgrounds before events (context before content);
 * 4. then input order.
 *
 * No resource filtering: list is a solo view and shows what it is given.
 *
 * @param {object} input
 * @param {Temporal.PlainDate} input.date
 * @param {readonly import("./model.js").NormalizedEvent[]} input.events
 * @param {readonly import("./model.js").NormalizedBackground[]} [input.backgrounds]
 * @param {string} input.timeZone
 * @returns {ListRow[]}
 */
export declare function listDayRows({ date, events, backgrounds, timeZone }: {
    date: Temporal.PlainDate;
    events: readonly import("./model.js").NormalizedEvent[];
    backgrounds?: readonly import("./model.js").NormalizedBackground[];
    timeZone: string;
}): ListRow[];
/**
 * Backgrounds the list view represents as rows. Backgrounds are geometry in
 * grids, so the list opts in: `true` lists every range, a predicate lets the
 * application keep only the ranges worth a row (the shared collection still
 * feeds the grids unchanged). Anything else lists none.
 *
 * @param {readonly import("./model.js").NormalizedBackground[]} backgrounds
 * @param {unknown} option the `listBackgrounds` configuration value
 * @returns {import("./model.js").NormalizedBackground[] | undefined}
 */
export declare function listedBackgrounds(backgrounds: readonly import("./model.js").NormalizedBackground[], option: unknown): import("./model.js").NormalizedBackground[] | undefined;
//# sourceMappingURL=list-rows.d.ts.map