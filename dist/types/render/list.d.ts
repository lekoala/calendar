import { Temporal } from "temporal-polyfill";
/**
 * Minimal chronological list over the visible dates. Each day is a group
 * with its overlapped rows in `listDayRows` order; days without events show
 * a muted row. No drag/resize/select: events are buttons sharing
 * `eventContent` and the `describeEvent` accessible name, Enter/Space fires
 * `calendar:eventclick`.
 *
 * When `backgrounds` are passed, each overlapping range becomes an inert row
 * (`cv-list-background`): not focusable, no listener, no `calendar:*` event.
 *
 * List is solo: events and backgrounds from all resources appear, no
 * resource columns and no resource filtering.
 *
 * @param {object} input
 * @param {Temporal.PlainDate[]} input.dates
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {import("../core/model.js").NormalizedBackground[]} [input.backgrounds] rendered as inert rows; omit to list events only
 * @param {object} input.options
 * @param {string} [input.options.timeZone]
 * @param {string} [input.options.locale] BCP 47 tag for default day headers; hooks stay authoritative
 * @param {import("../core/labels.js").CalendarLabels} [input.options.labels] fixed UI strings, defaulting to English
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(info: object) => unknown} [input.dayHeaderContent]
 * @param {(info: object) => unknown} [input.backgroundContent]
 * @param {Temporal.ZonedDateTime} [input.now] render instant, cached by the element; falls back to `Temporal.Now`
 * @returns {DocumentFragment}
 */
export declare function renderList({ dates, events, backgrounds, options, now, eventContent, dayHeaderContent, backgroundContent, }: {
    dates: Temporal.PlainDate[];
    events: import("../core/model.js").NormalizedEvent[];
    backgrounds?: import("../core/model.js").NormalizedBackground[];
    options: {
        timeZone?: string;
        locale?: string;
        labels?: import("../core/labels.js").CalendarLabels;
    };
    eventContent?: (info: object) => unknown;
    dayHeaderContent?: (info: object) => unknown;
    backgroundContent?: (info: object) => unknown;
    now?: Temporal.ZonedDateTime;
}): DocumentFragment;
//# sourceMappingURL=list.d.ts.map