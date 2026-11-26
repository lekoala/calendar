import { Temporal } from "temporal-polyfill";
/**
 * All-day lane: the civil plane above the timed grid. It mirrors the time
 * grid's columns, so a bar spans civil days inside one resource block and
 * never crosses into the neighbouring room.
 *
 * The lane is rebuilt with the grid in 0.5. Structural all-day changes
 * (appearance, removal, lane visibility) fall back to a full render, which
 * keeps this module free of an update contract it does not need yet.
 *
 * @param {object} input
 * @param {import("../core/resources.js").TimeGridColumn[]} input.columns
 * @param {Temporal.PlainDate[]} input.dates
 * @param {import("../core/model.js").NormalizedEvent[]} input.events
 * @param {import("../core/model.js").NormalizedBackground[]} input.backgrounds
 * @param {boolean} input.resourceView
 * @param {string} input.timeZone
 * @param {import("../core/labels.js").CalendarLabels} input.labels
 * @param {string} input.gridTemplate
 * @param {import("./time-grid.js").TimeGridHost} input.host
 * @param {(info: object) => unknown} [input.eventContent]
 * @param {(event: import("../core/model.js").NormalizedEvent) => import("../core/temporal.js").TemporalState} input.stateOf
 * @param {{ suppressClick: boolean, longPressConsumed: boolean }} input.interaction
 * @param {(clientX: number) => number} input.columnIndexAtX
 * @param {(target: HTMLElement, onFire: (press: PointerEvent) => void) => void} input.watchLongPress
 * @returns {{ lane: HTMLDivElement, hasContent: boolean, dispose: () => void }}
 */
export declare function createAllDayLane({ columns, dates, events, backgrounds, resourceView, timeZone, labels, gridTemplate, host, eventContent, stateOf, interaction, columnIndexAtX, watchLongPress, }: {
    columns: import("../core/resources.js").TimeGridColumn[];
    dates: Temporal.PlainDate[];
    events: import("../core/model.js").NormalizedEvent[];
    backgrounds: import("../core/model.js").NormalizedBackground[];
    resourceView: boolean;
    timeZone: string;
    labels: import("../core/labels.js").CalendarLabels;
    gridTemplate: string;
    host: import("./time-grid.js").TimeGridHost;
    eventContent?: (info: object) => unknown;
    stateOf: (event: import("../core/model.js").NormalizedEvent) => import("../core/temporal.js").TemporalState;
    interaction: {
        suppressClick: boolean;
        longPressConsumed: boolean;
    };
    columnIndexAtX: (clientX: number) => number;
    watchLongPress: (target: HTMLElement, onFire: (press: PointerEvent) => void) => void;
}): {
    lane: HTMLDivElement;
    hasContent: boolean;
    dispose: () => void;
};
//# sourceMappingURL=all-day-lane.d.ts.map