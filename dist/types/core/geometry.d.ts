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