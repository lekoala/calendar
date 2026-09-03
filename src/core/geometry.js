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
  const ratio = minutes / step;
  const snapped =
    mode === "floor" ? Math.floor(ratio) : mode === "ceil" ? Math.ceil(ratio) : Math.round(ratio);
  return snapped * step;
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
