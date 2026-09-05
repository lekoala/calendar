/**
 * Viewport autoscroll for pointer drag operations.
 *
 * Kept separate from layout math on purpose: it only reads the scroller
 * geometry and advances `scrollTop` while the pointer rests near an edge.
 *
 * ```js
 * const autoscroll = createAutoscroller(scroller);
 * node.addEventListener("pointermove", (event) => autoscroll.update(event.clientY));
 * node.addEventListener("pointerup", () => autoscroll.stop());
 * ```
 *
 * @param {Element} scroller
 * @param {object} [config]
 * @param {number} [config.edge] distance in pixels from the edge where scrolling starts
 * @param {number} [config.speed] pixels advanced per animation frame
 */
export function createAutoscroller(scroller, { edge = 48, speed = 12 } = {}) {
  /** @type {number} */
  let delta = 0;
  /** @type {number} */
  let frame = 0;

  /** @returns {void} */
  const cancel = () => {
    if (frame === 0) return;
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const tick = () => {
    // Cleanup normally rides on `pointerup`/`pointercancel`, but a scroller
    // can leave the document mid-drag (the calendar is removed, or a render
    // replaces the subtree) and no pointer event follows. The loop owns its
    // own liveness so it never outlives its target.
    if (!scroller.isConnected) {
      delta = 0;
      frame = 0;
      return;
    }
    scroller.scrollTop += delta;
    frame = requestAnimationFrame(tick);
  };

  return {
    /**
     * @param {number} clientY
     * @returns {void}
     */
    update(clientY) {
      const rect = scroller.getBoundingClientRect();
      const next = clientY < rect.top + edge ? -speed : clientY > rect.bottom - edge ? speed : 0;
      if (next === delta) return;
      delta = next;
      if (delta !== 0 && frame === 0 && scroller.isConnected) frame = requestAnimationFrame(tick);
      if (delta === 0) cancel();
    },
    /** @returns {void} */
    stop() {
      delta = 0;
      cancel();
    },
  };
}
