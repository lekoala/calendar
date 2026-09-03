export type HitRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
/**
 * @typedef {object} HitRect
 * @property {number} left
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 */
/**
 * Shared pointer hit-testing primitive.
 *
 * Resolves client coordinates to a day column and wall-clock minutes.
 * Hover preview, range selection, drag and drop all consume this result;
 * only the DOM rect collection lives in the renderer, everything else is
 * pure and unit-testable.
 *
 * Minutes are clamped to the slot range, so negative pointer offsets land
 * on `slotMin` and positions past the end land on `slotMax`.
 *
 * @template [D=unknown]
 * @template [R=unknown]
 * @param {object} input
 * @param {number} input.x
 * @param {number} input.y
 * @param {Array<{ date: D, resource: R, rect: HitRect }>} input.columns
 * @param {number} input.slotMin
 * @param {number} input.slotMax
 * @param {number} input.pxPerMinute
 * @returns {{ column: number, date: D, resource: R, minutes: number } | null}
 */
export declare function hitTest<D = unknown, R = unknown>({ x, y, columns, slotMin, slotMax, pxPerMinute }: {
    x: number;
    y: number;
    columns: Array<{
        date: D;
        resource: R;
        rect: HitRect;
    }>;
    slotMin: number;
    slotMax: number;
    pxPerMinute: number;
}): {
    column: number;
    date: D;
    resource: R;
    minutes: number;
} | null;
//# sourceMappingURL=hit.d.ts.map