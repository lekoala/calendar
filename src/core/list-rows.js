import { Temporal } from "temporal-polyfill";
import { eventOverlapsDate, instantRangeOf, sliceRangeForDay } from "./slicing.js";

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
export function listDayRows({ date, events, backgrounds = [], timeZone }) {
  const dayStart = date.toZonedDateTime(timeZone);
  const dayEnd = date.add({ days: 1 }).toZonedDateTime(timeZone);

  /** @type {ListRow[]} */
  const rows = [];

  /**
   * @param {ListItem[]} entries
   */
  const collect = (entries) => {
    for (const entry of entries) {
      const { item } = entry;
      if (!eventOverlapsDate(item, date, timeZone)) continue;
      if (item.start instanceof Temporal.PlainDate) {
        rows.push({ ...entry, allDay: true, start: null, end: null, coversDay: true, span: null });
        continue;
      }
      const range = instantRangeOf(item.start, item.end, timeZone);
      const start = Temporal.ZonedDateTime.compare(range.start, dayStart) < 0 ? dayStart : range.start;
      const end = Temporal.ZonedDateTime.compare(range.end, dayEnd) > 0 ? dayEnd : range.end;
      if (Temporal.ZonedDateTime.compare(end, start) <= 0) continue;
      const coversDay = start.equals(dayStart) && end.equals(dayEnd);
      const span = sliceRangeForDay({ start, end, date, timeZone, slotMin: 0, slotMax: 1440 });
      rows.push({ ...entry, allDay: false, start, end, coversDay, span });
    }
  };
  collect(events.map((item) => ({ kind: "event", item })));
  collect(backgrounds.map((item) => ({ kind: "background", item })));

  rows.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (!a.allDay && a.start && b.start) {
      const byStart = Temporal.ZonedDateTime.compare(a.start, b.start);
      if (byStart !== 0) return byStart;
    }
    if (a.kind !== b.kind) return a.kind === "background" ? -1 : 1;
    // Array.prototype.sort is stable: equal rows keep input order.
    return 0;
  });

  return rows;
}

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
export function listedBackgrounds(backgrounds, option) {
  if (typeof option === "function") return backgrounds.filter((background) => option(background) === true);
  if (option === true) return [...backgrounds];
  return undefined;
}
