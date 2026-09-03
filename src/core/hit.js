import { clamp } from "./geometry.js";

/**
 * @typedef {object} HitRect
 * @property {number} left
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 */

/**
 * @typedef {object} HitColumn
 * @property {unknown} date
 * @property {unknown} resource
 * @property {HitRect} rect
 */

/**
 * @typedef {object} HitTestInput
 * @property {number} x
 * @property {number} y
 * @property {HitColumn[]} columns
 * @property {number} slotMin
 * @property {number} slotMax
 * @property {number} pxPerMinute
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
 * @param {HitTestInput} input
 * @returns {{ column: number, date: unknown, resource: unknown, minutes: number } | null}
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
