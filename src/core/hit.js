import { clamp } from "./geometry.js";

/**
 * Shared pointer hit-testing primitive.
 *
 * Resolves client coordinates to a day column and wall-clock minutes.
 * Hover preview, range selection, drag and drop all consume this result;
 * only the DOM rect collection lives in the renderer, everything else is
 * pure and unit-testable.
 *
 * ```js
 * hitTest({
 *   x, y,
 *   columns: [{ date, resource, rect: { left, top, right, bottom } }],
 *   slotMin, // minutes from midnight, inclusive
 *   slotMax, // minutes from midnight, inclusive
 *   pxPerMinute,
 * })
 * // -> { column, date, resource, minutes } | null
 * ```
 *
 * Minutes are clamped to the slot range, so negative pointer offsets land
 * on `slotMin` and positions past the end land on `slotMax`.
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
