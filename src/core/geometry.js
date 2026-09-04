/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {number} minutes
 * @param {number} step
 * @param {"round" | "floor" | "ceil"} [mode]
 * @returns {number}
 */
export function snapMinutes(minutes, step, mode = "round") {
  if (!Number.isFinite(minutes) || !Number.isFinite(step) || step <= 0) {
    throw new TypeError("minutes and step must be finite; step must be > 0");
  }
  // Epsilon absorbs float noise from rect/pointer math (e.g. 659.9999999999
  // for an exact 660): far above ulp-level error (~1e-12 here), far below any
  // meaningful sub-step difference (seconds resolve to ~1e-3 of a 15m step).
  const epsilon = 1e-9;
  const ratio = minutes / step;
  const snapped =
    mode === "floor"
      ? Math.floor(ratio + epsilon)
      : mode === "ceil"
        ? Math.ceil(ratio - epsilon)
        : Math.round(ratio);
  return snapped * step;
}

/**
 * Default neighbor-snapping threshold: half a snap step, capped at 5 minutes
 * so coarse grids do not attract across large distances.
 *
 * @param {number} snapStep snap step in minutes
 * @returns {number}
 */
export function defaultSnapThreshold(snapStep) {
  if (!Number.isFinite(snapStep) || snapStep <= 0) {
    throw new TypeError("snapStep must be > 0");
  }
  return Math.min(snapStep / 2, 5);
}

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
export function findSnapTarget(minutes, edges, threshold) {
  if (!Number.isFinite(minutes) || !Number.isFinite(threshold) || threshold <= 0) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const edge of edges) {
    if (!Number.isFinite(edge)) continue;
    const distance = Math.abs(minutes - edge);
    if (distance <= threshold && distance < bestDistance) {
      best = edge;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * @param {number} minutes
 * @param {number} pxPerMinute
 * @returns {number}
 */
export function minutesToPixels(minutes, pxPerMinute) {
  return minutes * pxPerMinute;
}

/**
 * @param {number} pixels
 * @param {number} pxPerMinute
 * @returns {number}
 */
export function pixelsToMinutes(pixels, pxPerMinute) {
  if (!Number.isFinite(pxPerMinute) || pxPerMinute <= 0) {
    throw new TypeError("pxPerMinute must be > 0");
  }
  return pixels / pxPerMinute;
}

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
export function eventGeometry({ startMinutes, endMinutes, dayStartMinutes, pxPerMinute, gap = 2 }) {
  const top = minutesToPixels(startMinutes - dayStartMinutes, pxPerMinute);
  const rawHeight = minutesToPixels(endMinutes - startMinutes, pxPerMinute);
  return {
    top,
    height: Math.max(1, rawHeight - gap),
  };
}
