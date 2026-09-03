export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function snapMinutes(minutes, step, mode = "round") {
  if (!Number.isFinite(minutes) || !Number.isFinite(step) || step <= 0) {
    throw new TypeError("minutes and step must be finite; step must be > 0");
  }
  const ratio = minutes / step;
  const snapped =
    mode === "floor" ? Math.floor(ratio) : mode === "ceil" ? Math.ceil(ratio) : Math.round(ratio);
  return snapped * step;
}

export function minutesToPixels(minutes, pxPerMinute) {
  return minutes * pxPerMinute;
}

export function pixelsToMinutes(pixels, pxPerMinute) {
  if (!Number.isFinite(pxPerMinute) || pxPerMinute <= 0) {
    throw new TypeError("pxPerMinute must be > 0");
  }
  return pixels / pxPerMinute;
}

export function eventGeometry({ startMinutes, endMinutes, dayStartMinutes, pxPerMinute, gap = 2 }) {
  const top = minutesToPixels(startMinutes - dayStartMinutes, pxPerMinute);
  const rawHeight = minutesToPixels(endMinutes - startMinutes, pxPerMinute);
  return {
    top,
    height: Math.max(1, rawHeight - gap),
  };
}
