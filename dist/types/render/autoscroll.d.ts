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
export declare function createAutoscroller(scroller: Element, { edge, speed }?: {
    edge?: number;
    speed?: number;
}): {
    /**
     * @param {number} clientX
     * @param {number} clientY
     * @returns {void}
     */
    update(clientX: number, clientY: number): void;
    /** @returns {void} */
    stop(): void;
};
//# sourceMappingURL=autoscroll.d.ts.map