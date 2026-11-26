/**
 * Clip timed ranges to one column and compute their positions before painting.
 *
 * @param {import("./resources.js").TimeGridColumn} column
 * @param {import("./model.js").NormalizedEvent[]} events
 * @param {import("./model.js").NormalizedBackground[]} backgrounds
 * @param {{ timeZone: string, slotMin: number, slotMax: number, pxPerMinute: number }} options
 */
export declare function deriveTimedColumn(column: import("./resources.js").TimeGridColumn, events: import("./model.js").NormalizedEvent[], backgrounds: import("./model.js").NormalizedBackground[], options: {
    timeZone: string;
    slotMin: number;
    slotMax: number;
    pxPerMinute: number;
}): {
    events: {
        event: import("./model.js").NormalizedEvent;
        start: number;
        end: number;
        column: number;
        columns: number;
        left: number;
        width: number;
        geometry: {
            top: number;
            height: number;
        };
    }[];
    backgrounds: {
        start: number;
        end: number;
        background: import("./model.js").NormalizedBackground;
        geometry: {
            top: number;
            height: number;
        };
    }[];
};
//# sourceMappingURL=time-grid-model.d.ts.map