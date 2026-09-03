import { clamp } from "./geometry.js";

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
export function hitTest({ x, y, columns, slotMin, slotMax, pxPerMinute }) {
  const column = columns.findIndex(
    (entry) => x >= entry.rect.left && x < entry.rect.right && y >= entry.rect.top && y < entry.rect.bottom,
  );
  if (column < 0) return null;
  const { date, resource, rect } = columns[column];
  const minutes = clamp(slotMin + (y - rect.top) / pxPerMinute, slotMin, slotMax);
  return { column, date, resource, minutes };
}
