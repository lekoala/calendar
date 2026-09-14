/**
 * Viewport autoscroll for pointer drag operations.
 *
 * Kept separate from layout math on purpose: it only reads the scroller
 * geometry and advances `scrollTop`/`scrollLeft` while the pointer rests
 * near an edge. Each axis is independent: one stops as soon as the pointer
 * leaves its edge zone, and the loop stops entirely once neither axis wants
 * to scroll.
 *
 * ```js
 * const autoscroll = createAutoscroller(scroller);
 * node.addEventListener("pointermove", (event) => autoscroll.update(event.clientX, event.clientY));
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
  let deltaX = 0;
  /** @type {number} */
  let deltaY = 0;
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
      deltaX = 0;
      deltaY = 0;
      frame = 0;
      return;
    }
    scroller.scrollTop += deltaY;
    scroller.scrollLeft += deltaX;
    frame = requestAnimationFrame(tick);
  };

  return {
    /**
     * @param {number} clientX
     * @param {number} clientY
     * @returns {void}
     */
    update(clientX, clientY) {
      const rect = scroller.getBoundingClientRect();
      const nextY = clientY < rect.top + edge ? -speed : clientY > rect.bottom - edge ? speed : 0;
      // `scrollLeft` follows the scroll origin, so its numeric direction
      // differs under RTL; adding the delta still moves the content toward
      // the edge the pointer rests on in every engine.
      const nextX = clientX < rect.left + edge ? -speed : clientX > rect.right - edge ? speed : 0;
      if (nextX === deltaX && nextY === deltaY) return;
      deltaX = nextX;
      deltaY = nextY;
      if ((deltaX !== 0 || deltaY !== 0) && frame === 0 && scroller.isConnected) {
        frame = requestAnimationFrame(tick);
      }
      if (deltaX === 0 && deltaY === 0) cancel();
    },
    /** @returns {void} */
    stop() {
      deltaX = 0;
      deltaY = 0;
      cancel();
    },
  };
}
