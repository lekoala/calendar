/**
 * Track one captured pointer gesture and guarantee a single, explicit
 * lifecycle for it. The primitive owns browser mechanics only: pointer
 * identity, best-effort capture, the movement threshold and cleanup. Target
 * resolution, snapping, policy and commits stay in the renderer that starts
 * the gesture.
 *
 * `onCleanup` runs exactly once, before `onEnd`/`onCancel`. It is where a
 * caller removes mirrors, stops autoscroll and drops temporary classes.
 * `dispose()` is the deterministic cancellation path when the calendar
 * itself replaces the node under an active gesture; `lostpointercapture`
 * remains the safety net for browser-initiated interruptions.
 *
 * @param {object} input
 * @param {HTMLElement} input.target element receiving the pointer events
 * @param {PointerEvent} input.event initiating pointerdown
 * @param {number} [input.threshold] movement in pixels before `onMove` runs
 * @param {(event: PointerEvent, state: { moved: boolean }) => void} input.onMove
 * @param {(event: PointerEvent, state: { moved: boolean }) => void} input.onEnd
 * @param {(reason: "pointercancel" | "lostpointercapture" | "dispose") => void} [input.onCancel]
 * @param {() => void} [input.onCleanup]
 * @returns {{ dispose: () => void }}
 */
export function startPointerGesture({ target, event, threshold = 4, onMove, onEnd, onCancel, onCleanup }) {
  const pointerId = event.pointerId;
  const downX = event.clientX;
  const downY = event.clientY;
  let moved = false;
  let finished = false;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    target.removeEventListener("pointermove", handleMove);
    target.removeEventListener("pointerup", handleUp);
    target.removeEventListener("pointercancel", handleCancel);
    // Removed last so a normal drop does not re-enter cancellation after
    // the implicit capture release that follows `pointerup`.
    target.removeEventListener("lostpointercapture", handleLost);
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      // The browser may already have released it.
    }
    onCleanup?.();
  };

  /** @param {PointerEvent} moveEvent */
  const handleMove = (moveEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    if (!moved && Math.hypot(moveEvent.clientX - downX, moveEvent.clientY - downY) >= threshold) {
      moved = true;
    }
    if (!moved) return;
    onMove(moveEvent, { moved });
  };

  /** @param {PointerEvent} upEvent */
  const handleUp = (upEvent) => {
    if (upEvent.pointerId !== pointerId) return;
    cleanup();
    onEnd(upEvent, { moved });
  };

  /** @param {PointerEvent} cancelEvent */
  const handleCancel = (cancelEvent) => {
    if (cancelEvent.pointerId !== pointerId) return;
    cleanup();
    onCancel?.("pointercancel");
  };

  /** @param {PointerEvent} lostEvent */
  const handleLost = (lostEvent) => {
    if (lostEvent.pointerId !== pointerId) return;
    cleanup();
    onCancel?.("lostpointercapture");
  };

  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Capture is an enhancement, not a requirement.
  }
  target.addEventListener("pointermove", handleMove);
  target.addEventListener("pointerup", handleUp);
  target.addEventListener("pointercancel", handleCancel);
  target.addEventListener("lostpointercapture", handleLost);

  return {
    dispose() {
      if (finished) return;
      cleanup();
      onCancel?.("dispose");
    },
  };
}
