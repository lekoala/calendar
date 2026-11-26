export type TimeGridHost = import("./time-grid.js").TimeGridHost;
/** @typedef {import("./time-grid.js").TimeGridHost} TimeGridHost */
/**
 * Bind native drag events and return the pointer placement callbacks for
 * the same grid. Both routes resolve and validate the same placement.
 *
 * @param {object} input
 * @param {HTMLDivElement} input.root
 * @param {HTMLDivElement} input.lane
 * @param {import("../core/resources.js").TimeGridColumn[]} input.columns
 * @param {Array<{ body: HTMLDivElement }>} input.bodies
 * @param {(x: number) => number} input.columnIndexAtX
 * @param {(x: number, y: number) => ReturnType<typeof import("../core/hit.js").hitTest>} input.gridHit
 * @param {number} input.startMinutes
 * @param {number} input.endMinutes
 * @param {number} input.pxPerMinute
 * @param {number} input.defaultDuration
 * @param {number} input.snapStep
 * @param {string} input.timeZone
 * @param {Pick<TimeGridHost, "getExternalDrag" | "getInteractionRevision" | "checkInteraction" | "getRangeContext">} input.host
 * @returns {import("./time-grid.js").ExternalDropTarget}
 */
export declare function bindExternalPlacement({ root, lane, columns, bodies, columnIndexAtX, gridHit, startMinutes, endMinutes, pxPerMinute, defaultDuration, snapStep, timeZone, host, }: {
    root: HTMLDivElement;
    lane: HTMLDivElement;
    columns: import("../core/resources.js").TimeGridColumn[];
    bodies: Array<{
        body: HTMLDivElement;
    }>;
    columnIndexAtX: (x: number) => number;
    gridHit: (x: number, y: number) => ReturnType<typeof import("../core/hit.js").hitTest>;
    startMinutes: number;
    endMinutes: number;
    pxPerMinute: number;
    defaultDuration: number;
    snapStep: number;
    timeZone: string;
    host: Pick<TimeGridHost, "getExternalDrag" | "getInteractionRevision" | "checkInteraction" | "getRangeContext">;
}): import("./time-grid.js").ExternalDropTarget;
//# sourceMappingURL=external-placement.d.ts.map