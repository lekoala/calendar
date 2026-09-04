/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * @param {number} minutes
 * @param {number} step
 * @param {"round" | "floor" | "ceil"} [mode]
 * @returns {number}
 */
export declare function snapMinutes(minutes: number, step: number, mode?: "round" | "floor" | "ceil"): number;
/**
 * Default neighbor-snapping threshold: half a snap step, capped at 5 minutes
 * so coarse grids do not attract across large distances.
 *
 * @param {number} snapStep snap step in minutes
 * @returns {number}
 */
export declare function defaultSnapThreshold(snapStep: number): number;
/**
 * Neighbor snapping (magnetism): return the nearest boundary in `edges`
 * within `threshold` minutes of the raw pointer position, or `null` when
 * nothing is close enough and the grid snap should apply instead.
 *
 * Comparison is intentionally made on the raw position, not on the already
 * grid-snapped value, so near-misses still attract: e.g. with 20-minute
 * slots and a predecessor ending at 10:10, a pointer at 10:12 snaps to
 * 10:10 rather than flooring to 10:00.
 *
 * @param {number} minutes raw position in minutes from midnight
 * @param {number[]} edges neighboring boundaries in minutes from midnight
 * @param {number} threshold attraction distance in minutes
 * @returns {number | null}
 */
export declare function findSnapTarget(minutes: number, edges: number[], threshold: number): number | null;
/**
 * @param {number} minutes
 * @param {number} pxPerMinute
 * @returns {number}
 */
export declare function minutesToPixels(minutes: number, pxPerMinute: number): number;
/**
 * @param {number} pixels
 * @param {number} pxPerMinute
 * @returns {number}
 */
export declare function pixelsToMinutes(pixels: number, pxPerMinute: number): number;
export type EventGeometryInput = {
    startMinutes: number;
    endMinutes: number;
    dayStartMinutes: number;
    pxPerMinute: number;
    gap?: number;
};
/**
 * @typedef {object} EventGeometryInput
 * @property {number} startMinutes
 * @property {number} endMinutes
 * @property {number} dayStartMinutes
 * @property {number} pxPerMinute
 * @property {number} [gap]
 */
/**
 * @param {EventGeometryInput} input
 * @returns {{ top: number, height: number }}
 */
export declare function eventGeometry({ startMinutes, endMinutes, dayStartMinutes, pxPerMinute, gap }: EventGeometryInput): {
    top: number;
    height: number;
};
//# sourceMappingURL=geometry.d.ts.map