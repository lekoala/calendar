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
export declare function createAutoscroller(scroller: Element, { edge, speed }?: {
    edge?: number;
    speed?: number;
}): {
    /**
     * @param {number} clientY
     * @returns {void}
     */
    update(clientY: number): void;
    /** @returns {void} */
    stop(): void;
};
//# sourceMappingURL=autoscroll.d.ts.map